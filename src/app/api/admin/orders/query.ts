import "server-only";
import { z } from "zod";
import { resolveRange } from "@/lib/analytics";
import type { Prisma } from "@/generated/prisma/client";

const schema = z.object({
  range: z.enum(["today", "yesterday", "7d", "30d", "month", "lastmonth", "year", "custom"]).default("today"),
  from: z.string().nullish(),
  to: z.string().nullish(),
  status: z.enum(["ALL", "PLACED", "PREPARING", "READY", "SERVED", "CANCELLED"]).default("ALL"),
  table: z.coerce.number().int().optional(),
  q: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export function parseOrderQuery(url: URL, tz: string) {
  const raw = Object.fromEntries([...url.searchParams.entries()].filter(([, v]) => v !== ""));
  const p = schema.parse(raw);
  const r = resolveRange(tz, p.range, p.from, p.to);
  const orderNo = p.q && /^\d+$/.test(p.q) ? Number(p.q) : undefined;
  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: r.start, lt: r.end },
    ...(p.status !== "ALL" && { status: p.status }),
    ...(p.table && { table: { number: p.table } }),
    ...(p.q && {
      OR: [
        ...(orderNo ? [{ orderNo }] : []),
        { customerName: { contains: p.q, mode: "insensitive" as const } },
        { items: { some: { name: { contains: p.q, mode: "insensitive" as const } } } },
      ],
    }),
  };
  return { where, page: p.page, range: r };
}
