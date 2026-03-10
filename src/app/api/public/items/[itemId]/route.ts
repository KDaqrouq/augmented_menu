import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/public/items/[itemId]
 * Returns item details + asset URLs + dimensions + measurement.
 * TECH_SPECS §4 Public API.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      assets: { orderBy: { version: "desc" }, take: 1 },
      restaurant: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const latestAsset = item.assets[0];

  return NextResponse.json({
    id: item.id,
    name: item.name,
    description: item.description ?? undefined,
    price: item.price ?? undefined,
    isAvailable: item.isAvailable,
    measurementType: item.measurementType,
    measurementValue: item.measurementValue,
    arAssetStatus: item.arAssetStatus,
    arAssetVersion: item.arAssetVersion,
    restaurant: item.restaurant,
    photos: item.media.map((m) => ({ id: m.id, url: m.url, sortOrder: m.sortOrder })),
    asset: latestAsset
      ? {
          glbUrl: latestAsset.glbUrl,
          usdzUrl: latestAsset.usdzUrl ?? undefined,
          units: latestAsset.units,
          bboxX: latestAsset.bboxX,
          bboxY: latestAsset.bboxY,
          bboxZ: latestAsset.bboxZ,
          scaleFactor: latestAsset.scaleFactor,
        }
      : undefined,
  });
}
