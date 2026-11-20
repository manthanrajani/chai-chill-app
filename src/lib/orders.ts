import "server-only";
import { db } from "./db";
import { ApiError } from "./errors";
import { computeTax } from "./money";
import { getSettings } from "./settings";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentMethod, RequestType } from "@/generated/prisma/enums";

export const MAX_QTY_PER_ITEM = 20;
export const MAX_LINES_PER_ORDER = 30;
export const MAX_PENDING_ORDERS_PER_TABLE = 5;

export async function getTableByCode(code: string) {
  const table = await db.cafeTable.findUnique({ where: { code } });
  if (!table || !table.active) throw new ApiError(404, "This table QR is not valid. Please ask the staff.");
  return table;
}

/** Finds the table's open bill or opens a new one (a partial unique index guarantees only one). */
async function getOrOpenBill(tx: Prisma.TransactionClient, tableId: number) {
  const existing = await tx.bill.findFirst({ where: { tableId, status: "OPEN" } });
  if (existing) return existing;
  return tx.bill.create({ data: { tableId } });
}

export type PlaceOrderInput = {
  items: { menuItemId: string; qty: number }[];
  notes?: string;
  customerName?: string;
};

export async function placeOrder(tableCode: string, input: PlaceOrderInput) {
  const table = await getTableByCode(tableCode);
  const settings = await getSettings();
  if (!settings.acceptingOrders) {
    throw new ApiError(409, "Kitchen is not accepting orders right now. Please call the waiter.");
  }

  // merge duplicate lines
  const qtyById = new Map<string, number>();
  for (const line of input.items) qtyById.set(line.menuItemId, (qtyById.get(line.menuItemId) ?? 0) + line.qty);
  if (qtyById.size === 0) throw new ApiError(400, "Your cart is empty");
  if (qtyById.size > MAX_LINES_PER_ORDER) throw new ApiError(400, "Too many different items in one order");
  for (const qty of qtyById.values()) {
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw new ApiError(400, `Quantity must be between 1 and ${MAX_QTY_PER_ITEM}`);
    }
  }

  const menuItems = await db.menuItem.findMany({
    where: { id: { in: [...qtyById.keys()] } },
    include: { category: { select: { active: true } } },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const unavailable: string[] = [];
  for (const id of qtyById.keys()) {
    const m = byId.get(id);
    if (!m || m.archived || !m.category.active) unavailable.push("an item that is no longer on the menu");
    else if (!m.available) unavailable.push(m.name);
  }
  if (unavailable.length) throw new ApiError(409, `Sorry, sold out: ${unavailable.join(", ")}. Please update your cart.`);

  // prices always come from the database, never from the browser
  const lines = [...qtyById.entries()].map(([id, qty]) => {
    const m = byId.get(id)!;
    return { menuItemId: id, name: m.name, unitPricePaise: m.pricePaise, qty, lineTotalPaise: m.pricePaise * qty };
  });
  const subtotalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  const taxPaise = computeTax(subtotalPaise, settings.gstRateBp);
  const totalPaise = subtotalPaise + taxPaise;

  const run = () =>
    db.$transaction(async (tx) => {
      const pending = await tx.order.count({ where: { tableId: table.id, status: "PLACED" } });
      if (pending >= MAX_PENDING_ORDERS_PER_TABLE) {
        throw new ApiError(429, "You already have several orders waiting. Please wait for the kitchen to accept them.");
      }
      const bill = await getOrOpenBill(tx, table.id);
      const order = await tx.order.create({
        data: {
          tableId: table.id,
          billId: bill.id,
          notes: input.notes?.trim() || null,
          customerName: input.customerName?.trim() || null,
          subtotalPaise,
          taxPaise,
          totalPaise,
          items: { create: lines },
        },
        include: { items: true },
      });
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          subtotalPaise: { increment: subtotalPaise },
          taxPaise: { increment: taxPaise },
          totalPaise: { increment: totalPaise },
        },
      });
      return order;
    });

  try {
    return await run();
  } catch (e) {
    // two phones at the same table opened a bill at the same instant — retry once and join it
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return run();
    throw e;
  }
}

