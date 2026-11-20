import { handle, json } from "@/lib/api";
import { cancelOrderByCustomer } from "@/lib/orders";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/t/[code]/orders/[orderId]/cancel">) => {
  const { code, orderId } = await ctx.params;
  const order = await cancelOrderByCustomer(code, orderId);
  return json({ order });
});
