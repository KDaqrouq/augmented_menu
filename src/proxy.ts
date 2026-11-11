import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const PUBLIC_ADMIN_API = new Set(["/api/admin/login", "/api/admin/logout"]);

/**
 * Next 16 proxy (formerly middleware): protects the admin UI (including /admin itself) and the admin API.
 * Excludes /admin/login, /api/admin/login and /api/admin/logout.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authed = !!token && (await verifySessionToken(token));

  if (path.startsWith("/api/admin/")) {
    if (PUBLIC_ADMIN_API.has(path) || authed) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdminPage = path === "/admin" || path.startsWith("/admin/");
  if (isAdminPage && path !== "/admin/login" && !authed) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("from", path);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
