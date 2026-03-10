import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/restaurants/[id]
 * Returns one restaurant with categories and items (for admin UI).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      categories: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { items: true } } } },
      items: {
        include: {
          category: { select: { id: true, name: true } },
          media: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  return NextResponse.json(restaurant);
}
