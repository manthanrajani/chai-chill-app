import { handle, json } from "@/lib/api";
import { cancelOrderByCustomer } from "@/lib/orders";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/table/[ref]/orders/[orderId]/cancel">) => {
  const { ref: code, orderId } = await ctx.params;
  const order = await cancelOrderByCustomer(code, orderId);
  return json({ order });
});
