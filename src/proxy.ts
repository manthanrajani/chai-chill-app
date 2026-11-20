import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** Gate staff pages: /kitchen needs any staff login, /admin needs an ADMIN. APIs re-check on their own. */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // /staff — the private entrance for the team (bookmark this on the kitchen tablet / owner phone)
  if (pathname === "/staff") {
    const to = !session ? "/login" : session.role === "ADMIN" ? "/admin" : "/kitchen";
    return NextResponse.redirect(new URL(to, req.url));
  }

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/kitchen", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/staff", "/kitchen/:path*", "/admin/:path*"],
};
