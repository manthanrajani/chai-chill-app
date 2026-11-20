import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { deriveFloorStatus } from "@/lib/tables";
import { getSettings } from "@/lib/settings";

/** Live kitchen + floor data, polled every few seconds by the staff screen. */
export const GET = handle(async () => {
  await requireStaff();
  const recent = new Date(Date.now() - 20 * 60_000);
  const [orders, requests, tables, bills, settings] = await Promise.all([
    db.order.findMany({
      where: {
        OR: [
          { status: { in: ["PLACED", "PREPARING", "READY"] } },
          { status: "SERVED", servedAt: { gte: recent } },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        table: { select: { number: true, label: true } },
        items: { select: { id: true, name: true, qty: true } },
      },
    }),
    db.serviceRequest.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: { table: { select: { number: true } } },
    }),
    db.cafeTable.findMany({ where: { active: true }, orderBy: { number: "asc" } }),
    db.bill.findMany({
      where: { status: "OPEN" },
      include: {
        orders: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { createdAt: "asc" },
          select: { id: true, orderNo: true, status: true, totalPaise: true, items: { select: { name: true, qty: true, lineTotalPaise: true } } },
        },
      },
    }),
    getSettings(),
  ]);

  const floor = tables.map((t) => {
    const bill = bills.find((b) => b.tableId === t.id) ?? null;
    const activeOrders = orders.filter((o) => o.tableId === t.id && ["PLACED", "PREPARING", "READY"].includes(o.status)).length;
    const openRequests = requests.filter((r) => r.tableId === t.id).length;
    return {
      id: t.id,
      number: t.number,
      label: t.label,
      seats: t.seats,
      status: deriveFloorStatus({ openRequests, activeOrders, hasOpenBill: !!bill, lastSeenAt: t.lastSeenAt }),
      activeOrders,
      openRequests,
      bill: bill && {
        id: bill.id,
        billNo: bill.billNo,
        subtotalPaise: bill.subtotalPaise,
        taxPaise: bill.taxPaise,
        totalPaise: bill.totalPaise,
        openedAt: bill.openedAt,
        orders: bill.orders,
      },
    };
  });

  return json({
    serverTime: new Date().toISOString(),
    acceptingOrders: settings.acceptingOrders,
    gstRateBp: settings.gstRateBp,
    cafeName: settings.cafeName,
    orders,
    requests,
    floor,
  });
});
