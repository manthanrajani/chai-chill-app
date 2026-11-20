import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { requireStaff } from "@/lib/auth";

const schema = z.object({ available: z.boolean() });

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/staff/menu/[id]">) => {
  await requireStaff();
  const { id } = await ctx.params;
  const { available } = schema.parse(await readJson(req));
  const item = await db.menuItem.update({ where: { id }, data: { available }, select: { id: true, available: true } });
  return json({ item });
});
