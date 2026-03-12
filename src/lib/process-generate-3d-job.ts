import { prisma } from "./db";
import { tripoModelGenerator } from "@/lib/model-generator";
import { computeScaleFactor, type MeasurementType } from "@/lib/scale";
import type { Generate3DPayload } from "@/lib/queue";

/**
 * Process a generate-3d job: run Tripo generator, create MenuItemAsset, set item READY, update job status.
 */
export async function processGenerate3DJob(payload: Generate3DPayload): Promise<void> {
  const { itemId, version, processingJobId } = payload;

  await prisma.processingJob.update({
    where: { id: processingJobId },
    data: { status: "RUNNING" },
  });

  try {
    const item = await prisma.menuItem.findUniqueOrThrow({
      where: { id: itemId },
      include: {
        media: { orderBy: { sortOrder: "asc" } },
      },
    });
    const photoUrls = item.media.map((m) => m.url).filter(Boolean);
    if (photoUrls.length === 0) {
      throw new Error("Item has no photos; upload 6–12 photos before generating 3D");
    }

    const result = await tripoModelGenerator.generate(itemId, version, {
      photoUrls,
      measurementType: item.measurementType as MeasurementType,
      measurementValueCm: item.measurementValue,
    });

    const scaleFactor = computeScaleFactor(
      item.measurementType,
      item.measurementValue,
      result.bboxX,
      result.bboxY,
      result.bboxZ
    );

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
