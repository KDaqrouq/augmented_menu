import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MAX_EVENT_BODY_BYTES, parseAnalyticsEvent } from "@/lib/analytics-events";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

/** Generous for real diners (a menu visit sends a handful), tight enough to stop table-filling. */
const EVENTS_PER_MINUTE = 120;

/**
 * POST /api/analytics/event
 * Body: { eventName, restaurantId?, itemId?, properties? }
 * Public endpoint: validated against the known event list, size-capped and rate-limited per IP.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(`analytics:${getClientIp(request)}`, EVENTS_PER_MINUTE, 60, "memory");
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many events" }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_EVENT_BODY_BYTES) {
    return NextResponse.json({ error: "Event too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseAnalyticsEvent(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await prisma.analyticsEvent.create({ data: parsed.event });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[analytics] Failed to store event:", e);
    return NextResponse.json({ error: "Failed to store event" }, { status: 500 });
  }
}
