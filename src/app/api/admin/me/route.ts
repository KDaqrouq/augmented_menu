import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

/**
 * GET /api/admin/me
 * Protected admin route: returns 200 if authenticated, 401 otherwise.
 * Lets clients check whether the admin session is still valid.
 */
export async function GET() {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
