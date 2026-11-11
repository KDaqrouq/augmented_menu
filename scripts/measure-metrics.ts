/**
 * Measures the numbers quoted in docs/metrics.md from the real database and storage.
 * Read-only: it lists and downloads files and runs SELECT queries. Nothing is written
 * to the database or the bucket, and no Tripo tasks are created.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/measure-metrics.ts [--cache <dir>] [--json <file>] [--out <file.md>]
 *
 * Downloads are cached (default: <os tmp>/aug-reality-metrics) so reruns are quick.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { NodeIO, getBounds, Primitive, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import * as THREE from "three";
import { compressGlbBuffer } from "@/lib/compress-asset";
import { getModelDimensionMeters } from "@/lib/scale";
import type { MeasurementType } from "@/lib/measurement";

const args = process.argv.slice(2);
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const CACHE = argValue("--cache") ?? join(tmpdir(), "aug-reality-metrics");
const JSON_OUT = argValue("--json");
const MD_OUT = argValue("--out");
mkdirSync(CACHE, { recursive: true });

const FACE_LIMIT = 15000; // faceLimit passed to Tripo in src/lib/model-generator.ts
const MB = 1024 * 1024;

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const bucket = process.env.SUPABASE_STORAGE_BUCKET!;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// ---------- helpers ----------

const pct = (a: number, b: number) => (100 * (a - b)) / b;
const round = (n: number, d = 2) => Number(n.toFixed(d));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
function quantile(xs: number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
}
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

type StoredFile = { path: string; size: number; createdAt: string };

async function listFiles(prefix: string): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${prefix}: ${error.message}`);
  for (const e of data ?? []) {
    const p = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null) out.push(...(await listFiles(p)));
    else out.push({ path: p, size: Number((e.metadata as { size?: number })?.size ?? 0), createdAt: e.created_at });
  }
  return out;
}

async function download(path: string): Promise<Buffer> {
  const local = join(CACHE, path.replace(/[\\/]/g, "__"));
  if (existsSync(local)) return readFileSync(local);
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`download ${path}: ${error?.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  writeFileSync(local, buf);
  return buf;
}

function storagePathFromUrl(url: string): string {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split("?")[0]) : url;
}

type GlbStats = {
  bytes: number;
  quantized: boolean;
  triangles: number;
  vertices: number;
  textures: number;
  textureBytes: number;
  maxTexturePx: number;
  size: [number, number, number];
};

function glbStatsFromDocument(doc: Document, bytes: number): GlbStats {
  let triangles = 0;
  let vertices = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const positions = prim.getAttribute("POSITION")?.getCount() ?? 0;
      vertices += positions;
      if (prim.getMode() === Primitive.Mode.TRIANGLES) {
        triangles += (prim.getIndices()?.getCount() ?? positions) / 3;
      }
    }
  }
  let textureBytes = 0;
  let maxTexturePx = 0;
  const textures = doc.getRoot().listTextures();
  for (const t of textures) {
    textureBytes += t.getImage()?.byteLength ?? 0;
    const [w, h] = t.getSize() ?? [0, 0];
    maxTexturePx = Math.max(maxTexturePx, w, h);
  }
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  return {
    bytes,
    quantized: doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === "KHR_mesh_quantization"),
    triangles,
    vertices,
    textures: textures.length,
    textureBytes,
    maxTexturePx,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

async function glbStats(buf: Buffer): Promise<GlbStats> {
  return glbStatsFromDocument(await io.readBinary(new Uint8Array(buf)), buf.byteLength);
}

let usdLoaderPromise: Promise<{ parse: (buf: ArrayBuffer) => THREE.Object3D }> | null = null;
/** three.js USDLoader with texture decoding stubbed out (Node has no Image); geometry is all we need. */
function getUsdLoader() {
  usdLoaderPromise ??= (async () => {
    const composer = await import("three/examples/jsm/loaders/usd/USDComposer.js" as string);
    composer.USDComposer.prototype._loadTexture = () => new THREE.Texture();
    const { USDLoader } = await import("three/examples/jsm/loaders/USDLoader.js" as string);
    return new USDLoader();
  })();
  return usdLoaderPromise;
}

