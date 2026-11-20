import { categoryCreateSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";


export const GET = handle(async () => {
  await requireAdmin();
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: { where: { archived: false } } } } },
  });
  return json({ categories });
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const data = categoryCreateSchema.parse(await readJson(req));
  return json({ category: await db.category.create({ data }) }, { status: 201 });
});
