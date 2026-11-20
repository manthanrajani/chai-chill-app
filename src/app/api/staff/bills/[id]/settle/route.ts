import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { settleBill } from "@/lib/orders";

const schema = z.object({ method: z.enum(["CASH", "UPI", "CARD"]) });

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/staff/bills/[id]/settle">) => {
  const user = await requireStaff();
  const { id } = await ctx.params;
  const { method } = schema.parse(await readJson(req));
  return json({ bill: await settleBill(id, method, user.id) });
});
