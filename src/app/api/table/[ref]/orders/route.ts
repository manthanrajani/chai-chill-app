import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { MAX_QTY_PER_ITEM, placeOrder } from "@/lib/orders";

const schema = z.object({
  items: z.array(z.object({ menuItemId: z.string().min(1).max(40), qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM) })).min(1).max(30),
  notes: z.string().max(300).optional(),
  customerName: z.string().max(40).optional(),
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/table/[ref]/orders">) => {
  const { ref: code } = await ctx.params;
  const body = schema.parse(await readJson(req));
  const order = await placeOrder(code, body);
  return json({ order }, { status: 201 });
});
