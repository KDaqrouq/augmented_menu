import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueGenerate3D } from "@/lib/queue";
import { isCompressionEnabledFromEnv } from "@/lib/compress-asset";

/**
 * POST /api/admin/items/[id]/generate-3d
 * Creates ProcessingJob, sets item to PROCESSING, increments version, enqueues job.
 * TECH_SPECS §4, Checkpoint 3B.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itemId } = await params;

  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const version = item.arAssetVersion + 1;

  await prisma.menuItem.update({
    where: { id: itemId },
    data: { arAssetStatus: "PROCESSING", arAssetVersion: version },
  });

  const job = await prisma.processingJob.create({
    data: {
      itemId,
      version,
      status: "QUEUED",
    },
  });

  const enableCompression = isCompressionEnabledFromEnv();

  try {
    await enqueueGenerate3D({
      type: "generate-3d",
      itemId,
      version,
      processingJobId: job.id,
      enableCompression,
    });
  } catch (e) {
    await prisma.processingJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: "Failed to enqueue job" },
    });
    await prisma.menuItem.update({
      where: { id: itemId },
      data: { arAssetStatus: "FAILED" },
    });
    return NextResponse.json(
      { error: "Failed to enqueue job" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobId: job.id,
    itemId,
    version,
    status: "QUEUED",
  });
}
