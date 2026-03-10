import { prisma } from "./db";
import { stubModelGenerator } from "@/lib/model-generator";
import type { Generate3DPayload } from "@/lib/queue";

/**
 * Process a generate-3d job: run generator, create MenuItemAsset, set item READY, update job status.
 */
export async function processGenerate3DJob(payload: Generate3DPayload): Promise<void> {
  const { itemId, version, processingJobId } = payload;

  await prisma.processingJob.update({
    where: { id: processingJobId },
    data: { status: "RUNNING" },
  });

  try {
    const result = await stubModelGenerator.generate(itemId, version);

    const scaleFactor = 1.0;

    await prisma.menuItemAsset.create({
      data: {
        itemId,
        version,
        glbUrl: result.glbUrl,
        usdzUrl: result.usdzUrl ?? null,
        units: result.units,
        bboxX: result.bboxX,
        bboxY: result.bboxY,
        bboxZ: result.bboxZ,
        scaleFactor,
      },
    });

    await prisma.menuItem.update({
      where: { id: itemId },
      data: { arAssetStatus: "READY", arAssetVersion: version },
    });

    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: { status: "SUCCEEDED", errorMessage: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: { status: "FAILED", errorMessage: message },
    });
    await prisma.menuItem.update({
      where: { id: itemId },
      data: { arAssetStatus: "FAILED" },
    });
    throw error;
  }
}
