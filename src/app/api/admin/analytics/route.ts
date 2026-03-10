import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/analytics
 * Returns restaurant-level stats, top items, device breakdown.
 * Query: ?restaurantId=... (optional, filter by restaurant)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId");

    const where = restaurantId ? { restaurantId } : {};

    const events = await prisma.analyticsEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const byEvent = events.reduce(
      (acc, e) => {
        acc[e.eventName] = (acc[e.eventName] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byItem = events.reduce(
      (acc, e) => {
        const id = e.itemId ?? "_none";
        acc[id] = (acc[id] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byDevice = events.reduce(
      (acc, e) => {
        const props = (e.properties as Record<string, unknown>) ?? {};
        const device = (props.deviceType as string) ?? "unknown";
        acc[device] = (acc[device] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byArMode = events.reduce(
      (acc, e) => {
        const props = (e.properties as Record<string, unknown>) ?? {};
        const mode = (props.arMode as string) ?? "unknown";
        acc[mode] = (acc[mode] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topItems = Object.entries(byItem)
      .filter(([id]) => id !== "_none")
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([itemId, count]) => ({ itemId, count }));

    return NextResponse.json({
      totalEvents: events.length,
      byEventName: byEvent,
      topItems,
      byDeviceType: byDevice,
      byArMode,
    });
  } catch (e) {
    console.error("[analytics] Failed to fetch:", e);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
