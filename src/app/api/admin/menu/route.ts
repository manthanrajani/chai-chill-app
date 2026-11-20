import { menuItemCreateSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";


export const GET = handle(async () => {
  await requireAdmin();
  const [items, categories] = await Promise.all([
    db.menuItem.findMany({
      where: { archived: false },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      include: { category: { select: { name: true } } },
    }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return json({ items, categories });
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const data = menuItemCreateSchema.parse(await readJson(req));
  return json({ item: await db.menuItem.create({ data }) }, { status: 201 });
});
