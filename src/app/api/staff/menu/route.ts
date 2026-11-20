import { db } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { requireStaff } from "@/lib/auth";

/** Menu list for the kitchen "sold out" switches. */
export const GET = handle(async () => {
  await requireStaff();
  const items = await db.menuItem.findMany({
    where: { archived: false },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, emoji: true, available: true, category: { select: { name: true } } },
  });
  return json({ items });
});
