import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { resolveRange } from "@/lib/analytics";
import { getSettings } from "@/lib/settings";

const schema = z.object({
  range: z.enum(["today", "yesterday", "7d", "30d", "month", "lastmonth", "year", "custom"]).default("today"),
  from: z.string().nullish(),
  to: z.string().nullish(),
  page: z.coerce.number().int().min(1).default(1),
});

/** Bill history: open bills + bills opened in the range. */
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const s = await getSettings();
  const raw = Object.fromEntries([...new URL(req.url).searchParams.entries()].filter(([, v]) => v !== ""));
  const p = schema.parse(raw);
  const r = resolveRange(s.timezone, p.range, p.from, p.to);
  const where = { openedAt: { gte: r.start, lt: r.end } };
  const [bills, total] = await Promise.all([
    db.bill.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (p.page - 1) * 25,
      take: 25,
      include: {
        table: { select: { number: true } },
        settledBy: { select: { name: true } },
        orders: {
          where: { status: { not: "CANCELLED" } },
          select: { orderNo: true, items: { select: { name: true, qty: true, unitPricePaise: true, lineTotalPaise: true } } },
        },
      },
    }),
    db.bill.count({ where }),
  ]);
  return json({ bills, total, page: p.page, pageSize: 25 });
});
