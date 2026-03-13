/**
 * Model generator abstraction (TECH_SPECS §1).
 * TripoModelGenerator: image-to-3D via Tripo API, uploads to our storage, returns GLB/USDZ URLs and bbox.
 */

import { convertModelToUsdZ, generateFromImages } from "./tripo";
import { getGlbBboxFromBuffer } from "./glb-bbox";
import { getSupabaseStorageBucket, uploadAssetFile } from "./supabase";
import { compressGlbBuffer, logAssetSize, getMaxAssetBytes } from "./compress-asset";
import { computeScaleFactor, type MeasurementType } from "./scale";

export type ModelGeneratorResult = {
  glbUrl: string;
  usdzUrl?: string | null;
  units: string;
  bboxX: number;
  bboxY: number;
  bboxZ: number;
};

export type ModelGeneratorContext = {
  photoUrls: string[];
  measurementType: MeasurementType;
  measurementValueCm: number;
};

export interface ModelGenerator {
  generate(
    itemId: string,
    version: number,
    context?: ModelGeneratorContext
  ): Promise<ModelGeneratorResult>;
}

/**
 * Download a URL to a Buffer and log its size.
 */
async function downloadToBuffer(url: string, label: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  logAssetSize(label, buf);
  return buf;
}

/**
 * Tripo-based generator: uses item photos, calls Tripo API, stores GLB/USDZ in Supabase, computes bbox.
 */
export const tripoModelGenerator: ModelGenerator = {
  async generate(itemId, version, context): Promise<ModelGeneratorResult> {
    const photoUrls = context?.photoUrls ?? [];
    const measurementType = context?.measurementType;
    const measurementValueCm = context?.measurementValueCm;

    if (photoUrls.length < 4) {
      throw new Error(
        "At least 4 photos are required for Tripo generation. The first 4 must be [front, left, back, right]."
      );
    }

    if (!measurementType || typeof measurementValueCm !== "number") {
      throw new Error("measurementType and measurementValueCm are required for Tripo generation");
    }

    const { glbUrl: tripoGlbUrl, baseTaskId } = await generateFromImages(photoUrls, {
      timeoutMs: 300000,
    });

    const bucket = getSupabaseStorageBucket();
    const basePath = `assets/items/${itemId}/v${version}`;
    const glbPath = `${basePath}/model.glb`;
    const usdzPath = `${basePath}/model.usdz`;

    // Download original GLB from Tripo and log size.
    const originalGlbBuffer = await downloadToBuffer(tripoGlbUrl, "Tripo GLB (original)");

    // Compute bbox from original (unquantized) GLB so scale is correct in AR.
    const bbox = await getGlbBboxFromBuffer(originalGlbBuffer);

    // Compute scale factor once we know bbox & measurement so we can:
    // - store it in MenuItemAsset (via process-generate-3d-job.ts)
    // - and pass it to Tripo's convert_model scale_factor for USDZ.
    const scaleFactor = computeScaleFactor(
      measurementType,
      measurementValueCm,
      bbox.bboxX,
      bbox.bboxY,
      bbox.bboxZ
    );

    // Compress GLB before upload; enforce size cap.
    const maxBytes = getMaxAssetBytes();
    const compressedGlbBuffer = await compressGlbBuffer(originalGlbBuffer, {
      targetMaxBytes: maxBytes,
    });

    const glbUrl = await uploadAssetFile(
      bucket,
      glbPath,
      compressedGlbBuffer,
      "model/gltf-binary"
    );

    let usdzUrl: string | null = null;
    try {
      // Ask Tripo to convert the base model task to USDZ, using the same
      // scaleFactor we apply in WebXR so Quick Look size matches.
      const tripoUsdzUrl = await convertModelToUsdZ(baseTaskId, {
        timeoutMs: 300000,
        scaleFactor,
      });

      if (tripoUsdzUrl) {
        const usdzBuffer = await downloadToBuffer(tripoUsdzUrl, "Tripo USDZ (scaled via convert_model)");
        const maxBytesUsdz = getMaxAssetBytes();
        if (usdzBuffer.byteLength > maxBytesUsdz) {
          console.warn(
            `[compress-asset] USDZ too large after Tripo generation: ${(usdzBuffer.byteLength / (1024 * 1024)).toFixed(
              2
            )} MB (cap ${(maxBytesUsdz / (1024 * 1024)).toFixed(
              2
            )} MB). Skipping USDZ upload; iOS will use 3D fallback.`
          );
          usdzUrl = null;
        } else {
          usdzUrl = await uploadAssetFile(
            bucket,
            usdzPath,
            usdzBuffer,
            "model/vnd.usdz+zip"
          );
        }
      }
    } catch (err) {
      console.warn(
        "[tripoModelGenerator] USDZ conversion via convert_model failed; continuing with GLB only:",
        err instanceof Error ? err.message : String(err)
      );
      usdzUrl = null;
    }

    return {
      glbUrl,
      usdzUrl,
      units: "meters",
      bboxX: bbox.bboxX,
      bboxY: bbox.bboxY,
      bboxZ: bbox.bboxZ,
    };
  },
};
