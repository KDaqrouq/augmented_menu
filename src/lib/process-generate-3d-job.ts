import { UnrecoverableError } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { tripoModelGenerator, type ModelGenerator } from "./model-generator";
import type { TripoStage } from "./tripo";
import { cleanupStorage, deleteStorageFolder, itemAssetVersionPrefix } from "./supabase";
import type { Generate3DPayload } from "./queue";

export const MIN_PHOTOS_FOR_3D = 4;

type Db = Pick<PrismaClient, "processingJob" | "menuItem" | "menuItemAsset">;

export type ProcessJobDeps = {
  db: Db;
  generator: ModelGenerator;
  deleteVersionFiles: (itemId: string, version: number) => Promise<void>;
};

const defaultDeps: ProcessJobDeps = {
  db: prisma,
  generator: tripoModelGenerator,
  deleteVersionFiles: (itemId, version) => deleteStorageFolder(itemAssetVersionPrefix(itemId, version)),
};

const STAGE_COLUMN: Record<TripoStage, "tripoBaseTaskId" | "tripoLowpolyTaskId" | "tripoUsdzTaskId"> = {
  base: "tripoBaseTaskId",
  lowpoly: "tripoLowpolyTaskId",
  usdz: "tripoUsdzTaskId",
};

/**
 * Process a generate-3d job: run the generator, create MenuItemAsset, mark the item READY, update job status.
 *
 * - Tripo task ids are saved on the ProcessingJob as they are created, so a BullMQ retry
 *   polls the existing (already paid) tasks instead of starting over.
 * - Errors that cannot succeed on retry (bad input) throw UnrecoverableError, so BullMQ stops.
 * - Item status only changes if this job is still the item's current version; a slower,
 *   older job can never overwrite a newer one.
 */
export async function processGenerate3DJob(
  payload: Generate3DPayload,
  options: { isFinalAttempt?: boolean; attempt?: number } = {},
  deps: ProcessJobDeps = defaultDeps
): Promise<void> {
  const { itemId, version, processingJobId } = payload;
  const { db, generator } = deps;

  const job = await db.processingJob.update({
    where: { id: processingJobId },
    data: { status: "RUNNING", errorMessage: null },
  });

  try {
    const item = await db.menuItem.findUnique({
      where: { id: itemId },
      include: { media: { orderBy: { sortOrder: "asc" } } },
    });
    if (!item) throw new UnrecoverableError("Item was deleted before its 3D model was generated.");

    const photoUrls = item.media.map((m) => m.url).filter(Boolean);
    if (photoUrls.length < MIN_PHOTOS_FOR_3D) {
      throw new UnrecoverableError(
        `Item needs at least ${MIN_PHOTOS_FOR_3D} photos before generating 3D. The first 4 are used in order as front, left, back, right; 6–12 total is recommended.`
      );
    }

    const result = await generator.generate(itemId, version, {
      photoUrls,
      measurementType: item.measurementType,
      measurementValueCm: item.measurementValue,
      enableCompression: payload.enableCompression,
      resume: {
        baseTaskId: job.tripoBaseTaskId,
        lowpolyTaskId: job.tripoLowpolyTaskId,
        usdzTaskId: job.tripoUsdzTaskId,
      },
      onTaskCreated: async (stage, taskId) => {
        await db.processingJob.update({
          where: { id: processingJobId },
          data: { [STAGE_COLUMN[stage]]: taskId },
        });
      },
    });

    await db.menuItemAsset.create({
      data: {
        itemId,
        version,
        glbUrl: result.glbUrl,
        usdzUrl: result.usdzUrl ?? null,
        arGlbUrl: result.arGlbUrl ?? null,
        units: result.units,
        bboxX: result.bboxX,
        bboxY: result.bboxY,
        bboxZ: result.bboxZ,
        scaleFactor: result.scaleFactor,
      },
    });

    const { count: isCurrent } = await db.menuItem.updateMany({
      where: { id: itemId, arAssetVersion: version },
      data: { arAssetStatus: "READY" },
    });

    await db.processingJob.update({
      where: { id: processingJobId },
      data: {
        status: "SUCCEEDED",
        errorMessage: isCurrent ? null : "Finished after a newer generation was started; kept as a fallback.",
      },
    });

    if (isCurrent) await removeOlderVersions(itemId, version, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const willRetry = !(error instanceof UnrecoverableError) && options.isFinalAttempt === false;

    await db.processingJob.update({
      where: { id: processingJobId },
      data: willRetry
        ? { status: "QUEUED", errorMessage: `Attempt ${options.attempt ?? 1} failed, retrying: ${message}` }
        : { status: "FAILED", errorMessage: message },
    });
    if (!willRetry) {
      await db.menuItem.updateMany({
        where: { id: itemId, arAssetVersion: version },
        data: { arAssetStatus: "FAILED" },
      });
    }
    throw error;
  }
}

/** Keep only the newest model: delete older asset rows and their files. */
async function removeOlderVersions(itemId: string, version: number, deps: ProcessJobDeps): Promise<void> {
  const older = await deps.db.menuItemAsset.findMany({
    where: { itemId, version: { lt: version } },
    select: { id: true, version: true },
  });
  if (older.length === 0) return;
  await deps.db.menuItemAsset.deleteMany({ where: { id: { in: older.map((a) => a.id) } } });
  for (const v of new Set(older.map((a) => a.version))) {
    await cleanupStorage(`item ${itemId} v${v}`, () => deps.deleteVersionFiles(itemId, v));
  }
}
