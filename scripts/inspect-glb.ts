import { NodeIO, type vec3 } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import type { mat4 } from "@gltf-transform/core/dist/constants.js";
import { transformMat4 } from "gl-matrix/vec3";

type Bbox = { min: vec3; max: vec3 };

function formatVec3(v: vec3): string {
  return `[${v[0].toFixed(6)}, ${v[1].toFixed(6)}, ${v[2].toFixed(6)}]`;
}

function expandBbox(bbox: Bbox, p: vec3): void {
  bbox.min[0] = Math.min(bbox.min[0], p[0]);
  bbox.min[1] = Math.min(bbox.min[1], p[1]);
  bbox.min[2] = Math.min(bbox.min[2], p[2]);
  bbox.max[0] = Math.max(bbox.max[0], p[0]);
  bbox.max[1] = Math.max(bbox.max[1], p[1]);
  bbox.max[2] = Math.max(bbox.max[2], p[2]);
}

function bboxDims(b: Bbox): vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

function createEmptyBbox(): Bbox {
  return {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  };
}

function cornersFromMinMax(min: vec3, max: vec3): vec3[] {
  return [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
  ];
}

async function fetchGlb(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch GLB: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function approxEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

function isNonIdentityScale(s: vec3): boolean {
  return !(approxEqual(s[0], 1) && approxEqual(s[1], 1) && approxEqual(s[2], 1));
}

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: npx tsx scripts/inspect-glb.ts <glbUrl>");
    process.exit(1);
  }

  console.log(`Downloading GLB…`);
  const buffer = await fetchGlb(url);
  console.log(`Downloaded ${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB`);

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(buffer);
  const root = document.getRoot();

  const scenes = root.listScenes();
  console.log(`Scenes: ${scenes.length}`);
  console.log(`Nodes: ${root.listNodes().length}`);
  console.log(`Meshes: ${root.listMeshes().length}`);

  // 1) Print suspicious node scaling (local + world).
  const scaledNodes = root
    .listNodes()
    .map((n) => ({
      name: n.getName() || "(unnamed)",
      node: n,
      localScale: n.getScale(),
      worldScale: n.getWorldScale(),
      hasMesh: !!n.getMesh(),
    }))
    .filter((x) => isNonIdentityScale(x.localScale) || isNonIdentityScale(x.worldScale));

  console.log("");
  console.log(`Nodes with non-identity scale (local or world): ${scaledNodes.length}`);
  for (const x of scaledNodes.slice(0, 50)) {
    console.log(
      `- ${x.name}  local=${formatVec3(x.localScale)}  world=${formatVec3(x.worldScale)}  mesh=${x.hasMesh}`
    );
  }
  if (scaledNodes.length > 50) {
    console.log(`(showing first 50; total ${scaledNodes.length})`);
  }

  // 2) Compute positions-only bbox (current behavior in src/lib/glb-bbox.ts).
  const posOnly = createEmptyBbox();
  let posOnlyPrimCount = 0;

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute("POSITION");
      if (!position) continue;
      const aMin = position.getMin([]) as vec3 | null;
      const aMax = position.getMax([]) as vec3 | null;
      if (!aMin || !aMax) continue;
      posOnlyPrimCount++;
      expandBbox(posOnly, aMin);
      expandBbox(posOnly, aMax);
    }
  }

  // 3) Compute transform-aware world bbox (apply each node's world matrix to its primitive bounds).
  const worldB = createEmptyBbox();
  let worldPrimCount = 0;

  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;

    const wm = node.getWorldMatrix() as unknown as mat4;
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute("POSITION");
      if (!position) continue;
      const aMin = position.getMin([]) as vec3 | null;
      const aMax = position.getMax([]) as vec3 | null;
      if (!aMin || !aMax) continue;
      worldPrimCount++;

      for (const c of cornersFromMinMax(aMin, aMax)) {
        const out: vec3 = [0, 0, 0];
        transformMat4(out as unknown as [number, number, number], c as unknown as [number, number, number], wm);
        expandBbox(worldB, out);
      }
    }
  }

  const posDims = bboxDims(posOnly);
  const worldDims = bboxDims(worldB);

  console.log("");
  console.log(`Positions-only bbox (ignores node transforms) from ${posOnlyPrimCount} prims:`);
  console.log(`- min=${formatVec3(posOnly.min)} max=${formatVec3(posOnly.max)} dims=${formatVec3(posDims)}`);
  console.log(`World (transform-aware) bbox from ${worldPrimCount} prims:`);
  console.log(`- min=${formatVec3(worldB.min)} max=${formatVec3(worldB.max)} dims=${formatVec3(worldDims)}`);

  console.log("");
  console.log("Mismatch ratio (world / positions-only):");
  console.log(
    `- x=${(worldDims[0] / posDims[0]).toFixed(6)} y=${(worldDims[1] / posDims[1]).toFixed(6)} z=${(worldDims[2] / posDims[2]).toFixed(6)}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

