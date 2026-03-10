import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/public/restaurants/[slug]/menu
 * Returns categories + items with minimal fields + thumbnail (first media URL).
 * TECH_SPECS §4 Public API.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      categories: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { isAvailable: true },
            include: {
              media: { orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!restaurant) {
    return NextResponse.json(
      { error: "Restaurant not found" },
      { status: 404 }
    );
  }

  const categories = restaurant.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    sortOrder: cat.sortOrder,
    items: cat.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? undefined,
      price: item.price ?? undefined,
      thumbnail: item.media[0]?.url ?? undefined,
      arAssetStatus: item.arAssetStatus,
    })),
  }));

  return NextResponse.json({
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
    },
    categories,
  });
}
