import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { ApiError } from "./errors";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = { id: string; name: string; email: string; role: "ADMIN" | "STAFF" };

/** Returns the signed-in staff user (checked against the DB so disabled users lose access immediately). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Please sign in");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (user.role !== "ADMIN") throw new ApiError(403, "Admin access required");
  return user;
}
