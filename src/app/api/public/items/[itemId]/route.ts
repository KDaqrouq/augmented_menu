import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicItem } from "@/lib/menu";

/**
 * GET /api/public/items/[itemId]
 * Returns an available item's details, photos, and latest model URLs with the scale to render at.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const owner = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: { restaurant: { select: { slug: true } } },
  });
  const data = owner ? await getPublicItem(owner.restaurant.slug, itemId) : null;
  if (!data) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...data.item,
    restaurant: data.restaurant,
    asset: data.asset,
  });
}
