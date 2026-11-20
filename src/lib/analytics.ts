import "server-only";
import { db } from "./db";
import { ApiError } from "./errors";
import {
  addDays,
  addMonths,
  addYears,
  fromLocal,
  parseYmd,
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalYear,
  toLocal,
  ymd,
} from "./time";

/**
 * Note: Prisma stores DateTime as UTC in "timestamp without time zone" columns,
 * so SQL converts with (col AT TIME ZONE 'UTC') AT TIME ZONE <cafe tz> to get local wall-clock time.
 *
 * Sales = every order that wasn't cancelled, counted at the time it was placed.
 * Amounts include GST (net + tax shown separately).
 */

type Window = { start: Date; end: Date }; // real instants, [start, end)

export type PeriodSummary = {
  revenuePaise: number;
  netPaise: number;
  taxPaise: number;
  orders: number;
  itemsSold: number;
  avgOrderPaise: number;
  cancelled: number;
};

async function summarize(w: Window): Promise<PeriodSummary> {
  const where = { createdAt: { gte: w.start, lt: w.end } };
  const [agg, items, cancelled] = await Promise.all([
    db.order.aggregate({
      where: { ...where, status: { not: "CANCELLED" } },
      _sum: { totalPaise: true, subtotalPaise: true, taxPaise: true },
      _count: { _all: true },
    }),
    db.orderItem.aggregate({
      where: { order: { ...where, status: { not: "CANCELLED" } } },
      _sum: { qty: true },
    }),
    db.order.count({ where: { ...where, status: "CANCELLED" } }),
  ]);
  const orders = agg._count._all;
  const revenuePaise = agg._sum.totalPaise ?? 0;
  return {
    revenuePaise,
    netPaise: agg._sum.subtotalPaise ?? 0,
    taxPaise: agg._sum.taxPaise ?? 0,
    orders,
    itemsSold: items._sum.qty ?? 0,
    avgOrderPaise: orders ? Math.round(revenuePaise / orders) : 0,
    cancelled,
  };
}

/** Today / this month / this year, each compared with the same elapsed time of the previous period. */
export async function getOverview(tz: string) {
  const now = new Date();
  const local = toLocal(now, tz);
  const periods = [
    { key: "today", label: "Today", compareLabel: "vs same time yesterday", start: startOfLocalDay(local), shift: (d: Date) => addDays(d, -1) },
    { key: "month", label: "This Month", compareLabel: "vs same time last month", start: startOfLocalMonth(local), shift: (d: Date) => addMonths(d, -1) },
    { key: "year", label: "This Year", compareLabel: "vs same time last year", start: startOfLocalYear(local), shift: (d: Date) => addYears(d, -1) },
  ] as const;

  const results = await Promise.all(
    periods.map(async (p) => {
      const current = await summarize({ start: fromLocal(p.start, tz), end: now });
      const previous = await summarize({ start: fromLocal(p.shift(p.start), tz), end: fromLocal(p.shift(local), tz) });
      return { key: p.key, label: p.label, compareLabel: p.compareLabel, current, previous };
    }),
  );

  const [allTime, live] = await Promise.all([
    summarize({ start: new Date(0), end: now }),
    getLiveSnapshot(),
  ]);
  return { generatedAt: now.toISOString(), timezone: tz, periods: results, allTime, live };
}

async function getLiveSnapshot() {
  const [activeOrders, openBills, openRequests, tables] = await Promise.all([
    db.order.count({ where: { status: { in: ["PLACED", "PREPARING", "READY"] } } }),
    db.bill.aggregate({ where: { status: "OPEN" }, _sum: { totalPaise: true }, _count: { _all: true } }),
    db.serviceRequest.count({ where: { status: "OPEN" } }),
    db.cafeTable.count({ where: { active: true } }),
  ]);
  return {
    activeOrders,
    openBills: openBills._count._all,
    openBillsPaise: openBills._sum.totalPaise ?? 0,
    openRequests,
    tables,
  };
}

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "month" | "lastmonth" | "year" | "custom";

/** Resolves a named range into local + real boundaries and a chart bucket size. */
export function resolveRange(tz: string, range: RangeKey, from?: string | null, to?: string | null) {
  const local = toLocal(new Date(), tz);
  const today = startOfLocalDay(local);
  let start: Date;
  let end: Date; // exclusive, local
  switch (range) {
    case "today":
      start = today; end = addDays(today, 1); break;
    case "yesterday":
      start = addDays(today, -1); end = today; break;
    case "7d":
      start = addDays(today, -6); end = addDays(today, 1); break;
    case "30d":
      start = addDays(today, -29); end = addDays(today, 1); break;
    case "month":
      start = startOfLocalMonth(local); end = addMonths(start, 1); break;
    case "lastmonth":
      end = startOfLocalMonth(local); start = addMonths(end, -1); break;
    case "year":
      start = startOfLocalYear(local); end = addYears(start, 1); break;
    case "custom": {
      const f = from ? parseYmd(from) : null;
      const t = to ? parseYmd(to) : null;
      if (!f || !t) throw new ApiError(400, "Pick a valid from and to date");
      if (t < f) throw new ApiError(400, "'To' date must be after 'From' date");
      start = f; end = addDays(t, 1);
      if (end.getTime() - start.getTime() > 3 * 366 * 86400000) throw new ApiError(400, "Range too large (max 3 years)");
      break;
    }
    default:
      throw new ApiError(400, "Unknown range");
  }
  const days = (end.getTime() - start.getTime()) / 86400000;
  const bucket: "hour" | "day" | "month" = days <= 1 ? "hour" : days <= 62 ? "day" : "month";
  return {
    localStart: start,
    localEnd: end,
    start: fromLocal(start, tz),
    end: fromLocal(end, tz),
    bucket,
    label: { from: ymd(start), to: ymd(addDays(end, -1)) },
  };
}

