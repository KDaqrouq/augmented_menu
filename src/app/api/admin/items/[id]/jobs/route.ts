import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/items/[id]/jobs
 * Returns processing jobs for the item (status, error, etc.) plus
 * a lightweight view of the latest asset (for admin hints).
 * TECH_SPECS §4, Checkpoint 3B.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itemId } = await params;

  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const jobs = await prisma.processingJob.findMany({
    where: { itemId },
    orderBy: { createdAt: "desc" },
  });

  const latestAsset = await prisma.menuItemAsset.findFirst({
    where: { itemId },
    orderBy: { createdAt: "desc" },
    select: { glbUrl: true, usdzUrl: true },
  });

  return NextResponse.json({
    jobs,
    latestAsset,
  });
}
