import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { newTableCode, ONLINE_WINDOW_MS } from "@/lib/tables";

export const GET = handle(async () => {
  await requireAdmin();
  const tables = await db.cafeTable.findMany({ orderBy: { number: "asc" } });
  const now = Date.now();
  return json({ tables: tables.map((t) => ({ ...t, online: !!t.lastSeenAt && now - t.lastSeenAt.getTime() < ONLINE_WINDOW_MS })) });
});

const schema = z.object({
  number: z.number().int().min(1).max(999),
  label: z.string().trim().max(40).optional(),
  seats: z.number().int().min(1).max(30).default(4),
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const data = schema.parse(await readJson(req));
  if (await db.cafeTable.findUnique({ where: { number: data.number } })) throw new ApiError(409, `Table ${data.number} already exists`);
  const table = await db.cafeTable.create({ data: { ...data, label: data.label || null, code: newTableCode() } });
  return json({ table }, { status: 201 });
});