function bucketKeys(start: Date, end: Date, bucket: "hour" | "day" | "month") {
  const keys: string[] = [];
  let cur = new Date(start);
  while (cur < end) {
    const iso = cur.toISOString();
    keys.push(bucket === "hour" ? iso.slice(0, 13) : bucket === "day" ? iso.slice(0, 10) : iso.slice(0, 7));
    cur = bucket === "hour" ? new Date(cur.getTime() + 3600000) : bucket === "day" ? addDays(cur, 1) : addMonths(cur, 1);
  }
  return keys;
}

export async function getRangeReport(tz: string, range: RangeKey, from?: string | null, to?: string | null) {
  const r = resolveRange(tz, range, from, to);
  const fmt = r.bucket === "hour" ? 'YYYY-MM-DD"T"HH24' : r.bucket === "day" ? "YYYY-MM-DD" : "YYYY-MM";

  const [summary, series, topItems, categories, payments, hours, tablesPerf, prep] = await Promise.all([
    summarize({ start: r.start, end: r.end }),
    db.$queryRaw<{ bucket: string; revenue: number; orders: number }[]>`
      SELECT to_char(date_trunc(${r.bucket}, (o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), ${fmt}) AS bucket,
             COALESCE(SUM(o."totalPaise"), 0)::float8 AS revenue,
             COUNT(*)::int AS orders
      FROM "Order" o
      WHERE o."status" <> 'CANCELLED' AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ menuItemId: string; name: string; qty: number; revenue: number }[]>`
      SELECT oi."menuItemId", MAX(oi."name") AS name, SUM(oi."qty")::int AS qty, SUM(oi."lineTotalPaise")::float8 AS revenue
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."status" <> 'CANCELLED' AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
      GROUP BY oi."menuItemId" ORDER BY revenue DESC LIMIT 10`,
    db.$queryRaw<{ name: string; emoji: string; qty: number; revenue: number }[]>`
      SELECT c."name", c."emoji", SUM(oi."qty")::int AS qty, SUM(oi."lineTotalPaise")::float8 AS revenue
      FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        JOIN "MenuItem" m ON m."id" = oi."menuItemId"
        JOIN "Category" c ON c."id" = m."categoryId"
      WHERE o."status" <> 'CANCELLED' AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
      GROUP BY c."id", c."name", c."emoji" ORDER BY revenue DESC`,
    db.$queryRaw<{ method: string; bills: number; amount: number }[]>`
      SELECT b."paymentMethod"::text AS method, COUNT(*)::int AS bills, COALESCE(SUM(b."totalPaise"), 0)::float8 AS amount
      FROM "Bill" b
      WHERE b."status" = 'PAID' AND b."closedAt" >= ${r.start} AND b."closedAt" < ${r.end}
      GROUP BY 1 ORDER BY amount DESC`,
    db.$queryRaw<{ hour: number; orders: number; revenue: number }[]>`
      SELECT EXTRACT(HOUR FROM (o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::int AS hour,
             COUNT(*)::int AS orders, COALESCE(SUM(o."totalPaise"), 0)::float8 AS revenue
      FROM "Order" o
      WHERE o."status" <> 'CANCELLED' AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ number: number; orders: number; revenue: number }[]>`
      SELECT t."number", COUNT(*)::int AS orders, COALESCE(SUM(o."totalPaise"), 0)::float8 AS revenue
      FROM "Order" o JOIN "CafeTable" t ON t."id" = o."tableId"
      WHERE o."status" <> 'CANCELLED' AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
      GROUP BY t."number" ORDER BY revenue DESC`,
    db.$queryRaw<{ avg_minutes: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (o."readyAt" - o."createdAt")) / 60)::float8 AS avg_minutes
      FROM "Order" o
      WHERE o."readyAt" IS NOT NULL AND o."status" <> 'CANCELLED'
        AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}`,
  ]);

  const seriesMap = new Map(series.map((s) => [s.bucket, s]));
  const filled = bucketKeys(r.localStart, r.localEnd, r.bucket).map((k) => ({
    bucket: k,
    revenuePaise: seriesMap.get(k)?.revenue ?? 0,
    orders: seriesMap.get(k)?.orders ?? 0,
  }));
  const hourMap = new Map(hours.map((h) => [h.hour, h]));

  return {
    range: { key: range, ...r.label, bucket: r.bucket },
    summary,
    series: filled,
    topItems: topItems.map((t) => ({ name: t.name, qty: t.qty, revenuePaise: t.revenue })),
    categories: categories.map((c) => ({ name: c.name, emoji: c.emoji, qty: c.qty, revenuePaise: c.revenue })),
    payments: payments.map((p) => ({ method: p.method, bills: p.bills, amountPaise: p.amount })),
    hours: Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      orders: hourMap.get(h)?.orders ?? 0,
      revenuePaise: hourMap.get(h)?.revenue ?? 0,
    })),
    tables: tablesPerf.map((t) => ({ number: t.number, orders: t.orders, revenuePaise: t.revenue })),
    avgPrepMinutes: prep[0]?.avg_minutes ?? null,
  };
}
