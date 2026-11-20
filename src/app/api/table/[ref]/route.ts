import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { getTable } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { estimateOrders } from "@/lib/eta";

/** Everything a customer phone needs about its table. Also acts as the "table is online" heartbeat. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/table/[ref]">) => {
  const { ref: code } = await ctx.params;
  const table = await getTable(code);

  if (!table.lastSeenAt || Date.now() - table.lastSeenAt.getTime() > 20_000) {
    await db.cafeTable.update({ where: { id: table.id }, data: { lastSeenAt: new Date() } });
  }

  const [settings, bill, requests, lastClosed] = await Promise.all([
    getSettings(),
    db.bill.findFirst({
      where: { tableId: table.id, status: "OPEN" },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: { items: { select: { id: true, name: true, qty: true, unitPricePaise: true, lineTotalPaise: true } } },
        },
      },
    }),
    db.serviceRequest.findMany({
      where: { tableId: table.id, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, message: true, createdAt: true },
    }),
    db.bill.findFirst({
      where: { tableId: table.id, status: "PAID", closedAt: { gte: new Date(Date.now() - 15 * 60_000) } },
      orderBy: { closedAt: "desc" },
      select: { id: true, billNo: true, totalPaise: true, paymentMethod: true, closedAt: true },
    }),
  ]);

  const { avgPrepMinutes, estimates } = await estimateOrders(bill?.orders ?? []);

  return json({
    serverTime: new Date().toISOString(),
    kitchen: { avgPrepMinutes },
    table: { id: table.id, number: table.number, label: table.label },
    cafe: {
      name: settings.cafeName,
      tagline: settings.tagline,
      address: settings.address,
      phone: settings.phone,
      gstin: settings.gstin,
      pureVeg: settings.pureVeg,
      gstRateBp: settings.gstRateBp,
      wifiSsid: settings.wifiSsid,
      wifiPassword: settings.wifiPassword,
      upiId: settings.upiId,
      acceptingOrders: settings.acceptingOrders,
    },
    bill: bill && { ...bill, orders: bill.orders.map((o) => ({ ...o, estimate: estimates[o.id] ?? null })) },
    requests,
    lastClosedBill: lastClosed,
  });
});
