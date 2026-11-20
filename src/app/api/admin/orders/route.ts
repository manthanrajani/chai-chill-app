import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { parseOrderQuery } from "./query";

const PAGE_SIZE = 25;

export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const s = await getSettings();
  const { where, page, range } = parseOrderQuery(new URL(req.url), s.timezone);
  const [orders, total, sums] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        table: { select: { number: true } },
        items: { select: { name: true, qty: true, lineTotalPaise: true } },
        bill: { select: { billNo: true, status: true, paymentMethod: true } },
      },
    }),
    db.order.count({ where }),
    db.order.aggregate({ where: { AND: [where, { status: { not: "CANCELLED" } }] }, _sum: { totalPaise: true } }),
  ]);
  return json({
    orders,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPaise: sums._sum.totalPaise ?? 0,
    range: range.label,
  });
});