async function usdzStats(buf: Buffer): Promise<{ bytes: number; triangles: number; size: [number, number, number] }> {
  const loader = await getUsdLoader();
  const group = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  group.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  let triangles = 0;
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const g = mesh.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return { bytes: buf.byteLength, triangles, size: [s.x, s.y, s.z] };
}

/** Real-world size of a dish along the axis its measurement describes, given model size in meters. */
function measuredDim(type: MeasurementType, [x, y, z]: [number, number, number]) {
  return getModelDimensionMeters(type, x, y, z);
}

function table(headers: string[], rows: (string | number)[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function countLines(dir: string, exts: string[]): { files: number; lines: number } {
  let files = 0;
  let lines = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      const sub = countLines(p, exts);
      files += sub.files;
      lines += sub.lines;
    } else if (exts.some((e) => name.endsWith(e))) {
      files += 1;
      lines += readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).length;
    }
  }
  return { files, lines };
}

// ---------- main ----------

async function main() {
  const report: string[] = [];
  const json: Record<string, unknown> = {};
  const say = (s = "") => report.push(s);

  // 1. Every stored GLB: is it compressed? If not, compress it now (in memory) and compare.
  const files = await listFiles("assets/items");
  const glbFiles = files.filter((f) => f.path.endsWith("/model.glb"));
  const compression: {
    path: string;
    before: GlbStats;
    after: GlbStats;
    reductionPct: number;
    bboxMaxDiffPct: number;
  }[] = [];
  const alreadyCompressed: string[] = [];
  for (const f of glbFiles) {
    const buf = await download(f.path);
    const before = await glbStats(buf);
    if (before.quantized) {
      alreadyCompressed.push(f.path);
      continue;
    }
    const compressed = await compressGlbBuffer(buf, { enableCompression: true, targetMaxBytes: Number.MAX_SAFE_INTEGER });
    const after = await glbStats(compressed);
    const bboxMaxDiffPct = Math.max(...before.size.map((v, i) => Math.abs(pct(after.size[i], v))));
    compression.push({ path: f.path, before, after, reductionPct: -pct(after.bytes, before.bytes), bboxMaxDiffPct });
  }
  json.compression = compression;

  say("## 1. glTF compression (dedup, prune, quantize)");
  say();
  say(
    `Stored GLBs: ${glbFiles.length}. Uncompressed (no KHR_mesh_quantization): ${compression.length}, ` +
      `re-run through compressGlbBuffer here. Already compressed when stored: ${alreadyCompressed.length} ` +
      `(their originals are not kept, so they are not in this sample).`
  );
  say();
  if (compression.length) {
    say(
      table(
        ["file", "before MB", "after MB", "reduction", "triangles before/after", "vertices before/after", "bbox max diff"],
        compression.map((c) => [
          c.path.replace("assets/items/", ""),
          round(c.before.bytes / MB),
          round(c.after.bytes / MB),
          `${round(c.reductionPct, 1)}%`,
          `${c.before.triangles}/${c.after.triangles}`,
          `${c.before.vertices}/${c.after.vertices}`,
          `${round(c.bboxMaxDiffPct, 3)}%`,
        ])
      )
    );
    const r = compression.map((c) => c.reductionPct);
    const geom = compression.map((c) => {
      const gb = c.before.bytes - c.before.textureBytes;
      const ga = c.after.bytes - c.after.textureBytes;
      return -pct(ga, gb);
    });
    say();
    say(
      `Whole-file reduction: mean ${round(mean(r), 1)}%, median ${round(median(r), 1)}%, ` +
        `range ${round(Math.min(...r), 1)}% to ${round(Math.max(...r), 1)}% (N=${r.length}).`
    );
    say(
      `Non-texture bytes (geometry + JSON) reduction: mean ${round(mean(geom), 1)}%, median ${round(median(geom), 1)}% ` +
        `(textures are copied as-is, so they dilute the whole-file number).`
    );
    say(
      `Triangle and vertex counts unchanged in ${compression.filter((c) => c.before.triangles === c.after.triangles && c.before.vertices >= c.after.vertices).length}/${compression.length}; ` +
        `largest bounding-box change ${round(Math.max(...compression.map((c) => c.bboxMaxDiffPct)), 3)}%.`
    );
    json.compressionSummary = { n: r.length, mean: mean(r), median: median(r), min: Math.min(...r), max: Math.max(...r), geomMean: mean(geom) };
  }
  say();

  // 2 + 3. Live assets: size, triangle budget, and scale accuracy across formats.
  const items = await prisma.menuItem.findMany({
    where: { arAssetStatus: "READY" },
    select: {
      id: true,
      name: true,
      measurementType: true,
      measurementValue: true,
      arAssetVersion: true,
      assets: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  const maxAssetMb = Number(process.env.MAX_ASSET_MB) || 25;
  const live: Record<string, unknown>[] = [];
  for (const item of items) {
    const asset = item.assets[0];
    if (!asset) continue;
    const target = item.measurementValue / 100;
    const type = item.measurementType as MeasurementType;
    const web = await glbStats(await download(storagePathFromUrl(asset.glbUrl)));
    const webScaled = web.size.map((v) => v * asset.scaleFactor) as [number, number, number];
    const android = asset.arGlbUrl ? await glbStats(await download(storagePathFromUrl(asset.arGlbUrl))) : null;
    const usdz = asset.usdzUrl ? await usdzStats(await download(storagePathFromUrl(asset.usdzUrl))) : null;
    const err = (size: [number, number, number]) => pct(measuredDim(type, size), target);
    const crossFormat = [android?.size, usdz?.size]
      .filter((s): s is [number, number, number] => !!s)
      .flatMap((s) => s.map((v, i) => Math.abs(pct(v, webScaled[i]))));
    live.push({
      item: item.name,
      version: asset.version,
      measurement: `${item.measurementValue} cm ${type}`,
      impliedMeasurementAtGeneration: round(measuredDim(type, [asset.bboxX, asset.bboxY, asset.bboxZ]) * asset.scaleFactor * 100, 2),
      glbMb: web.bytes / MB,
      usdzMb: usdz ? usdz.bytes / MB : null,
      androidMb: android ? android.bytes / MB : null,
      triangles: web.triangles,
      usdzTriangles: usdz?.triangles ?? null,
      maxTexturePx: web.maxTexturePx,
      webErrPct: err(webScaled),
      androidErrPct: android ? err(android.size) : null,
      usdzErrPct: usdz ? err(usdz.size) : null,
      crossFormatMaxDiffPct: crossFormat.length ? Math.max(...crossFormat) : null,
      underCap: [web.bytes, usdz?.bytes ?? 0, android?.bytes ?? 0].every((b) => b <= maxAssetMb * MB),
    });
  }
  json.live = live;

  const fmt = (v: unknown, d = 2, suffix = "") =>
    typeof v === "number" && Number.isFinite(v) ? `${round(v, d)}${suffix}` : "n/a";
  say("## 2. Live models (one per dish with a ready 3D model)");
  say();
  say(
    table(
      ["dish", "v", "measurement", "GLB MB", "USDZ MB", "Android GLB MB", "triangles (cap 15k)", "max texture px", `all <= ${maxAssetMb} MB`],
      live.map((l) => [
        String(l.item),
        String(l.version),
        String(l.measurement),
        fmt(l.glbMb),
        fmt(l.usdzMb),
        fmt(l.androidMb),
        String(l.triangles),
        String(l.maxTexturePx),
        l.underCap ? "yes" : "no",
      ])
    )
  );
  const nums = (k: string) => live.map((l) => l[k]).filter((v): v is number => typeof v === "number");
  say();
  say(
    `Mean sizes: GLB ${fmt(mean(nums("glbMb")))} MB (N=${nums("glbMb").length}), USDZ ${fmt(mean(nums("usdzMb")))} MB ` +
      `(N=${nums("usdzMb").length}), Android GLB ${fmt(mean(nums("androidMb")))} MB (N=${nums("androidMb").length}). ` +
      `Triangles within the ${FACE_LIMIT} cap: ${nums("triangles").filter((t) => t <= FACE_LIMIT).length}/${nums("triangles").length}.`
  );
  say();
  say("## 3. Digital scale accuracy");
  say();
  say(
    table(
      ["dish", "entered", "implied at generation (cm)", "web GLB err", "Android GLB err", "USDZ err", "max cross-format diff"],
      live.map((l) => [
        String(l.item),
        String(l.measurement),
        fmt(l.impliedMeasurementAtGeneration),
        fmt(l.webErrPct, 3, "%"),
        fmt(l.androidErrPct, 3, "%"),
        fmt(l.usdzErrPct, 3, "%"),
        fmt(l.crossFormatMaxDiffPct, 3, "%"),
      ])
    )
  );
  const allErr = [...nums("webErrPct"), ...nums("androidErrPct"), ...nums("usdzErrPct")].map(Math.abs);
  say();
  say(
    `Max |error| over all formats: ${round(Math.max(...allErr), 3)}% (N=${allErr.length} format checks over ${live.length} dishes). ` +
      `Max cross-format difference: ${round(Math.max(...nums("crossFormatMaxDiffPct")), 3)}%.`
  );
  say();

  // 4. Pipeline jobs.
  const jobs = await prisma.processingJob.findMany({
    select: { status: true, createdAt: true, updatedAt: true, tripoBaseTaskId: true, tripoLowpolyTaskId: true, tripoUsdzTaskId: true },
  });
  const done = jobs.filter((j) => j.status === "SUCCEEDED");
  const minutes = done.map((j) => (j.updatedAt.getTime() - j.createdAt.getTime()) / 60000);
  const byStatus = Object.fromEntries(
    ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"].map((s) => [s, jobs.filter((j) => j.status === s).length])
  );
  json.jobs = { byStatus, minutes };
  say("## 4. Generation jobs");
  say();
  say(`Jobs: ${jobs.length} (${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(", ")}).`);
  if (minutes.length) {
    say(
      `Queued to ready (SUCCEEDED, N=${minutes.length}): median ${round(median(minutes), 1)} min, ` +
        `p90 ${round(quantile(minutes, 0.9), 1)} min, min ${round(Math.min(...minutes), 1)}, max ${round(Math.max(...minutes), 1)}.`
    );
  }
  const withIds = jobs.filter((j) => j.tripoBaseTaskId || j.tripoLowpolyTaskId || j.tripoUsdzTaskId).length;
  say(`Jobs with saved Tripo task ids (new resume code): ${withIds}.`);
  say();

  // 6. Analytics and codebase.
  const events = await prisma.analyticsEvent.groupBy({ by: ["eventName"], _count: { _all: true } });
  const range = await prisma.analyticsEvent.aggregate({ _min: { createdAt: true }, _max: { createdAt: true }, _count: true });
  const counts = Object.fromEntries(events.map((e) => [e.eventName, e._count._all]));
  json.analytics = { counts, range };
  say("## 6. Analytics events (all time)");
  say();
  say(
    `${range._count} events from ${range._min.createdAt?.toISOString().slice(0, 10)} to ${range._max.createdAt?.toISOString().slice(0, 10)}: ` +
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") +
      "."
  );
  say();

  const root = join(__dirname, "..");
  const src = countLines(join(root, "src"), [".ts", ".tsx"]);
  const tests = readdirSync(join(root, "tests")).filter((f) => f.endsWith(".test.ts"));
  const testCases = tests.reduce((n, f) => n + (readFileSync(join(root, "tests", f), "utf8").match(/^test\(/gm)?.length ?? 0), 0);
  const routes: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n === "route.ts") routes.push(relative(root, p));
    }
  };
  walk(join(root, "src", "app", "api"));
  json.codebase = { srcFiles: src.files, srcLines: src.lines, testFiles: tests.length, testCases, apiRoutes: routes.length };
  say("## Codebase");
  say();
  say(
    `src: ${src.files} TypeScript files, ${src.lines} non-blank lines. Tests: ${testCases} cases in ${tests.length} files. ` +
      `API route handlers: ${routes.length}.`
  );

  console.log(report.join("\n"));
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(json, null, 2));
  if (MD_OUT) writeFileSync(MD_OUT, report.join("\n") + "\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
