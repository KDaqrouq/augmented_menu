import { NextResponse } from "next/server";
import { setAdminSessionCookie } from "@/lib/auth";

/**
 * POST /api/admin/login
 * Body: { "password": "..." }
 * Sets admin session cookie if password matches ADMIN_PASSWORD (v1 simple gate).
 */
export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin login not configured (ADMIN_PASSWORD missing)" },
      { status: 503 }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const password = body.password;
  if (typeof password !== "string" || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await setAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
