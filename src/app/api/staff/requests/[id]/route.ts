import { db } from "@/lib/db";
import { ApiError, handle, json } from "@/lib/api";
import { requireStaff } from "@/lib/auth";

/** Mark a table request (water, waiter, bill...) as done. */
export const PATCH = handle(async (_req: Request, ctx: RouteContext<"/api/staff/requests/[id]">) => {
  const user = await requireStaff();
  const { id } = await ctx.params;
  const res = await db.serviceRequest.updateMany({
    where: { id, status: "OPEN" },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: user.id },
  });
  if (res.count === 0) throw new ApiError(409, "Already resolved");
  return json({ ok: true });
});
