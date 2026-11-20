import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { requireStaff } from "@/lib/auth";

const schema = z.object({ acceptingOrders: z.boolean() });

/** Staff can pause/resume online ordering (e.g. kitchen rush or closing time). */
export const PATCH = handle(async (req: Request) => {
  await requireStaff();
  const { acceptingOrders } = schema.parse(await readJson(req));
  await db.settings.upsert({ where: { id: 1 }, update: { acceptingOrders }, create: { id: 1, acceptingOrders } });
  return json({ acceptingOrders });
});
