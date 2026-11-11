/**
 * Compute the axis-aligned bounding box of a GLB (in meters); required for scale.ts.
 *
 * Uses glTF-Transform getBounds() so the bbox accounts for node transforms
 * (translation, rotation, scale). Tripo and others often apply a root node
 * scale (e.g. 0.5); positions-only bounds would be wrong and break AR scale.
 *
 * Server-safe: glTF-Transform only, no three.js or browser APIs.
 */

import { getBounds, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

export type GlbBbox = { bboxX: number; bboxY: number; bboxZ: number };

async function computeBboxFromDocument(buffer: Buffer): Promise<GlbBbox> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(buffer);
  const root = document.getRoot();

  const scene = root.getDefaultScene() ?? root.listScenes()[0] ?? null;
  if (!scene) {
    throw new Error("GLB has no scene; cannot compute bbox");
  }

  const bounds = getBounds(scene);
  const { min, max } = bounds;

  const bboxX = max[0] - min[0];
  const bboxY = max[1] - min[1];
  const bboxZ = max[2] - min[2];

  if (!Number.isFinite(bboxX) || !Number.isFinite(bboxY) || !Number.isFinite(bboxZ)) {
    throw new Error("GLB has no POSITION data or bounds are invalid; cannot compute bbox");
  }

  return { bboxX, bboxY, bboxZ };
}

/**
 * Compute bbox from a GLB buffer (e.g. original Tripo output before compression).
 * Use this in the worker so bbox is in real meter space, not quantized.
 */
export async function getGlbBboxFromBuffer(buffer: Buffer): Promise<GlbBbox> {
  return await computeBboxFromDocument(buffer);
}
