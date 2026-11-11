import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const RANGE_DAYS: Record<string, number | null> = { "7": 7, "30": 30, "90": 90, all: null };

type CountRow = { key: string; count: number };

/**
 * GET /api/admin/analytics?restaurantId=...&days=7|30|90|all
 * Aggregates in SQL so totals are exact at any volume.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || null;
    const daysParam = searchParams.get("days") ?? "30";
    const days = daysParam in RANGE_DAYS ? RANGE_DAYS[daysParam] : 30;
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

    const where: Prisma.AnalyticsEventWhereInput = {
      ...(restaurantId && { restaurantId }),
      ...(since && { createdAt: { gte: since } }),
    };
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (restaurantId) conditions.push(Prisma.sql`"restaurantId" = ${restaurantId}`);
    if (since) conditions.push(Prisma.sql`"createdAt" >= ${since}`);
    const sqlWhere = Prisma.join(conditions, " AND ");

    const countByProperty = (property: string) =>
      prisma.$queryRaw<CountRow[]>`
        SELECT COALESCE("properties"->>${property}, 'unknown') AS key, COUNT(*)::int AS count
        FROM "AnalyticsEvent" WHERE ${sqlWhere}
        GROUP BY 1 ORDER BY 2 DESC`;

    const [total, byEventName, itemViews, arOpens, byDeviceType, byArMode, daily] = await Promise.all([
      prisma.analyticsEvent.count({ where }),
      prisma.analyticsEvent.groupBy({ by: ["eventName"], where, _count: { _all: true } }),
      prisma.analyticsEvent.groupBy({
        by: ["itemId"],
        where: { ...where, eventName: "item_view", itemId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { itemId: "desc" } },
        take: 10,
      }),
      prisma.analyticsEvent.groupBy({
        by: ["itemId"],
        where: { ...where, eventName: "ar_open", itemId: { not: null } },
        _count: { _all: true },
      }),
      countByProperty("deviceType"),
      prisma.$queryRaw<CountRow[]>`
        SELECT COALESCE("properties"->>'arMode', 'unknown') AS key, COUNT(*)::int AS count
        FROM "AnalyticsEvent" WHERE ${sqlWhere} AND "eventName" = 'ar_open'
        GROUP BY 1 ORDER BY 2 DESC`,
      prisma.$queryRaw<{ day: Date; menuViews: number; itemViews: number; arOpens: number }[]>`
        SELECT date_trunc('day', "createdAt") AS day,
               COUNT(*) FILTER (WHERE "eventName" = 'menu_view')::int AS "menuViews",
               COUNT(*) FILTER (WHERE "eventName" = 'item_view')::int AS "itemViews",
               COUNT(*) FILTER (WHERE "eventName" = 'ar_open')::int AS "arOpens"
        FROM "AnalyticsEvent" WHERE ${sqlWhere}
        GROUP BY 1 ORDER BY 1`,
    ]);

    const itemIds = itemViews.map((r) => r.itemId!).filter(Boolean);
    const items = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, restaurant: { select: { name: true } } },
    });
    const itemById = new Map(items.map((i) => [i.id, i]));
    const arOpensByItem = new Map(arOpens.map((r) => [r.itemId, r._count._all]));

    const eventCounts = Object.fromEntries(byEventName.map((r) => [r.eventName, r._count._all]));

    return NextResponse.json({
      range: daysParam in RANGE_DAYS ? daysParam : "30",
      totalEvents: total,
      byEventName: eventCounts,
      funnel: {
        menuViews: eventCounts.menu_view ?? 0,
        itemViews: eventCounts.item_view ?? 0,
        arOpens: eventCounts.ar_open ?? 0,
        arPlacements: eventCounts.ar_place_success ?? 0,
      },
      topItems: itemViews.map((r) => ({
        itemId: r.itemId!,
        name: itemById.get(r.itemId!)?.name ?? "Deleted item",
        restaurantName: itemById.get(r.itemId!)?.restaurant.name,
        views: r._count._all,
        arOpens: arOpensByItem.get(r.itemId) ?? 0,
      })),
      byDeviceType: Object.fromEntries(byDeviceType.map((r) => [r.key, r.count])),
      byArMode: Object.fromEntries(byArMode.map((r) => [r.key, r.count])),
      daily: daily.map((d) => ({ ...d, day: d.day.toISOString().slice(0, 10) })),
    });
  } catch (e) {
    console.error("[analytics] Failed to fetch:", e);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
