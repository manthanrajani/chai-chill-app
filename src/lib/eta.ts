import "server-only";
import { db } from "./db";

const DEFAULT_PREP_MIN = 15;
const PER_ORDER_AHEAD_MIN = 2;

/** Average minutes from "order placed" to "ready", from the kitchen's recent real orders. */
export async function averagePrepMinutes(): Promise<number> {
  const rows = await db.$queryRaw<{ avg: number | null }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM (o."readyAt" - o."createdAt")) / 60)::float8 AS avg
    FROM (
      SELECT "readyAt", "createdAt" FROM "Order"
      WHERE "readyAt" IS NOT NULL AND "createdAt" > NOW() - INTERVAL '14 days'
      ORDER BY "createdAt" DESC LIMIT 200
    ) o`;
  const avg = rows[0]?.avg;
  if (!avg || !Number.isFinite(avg)) return DEFAULT_PREP_MIN;
  return Math.min(45, Math.max(5, Math.round(avg)));
}

/**
 * Estimate when each active order will be ready:
 * placed time + typical prep time + a little extra for every order the kitchen got before it.
 */
export async function estimateOrders(orders: { id: string; status: string; createdAt: Date; readyAt: Date | null }[]) {
  const active = orders.filter((o) => o.status === "PLACED" || o.status === "PREPARING");
  const result: Record<string, { readyBy: string; ordersAhead: number; typicalMinutes: number }> = {};
  if (!active.length) return { avgPrepMinutes: await averagePrepMinutes(), estimates: result };

  const [avg, queue] = await Promise.all([
    averagePrepMinutes(),
    db.order.findMany({
      where: { status: { in: ["PLACED", "PREPARING"] } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const now = Date.now();
  for (const o of active) {
    const ahead = queue.filter((q) => q.createdAt < o.createdAt).length;
    const due = o.createdAt.getTime() + (avg + Math.min(ahead, 10) * PER_ORDER_AHEAD_MIN) * 60_000;
    // never show a time in the past — if it's running late, say "any minute now" (≈2 min)
    result[o.id] = { readyBy: new Date(Math.max(due, now + 2 * 60_000)).toISOString(), ordersAhead: ahead, typicalMinutes: avg };
  }
  return { avgPrepMinutes: avg, estimates: result };
}