const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED"],
  SERVED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(orderId: string, next: OrderStatus, reason?: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { bill: true } });
    if (!order) throw new ApiError(404, "Order not found");
    if (!NEXT_STATUS[order.status].includes(next)) {
      throw new ApiError(
        409,
        NEXT_STATUS[order.status].length === 0
          ? `Order #${order.orderNo} is already ${order.status.toLowerCase()}`
          : `Order #${order.orderNo} is ${order.status.toLowerCase()} — it can't be marked ${next.toLowerCase()} yet`,
      );
    }
    if (next === "CANCELLED" && order.bill.status !== "OPEN") {
      throw new ApiError(409, "This bill is already settled");
    }
    const now = new Date();
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: next,
        ...(next === "PREPARING" && { preparingAt: now }),
        ...(next === "READY" && { readyAt: now }),
        ...(next === "SERVED" && { servedAt: now, readyAt: order.readyAt ?? now }),
        ...(next === "CANCELLED" && { cancelledAt: now, cancelReason: reason?.trim() || null }),
      },
    });
    if (next === "CANCELLED") {
      await tx.bill.update({
        where: { id: order.billId },
        data: {
          subtotalPaise: { decrement: order.subtotalPaise },
          taxPaise: { decrement: order.taxPaise },
          totalPaise: { decrement: order.totalPaise },
        },
      });
      await closeEmptyBill(tx, order.billId);
    }
    return updated;
  });
}

/** A bill whose orders were all cancelled is voided so the table frees up. */
async function closeEmptyBill(tx: Prisma.TransactionClient, billId: string) {
  const live = await tx.order.count({ where: { billId, status: { not: "CANCELLED" } } });
  if (live === 0) {
    await tx.bill.update({ where: { id: billId }, data: { status: "VOID", closedAt: new Date() } });
  }
}

/** Customer may cancel only while the kitchen hasn't started. */
export async function cancelOrderByCustomer(tableCode: string, orderId: string) {
  const table = await getTableByCode(tableCode);
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.tableId !== table.id) throw new ApiError(404, "Order not found");
  if (order.status !== "PLACED") throw new ApiError(409, "The kitchen has already started this order. Please ask the waiter.");
  return updateOrderStatus(orderId, "CANCELLED", "Cancelled by customer");
}

export async function settleBill(billId: string, method: PaymentMethod, userId: string) {
  return db.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({ where: { id: billId }, include: { orders: true } });
    if (!bill) throw new ApiError(404, "Bill not found");
    if (bill.status !== "OPEN") throw new ApiError(409, "This bill is already closed");
    const now = new Date();
    // anything not yet served is considered handed over at settlement
    for (const o of bill.orders) {
      if (o.status === "PLACED") {
        throw new ApiError(409, `Order #${o.orderNo} hasn't been accepted by the kitchen yet. Accept or cancel it first.`);
      }
    }
    await tx.order.updateMany({
      where: { billId, status: { in: ["PREPARING", "READY"] } },
      data: { status: "SERVED", servedAt: now },
    });
    // close any "bring the bill" requests for this table
    await tx.serviceRequest.updateMany({
      where: { tableId: bill.tableId, status: "OPEN", type: "BILL" },
      data: { status: "RESOLVED", resolvedAt: now, resolvedById: userId },
    });
    return tx.bill.update({
      where: { id: billId },
      data: { status: "PAID", paymentMethod: method, closedAt: now, settledById: userId },
    });
  });
}

const REQUEST_LABEL: Record<RequestType, string> = {
  WAITER: "Call waiter to table",
  WATER: "Need drinking water",
  CLEAN: "Clean / wipe the table",
  BILL: "Bring the bill",
  CUSTOM: "",
};

export async function createServiceRequest(tableCode: string, type: RequestType, message?: string) {
  const table = await getTableByCode(tableCode);
  const text = type === "CUSTOM" ? (message ?? "").trim() : (message?.trim() || REQUEST_LABEL[type]);
  if (!text) throw new ApiError(400, "Please type your request");
  // don't spam the staff screen with the same request twice
  const existing = await db.serviceRequest.findFirst({
    where: { tableId: table.id, status: "OPEN", type, ...(type === "CUSTOM" && { message: text }) },
  });
  if (existing) return { request: existing, duplicate: true };
  const openCount = await db.serviceRequest.count({ where: { tableId: table.id, status: "OPEN" } });
  if (openCount >= 6) throw new ApiError(429, "Staff has your requests — someone will be right with you.");
  const request = await db.serviceRequest.create({ data: { tableId: table.id, type, message: text } });
  return { request, duplicate: false };
}
