import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { categoryUpdateSchema } from "@/lib/schemas";

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/admin/categories/[id]">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = categoryUpdateSchema.parse(await readJson(req));
  return json({ category: await db.category.update({ where: { id }, data }) });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/admin/categories/[id]">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const [live, archived] = await Promise.all([
    db.menuItem.count({ where: { categoryId: id, archived: false } }),
    db.menuItem.count({ where: { categoryId: id, archived: true } }),
  ]);
  if (live > 0) throw new ApiError(409, "This category still has dishes. Move or remove them first, or just hide the category.");
  if (archived > 0) {
    // removed dishes are kept for sales history, so the category is hidden instead of deleted
    await db.category.update({ where: { id }, data: { active: false } });
    return json({ ok: true, hidden: true });
  }
  await db.category.delete({ where: { id } });
  return json({ ok: true });
});
