import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueGenerate3D } from "@/lib/queue";
import { isCompressionEnabledFromEnv } from "@/lib/compress-asset";
import { MIN_PHOTOS_FOR_3D } from "@/lib/process-generate-3d-job";

/** A queued/running job that has not been touched for this long is treated as dead (worker crash). */
const STALE_JOB_MS = 45 * 60 * 1000;

/**
 * POST /api/admin/items/[id]/generate-3d
 * Creates a ProcessingJob, sets the item to PROCESSING with a new version, and enqueues the job.
 * Refuses while another generation for the item is still active, or with fewer than 4 photos.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await params;

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: { arAssetVersion: true, _count: { select: { media: true } } },
  });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item._count.media < MIN_PHOTOS_FOR_3D) {
    return NextResponse.json(
      { error: `Upload at least ${MIN_PHOTOS_FOR_3D} photos (front, left, back, right) first.` },
      { status: 400 }
    );
  }

  const active = await prisma.processingJob.findFirst({
    where: {
      itemId,
      status: { in: ["QUEUED", "RUNNING"] },
      updatedAt: { gt: new Date(Date.now() - STALE_JOB_MS) },
    },
    select: { id: true },
  });
  if (active) {
    return NextResponse.json({ error: "A 3D model is already being generated for this item." }, { status: 409 });
  }

  // Claim the next version atomically so two clicks cannot both start a job.
  const version = item.arAssetVersion + 1;
  const { count } = await prisma.menuItem.updateMany({
    where: { id: itemId, arAssetVersion: item.arAssetVersion },
    data: { arAssetStatus: "PROCESSING", arAssetVersion: version },
  });
  if (count === 0) {
    return NextResponse.json({ error: "A 3D model is already being generated for this item." }, { status: 409 });
  }

  // Older jobs that were stuck are closed out so the history stays truthful.
  await prisma.processingJob.updateMany({
    where: { itemId, status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "FAILED", errorMessage: "Stopped responding; replaced by a newer generation." },
  });

  const job = await prisma.processingJob.create({
    data: { itemId, version, status: "QUEUED" },
  });

  try {
    await enqueueGenerate3D({
      type: "generate-3d",
      itemId,
      version,
      processingJobId: job.id,
      enableCompression: isCompressionEnabledFromEnv(),
    });
  } catch (e) {
    console.error("[generate-3d] Failed to enqueue:", e);
    await prisma.processingJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: "Failed to enqueue job (is Redis reachable?)" },
    });
    await prisma.menuItem.updateMany({
      where: { id: itemId, arAssetVersion: version },
      data: { arAssetStatus: "FAILED" },
    });
    return NextResponse.json({ error: "Failed to enqueue job" }, { status: 500 });
  }

  return NextResponse.json({ jobId: job.id, itemId, version, status: "QUEUED" });
}
