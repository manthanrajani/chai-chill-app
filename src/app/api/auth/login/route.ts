import { z } from "zod";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { ApiError, handle, json, readJson } from "@/lib/api";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";

const schema = z.object({ email: z.string().email().max(120), password: z.string().min(1).max(200) });

// simple in-memory brute-force guard (per server instance)
const attempts = new Map<string, { count: number; until: number }>();

export const POST = handle(async (req: Request) => {
  const { email, password } = schema.parse(await readJson(req));
  const key = email.toLowerCase();
  const a = attempts.get(key);
  if (a && a.count >= 5 && Date.now() < a.until) throw new ApiError(429, "Too many attempts. Try again in a few minutes.");

  const user = await db.user.findUnique({ where: { email: key } });
  const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) {
    const next = { count: (a && Date.now() < a.until ? a.count : 0) + 1, until: Date.now() + 5 * 60_000 };
    attempts.set(key, next);
    throw new ApiError(401, "Wrong email or password");
  }
  attempts.delete(key);

  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // secure cookies on HTTPS deployments; still works on a plain-HTTP cafe LAN server
    secure: (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return json({ user: { name: user.name, role: user.role } });
});
