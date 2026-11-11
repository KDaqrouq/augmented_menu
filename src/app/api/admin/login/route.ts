import { NextResponse } from "next/server";
import { setAdminSessionCookie, verifyAdminPassword } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;

/**
 * POST /api/admin/login
 * Body: { "password": "..." }
 * Sets the admin session cookie if the password matches ADMIN_PASSWORD.
 * Limited to 10 attempts per IP per 15 minutes.
 */
export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Admin login not configured (ADMIN_PASSWORD missing)" },
      { status: 503 }
    );
  }

  const limit = await rateLimit(`login:${getClientIp(request)}`, MAX_ATTEMPTS, WINDOW_SECONDS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!(await verifyAdminPassword(body.password))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await setAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
