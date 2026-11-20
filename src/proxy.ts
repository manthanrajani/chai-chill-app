import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** Gate staff pages: /kitchen needs any staff login, /admin needs an ADMIN. APIs re-check on their own. */
const TABLE_URL = /^\/table\/(\d{1,4})(?:\/(menu|orders|play|waiter|bill|wifi))?\/?$/;

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // customer table links: keep them clean and canonical, 404 anything malformed
  if (pathname.startsWith("/table/")) {
    const m = TABLE_URL.exec(pathname);
    if (!m || Number(m[1]) < 1) return NextResponse.rewrite(new URL("/404", req.url), { status: 404 });
    const canonical = `/table/${Number(m[1])}${m[2] && m[2] !== "menu" ? `/${m[2]}` : ""}`;
    if (canonical !== pathname) return NextResponse.redirect(new URL(canonical + search, req.url), 308);
    return NextResponse.next();
  }
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
  matcher: ["/staff", "/kitchen/:path*", "/admin/:path*", "/table/:path*"],
};
