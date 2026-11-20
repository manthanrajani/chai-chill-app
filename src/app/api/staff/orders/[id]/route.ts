import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { updateOrderStatus } from "@/lib/orders";

const schema = z.object({
  status: z.enum(["PREPARING", "READY", "SERVED", "CANCELLED"]),
  reason: z.string().max(200).optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/staff/orders/[id]">) => {
  await requireStaff();
  const { id } = await ctx.params;
  const body = schema.parse(await readJson(req));
  return json({ order: await updateOrderStatus(id, body.status, body.reason) });
});
