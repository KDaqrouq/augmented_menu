import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/analytics/event
 * Client analytics per TECH_SPECS §9.
 * Body: { eventName, restaurantId?, itemId?, properties? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventName, restaurantId, itemId, properties } = body;

    if (!eventName || typeof eventName !== "string") {
      return NextResponse.json(
        { error: "eventName required" },
        { status: 400 }
      );
    }

    await prisma.analyticsEvent.create({
      data: {
        eventName,
        restaurantId: restaurantId ?? null,
        itemId: itemId ?? null,
        properties: properties ?? {},
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[analytics] Failed to store event:", e);
    return NextResponse.json(
      { error: "Failed to store event" },
      { status: 500 }
    );
  }
}
