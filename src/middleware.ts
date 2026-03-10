import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

/**
 * Protects admin UI and admin API (Checkpoint 1C).
 * Excludes /admin/login and /api/admin/login, /api/admin/logout.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Admin API: require auth except login/logout
  if (path.startsWith("/api/admin/")) {
    if (path === "/api/admin/login" || path === "/api/admin/logout") {
      return NextResponse.next();
    }
    const token = request.cookies.get("admin_session")?.value;
    if (!token || !(await verifySessionToken(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Admin UI: redirect to login if not authenticated (except login page)
  if (path.startsWith("/admin/") && path !== "/admin/login") {
    const token = request.cookies.get("admin_session")?.value;
    if (!token || !(await verifySessionToken(token))) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("from", path);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
