import { SignJWT, jwtVerify } from "jose";

/** Edge-safe session token helpers (used by proxy.ts and server code). */
export const SESSION_COOKIE = "cc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — kitchen tablets stay signed in

export type SessionPayload = { sub: string; role: "ADMIN" | "STAFF"; name: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET must be set (16+ chars)");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role as SessionPayload["role"], name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
