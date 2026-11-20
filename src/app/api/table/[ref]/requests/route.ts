import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { createServiceRequest } from "@/lib/orders";

const schema = z.object({
  type: z.enum(["WAITER", "WATER", "CLEAN", "BILL", "CUSTOM"]),
  message: z.string().max(200).optional(),
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/t/[code]/requests">) => {
  const { code } = await ctx.params;
  const body = schema.parse(await readJson(req));
  const result = await createServiceRequest(code, body.type, body.message);
  return json(result, { status: result.duplicate ? 200 : 201 });
});
