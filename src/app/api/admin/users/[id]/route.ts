import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const me = await requireAdmin();
  const { id } = await ctx.params;
  const { password, ...data } = schema.parse(await readJson(req));
  if (id === me.id && (data.active === false || data.role === "STAFF")) {
    throw new ApiError(400, "You can't disable or demote your own account");
  }
  if (data.active === false || data.role === "STAFF") {
    const admins = await db.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
    const target = await db.user.findUnique({ where: { id } });
    if (target?.role === "ADMIN" && admins === 0) throw new ApiError(400, "At least one active admin is required");
  }
  const user = await db.user.update({
    where: { id },
    data: { ...data, ...(password && { passwordHash: await bcrypt.hash(password, 10) }) },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return json({ user });
});
