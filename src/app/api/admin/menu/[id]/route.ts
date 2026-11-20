import { db } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { menuItemUpdateSchema } from "@/lib/schemas";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/admin/menu/[id]">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = menuItemUpdateSchema.parse(await readJson(req));
  return json({ item: await db.menuItem.update({ where: { id }, data }) });
});

/** Soft delete: the dish disappears from the menu but old orders & reports stay correct. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/admin/menu/[id]">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  await db.menuItem.update({ where: { id }, data: { archived: true, available: false } });
  return json({ ok: true });
});
