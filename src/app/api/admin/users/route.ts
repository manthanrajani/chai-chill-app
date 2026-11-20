import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

const select = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;

export const GET = handle(async () => {
  await requireAdmin();
  return json({ users: await db.user.findMany({ select, orderBy: { createdAt: "asc" } }) });
});

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(["ADMIN", "STAFF"]),
});

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const { password, ...data } = schema.parse(await readJson(req));
  if (await db.user.findUnique({ where: { email: data.email } })) throw new ApiError(409, "A user with this email already exists");
  const user = await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) }, select });
  return json({ user }, { status: 201 });
});
