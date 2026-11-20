import { cookies } from "next/headers";
import { handle, json } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

export const POST = handle(async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
});
