import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/restaurants
 * Returns all restaurants with categories and item counts (for admin UI).
 */
export async function GET() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      _count: { select: { items: true } },
    },
  });
  return NextResponse.json(
    restaurants.map((r) => ({
      ...r,
      itemCount: r._count.items,
      _count: undefined,
    }))
  );
}

/**
 * POST /api/admin/restaurants
 * Body: { name, slug }
 * TECH_SPECS §4 Admin API.
 */
export async function POST(request: Request) {
  let body: { name?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, slug } = body;
  if (typeof name !== "string" || !name.trim() || typeof slug !== "string" || !slug.trim()) {
    return NextResponse.json(
      { error: "name and slug are required" },
      { status: 400 }
    );
  }
  const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");
  try {
    const restaurant = await prisma.restaurant.create({
      data: { name: name.trim(), slug: normalizedSlug },
    });
    return NextResponse.json(restaurant);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002"
      ? "Slug already in use"
      : "Failed to create restaurant";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
