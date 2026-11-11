import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeScaleFactor, isBakedScaleStale } from "@/lib/scale";

/**
 * GET /api/admin/items/[id]/jobs
 * Item 3D status, its processing jobs, and a summary of the latest model (for admin hints).
 * Polled by the admin page while a generation is running.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await params;

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: {
      arAssetStatus: true,
      measurementType: true,
      measurementValue: true,
      _count: { select: { media: true } },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, version: true, status: true, errorMessage: true, createdAt: true, updatedAt: true },
      },
      assets: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          version: true,
          glbUrl: true,
          usdzUrl: true,
          arGlbUrl: true,
          bboxX: true,
          bboxY: true,
          bboxZ: true,
          scaleFactor: true,
        },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const asset = item.assets[0];
  const latestAsset = asset
    ? {
        version: asset.version,
        glbUrl: asset.glbUrl,
        usdzUrl: asset.usdzUrl,
        arGlbUrl: asset.arGlbUrl,
        sizeOutdated: isBakedScaleStale(
          asset.scaleFactor,
          computeScaleFactor(item.measurementType, item.measurementValue, asset.bboxX, asset.bboxY, asset.bboxZ)
        ),
      }
    : null;

  return NextResponse.json({
    status: item.arAssetStatus,
    photoCount: item._count.media,
    jobs: item.jobs,
    latestAsset,
  });
}
