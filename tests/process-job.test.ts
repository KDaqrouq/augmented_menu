import { test } from "node:test";
import assert from "node:assert/strict";
import { UnrecoverableError } from "bullmq";
import { processGenerate3DJob, type ProcessJobDeps } from "@/lib/process-generate-3d-job";
import type { ModelGenerator, ModelGeneratorContext } from "@/lib/model-generator";

type Row = Record<string, unknown>;

/** Minimal in-memory stand-in for the Prisma calls the job makes. */
function fakeDb(opts: { photos: number; itemVersion: number; job?: Row; assets?: Row[] }) {
  const item = { id: "item-1", arAssetVersion: opts.itemVersion, arAssetStatus: "PROCESSING" };
  const job: Row = { id: "job-1", tripoBaseTaskId: null, tripoLowpolyTaskId: null, tripoUsdzTaskId: null, ...opts.job };
  const assets: Row[] = [...(opts.assets ?? [])];
  const jobUpdates: Row[] = [];
  const db = {
    processingJob: {
      update: async ({ data }: { data: Row }) => {
        jobUpdates.push(data);
        Object.assign(job, data);
        return { ...job };
      },
    },
    menuItem: {
      findUnique: async () => ({
        ...item,
        measurementType: "PLATE_DIAMETER_CM",
        measurementValue: 28,
        media: Array.from({ length: opts.photos }, (_, i) => ({ url: `https://img/${i}.jpg` })),
      }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (where.arAssetVersion !== item.arAssetVersion) return { count: 0 };
        Object.assign(item, data);
        return { count: 1 };
      },
    },
    menuItemAsset: {
      create: async ({ data }: { data: Row }) => {
        assets.push({ id: `asset-${data.version}`, ...data });
        return data;
      },
      findMany: async ({ where }: { where: { version: { lt: number } } }) =>
        assets.filter((a) => (a.version as number) < where.version.lt),
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        for (const id of where.id.in) assets.splice(assets.findIndex((a) => a.id === id), 1);
        return { count: where.id.in.length };
      },
    },
  };
  return { db, item, job, assets, jobUpdates };
}

function fakeGenerator(behavior: (ctx: ModelGeneratorContext) => Promise<void> = async () => {}) {
  const calls: ModelGeneratorContext[] = [];
  const generator: ModelGenerator = {
    async generate(_itemId, version, ctx) {
      calls.push(ctx);
      await behavior(ctx);
      return {
        glbUrl: `https://cdn/v${version}/model.glb`,
        usdzUrl: `https://cdn/v${version}/model.usdz`,
        arGlbUrl: `https://cdn/v${version}/model-ar.glb`,
        units: "meters",
        bboxX: 1,
        bboxY: 0.2,
        bboxZ: 1,
        scaleFactor: 0.28,
      };
    },
  };
  return { generator, calls };
}

const payload = { type: "generate-3d" as const, itemId: "item-1", version: 2, processingJobId: "job-1" };

test("success marks the item READY and removes older model versions", async () => {
  const f = fakeDb({ photos: 4, itemVersion: 2, assets: [{ id: "asset-1", version: 1 }] });
  const g = fakeGenerator();
  const deleted: number[] = [];
  const deps = { db: f.db, generator: g.generator, deleteVersionFiles: async (_: string, v: number) => void deleted.push(v) };

  await processGenerate3DJob(payload, { isFinalAttempt: true }, deps as unknown as ProcessJobDeps);

  assert.equal(f.item.arAssetStatus, "READY");
  assert.equal(f.job.status, "SUCCEEDED");
  assert.deepEqual(f.assets.map((a) => a.version), [2]);
  assert.equal(f.assets[0].arGlbUrl, "https://cdn/v2/model-ar.glb");
  assert.equal(f.assets[0].scaleFactor, 0.28);
  assert.deepEqual(deleted, [1]);
});

test("an older job finishing late does not overwrite a newer generation", async () => {
  const f = fakeDb({ photos: 4, itemVersion: 3 });
  const g = fakeGenerator();
  const deps = { db: f.db, generator: g.generator, deleteVersionFiles: async () => {} };

  await processGenerate3DJob(payload, { isFinalAttempt: true }, deps as unknown as ProcessJobDeps);

  assert.equal(f.item.arAssetVersion, 3);
  assert.equal(f.item.arAssetStatus, "PROCESSING");
  assert.equal(f.job.status, "SUCCEEDED");
});

test("fewer than 4 photos fails immediately without calling Tripo", async () => {
  const f = fakeDb({ photos: 3, itemVersion: 2 });
  const g = fakeGenerator();
  const deps = { db: f.db, generator: g.generator, deleteVersionFiles: async () => {} };

  await assert.rejects(
    processGenerate3DJob(payload, { isFinalAttempt: false }, deps as unknown as ProcessJobDeps),
    (err) => err instanceof UnrecoverableError
  );
  assert.equal(g.calls.length, 0);
  assert.equal(f.job.status, "FAILED");
  assert.equal(f.item.arAssetStatus, "FAILED");
});

test("a retryable failure keeps the item PROCESSING and the job queued", async () => {
  const f = fakeDb({ photos: 4, itemVersion: 2 });
  const g = fakeGenerator(async () => {
    throw new Error("Tripo timed out");
  });
  const deps = { db: f.db, generator: g.generator, deleteVersionFiles: async () => {} };

  await assert.rejects(processGenerate3DJob(payload, { isFinalAttempt: false, attempt: 1 }, deps as unknown as ProcessJobDeps));
  assert.equal(f.item.arAssetStatus, "PROCESSING");
  assert.equal(f.job.status, "QUEUED");
  assert.match(String(f.job.errorMessage), /Attempt 1 failed, retrying/);

  await assert.rejects(processGenerate3DJob(payload, { isFinalAttempt: true, attempt: 3 }, deps as unknown as ProcessJobDeps));
  assert.equal(f.item.arAssetStatus, "FAILED");
  assert.equal(f.job.status, "FAILED");
});

test("stored Tripo task ids are handed to the generator and new ones are saved", async () => {
  const f = fakeDb({ photos: 4, itemVersion: 2, job: { tripoBaseTaskId: "base-1" } });
  const g = fakeGenerator(async (ctx) => {
    await ctx.onTaskCreated?.("lowpoly", "low-9");
  });
  const deps = { db: f.db, generator: g.generator, deleteVersionFiles: async () => {} };

  await processGenerate3DJob(payload, { isFinalAttempt: true }, deps as unknown as ProcessJobDeps);

  assert.equal(g.calls[0].resume?.baseTaskId, "base-1");
  assert.ok(f.jobUpdates.some((u) => u.tripoLowpolyTaskId === "low-9"));
});
