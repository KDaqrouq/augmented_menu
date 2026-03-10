/**
 * Generator abstraction (TECH_SPECS §1, IMPLEMENTATION_PLAN Checkpoint 3C).
 * For v1, stub returns a preloaded sample model to unblock AR work.
 *
 * Phase 8A: Compression pipeline hook.
 * Replace with real implementation: Draco/Meshopt for GLB, texture compression.
 */

export type ModelGeneratorResult = {
  glbUrl: string;
  usdzUrl?: string | null;
  units: string;
  bboxX: number;
  bboxY: number;
  bboxZ: number;
};

export interface ModelGenerator {
  generate(itemId: string, version: number): Promise<ModelGeneratorResult>;
}

/**
 * Optional compression hook (Phase 8A). Call after generate() to compress output.
 * Stub: no-op. Real impl: run gltf-transform, Draco, texture compression.
 */
export async function compressAsset(
  _glbPath: string,
  _version: number
): Promise<string> {
  return _glbPath;
}

/**
 * Stub generator: returns a fixed sample GLB and bbox (1m cube) for testing.
 * Replace with real photogrammetry/AI pipeline later.
 */
export const stubModelGenerator: ModelGenerator = {
  async generate(_itemId: string, _version: number): Promise<ModelGeneratorResult> {
    const sampleGlb =
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Box/glTF/Box.glb";
    return {
      glbUrl: sampleGlb,
      usdzUrl: null,
      units: "meters",
      bboxX: 1,
      bboxY: 1,
      bboxZ: 1,
    };
  },
};
