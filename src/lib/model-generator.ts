/**
 * Model generator abstraction.
 * TripoModelGenerator: image-to-3D via Tripo API, uploads to our storage, returns GLB/USDZ URLs and bbox.
 */

import { convertModelToUsdZ, generateFromImages, type GenerateResume, type OnTaskCreated } from "./tripo";
import { getGlbBboxFromBuffer } from "./glb-bbox";
import { getSupabaseStorageBucket, itemAssetVersionPrefix, uploadAssetFile } from "./supabase";
import { bakeRealWorldScale, compressGlbBuffer, logAssetSize, getMaxAssetBytes } from "./compress-asset";
import { computeScaleFactor, type MeasurementType } from "./scale";

export type ModelGeneratorResult = {
  glbUrl: string;
  usdzUrl?: string | null;
  /** GLB with real-world scale baked in, for Android Scene Viewer (which has no scale parameter). */
  arGlbUrl?: string | null;
  units: string;
  bboxX: number;
  bboxY: number;
  bboxZ: number;
  /** Scale baked into the USDZ and the Android GLB. */
  scaleFactor: number;
};

export type ModelGeneratorContext = {
  photoUrls: string[];
  measurementType: MeasurementType;
  measurementValueCm: number;
  /** When provided, overrides env for GLB compression (from job payload, set on Vercel). */
  enableCompression?: boolean;
  /** Tripo task ids from an earlier attempt of the same job. */
  resume?: GenerateResume & { usdzTaskId?: string | null };
  onTaskCreated?: OnTaskCreated;
};

export interface ModelGenerator {
  generate(itemId: string, version: number, context: ModelGeneratorContext): Promise<ModelGeneratorResult>;
}

async function downloadToBuffer(url: string, label: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  logAssetSize(label, buf);
  return buf;
}

/**
 * Tripo-based generator: uses item photos, calls Tripo API, stores GLB/USDZ in Supabase, computes bbox.
 */
export const tripoModelGenerator: ModelGenerator = {
  async generate(itemId, version, context): Promise<ModelGeneratorResult> {
    const { photoUrls, measurementType, measurementValueCm } = context;

    if (photoUrls.length < 4) {
      throw new Error(
        "At least 4 photos are required for Tripo generation. The first 4 must be [front, left, back, right]."
      );
    }

    const { glbUrl: tripoGlbUrl, finalTaskId } = await generateFromImages(photoUrls, {
      timeoutMs: 300000,
      optimize: true,
      faceLimit: 15000,
      resume: context.resume,
      onTaskCreated: context.onTaskCreated,
    });

    const bucket = getSupabaseStorageBucket();
    const basePath = itemAssetVersionPrefix(itemId, version);
    const maxBytes = getMaxAssetBytes();

    const originalGlbBuffer = await downloadToBuffer(tripoGlbUrl, "Tripo GLB (original)");

    // Bbox from the original (unquantized) GLB so scale is correct in AR.
    const bbox = await getGlbBboxFromBuffer(originalGlbBuffer);
    const scaleFactor = computeScaleFactor(
      measurementType,
      measurementValueCm,
      bbox.bboxX,
      bbox.bboxY,
      bbox.bboxZ
    );

    const compressedGlbBuffer = await compressGlbBuffer(originalGlbBuffer, {
      targetMaxBytes: maxBytes,
      enableCompression: context.enableCompression,
    });

    const glbUrl = await uploadAssetFile(bucket, `${basePath}/model.glb`, compressedGlbBuffer, "model/gltf-binary");

    // Android Scene Viewer cannot be told a scale, so give it a copy with the size baked in.
    let arGlbUrl: string | null = null;
    try {
      const arGlb = await bakeRealWorldScale(compressedGlbBuffer, scaleFactor);
      if (arGlb.byteLength <= maxBytes) {
        arGlbUrl = await uploadAssetFile(bucket, `${basePath}/model-ar.glb`, arGlb, "model/gltf-binary");
      }
    } catch (err) {
      console.warn(
        "[tripoModelGenerator] Could not build the Android AR GLB; Android will use the web viewer:",
        err instanceof Error ? err.message : String(err)
      );
    }

    let usdzUrl: string | null = null;
    try {
      // Convert the optimized (low-poly) task to USDZ, pre-scaled to real-world size.
      const tripoUsdzUrl = await convertModelToUsdZ(finalTaskId, {
        timeoutMs: 300000,
        scaleFactor,
        faceLimit: 15000,
        existingTaskId: context.resume?.lowpolyTaskId === finalTaskId ? context.resume?.usdzTaskId : null,
        onTaskCreated: context.onTaskCreated,
      });

      if (tripoUsdzUrl) {
        const usdzBuffer = await downloadToBuffer(tripoUsdzUrl, "Tripo USDZ (scaled via convert_model)");
        if (usdzBuffer.byteLength > maxBytes) {
          console.warn(
            `[compress-asset] USDZ too large: ${(usdzBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB (cap ${(
              maxBytes /
              (1024 * 1024)
            ).toFixed(2)} MB). Skipping USDZ upload; iOS will use 3D fallback.`
          );
        } else {
          usdzUrl = await uploadAssetFile(bucket, `${basePath}/model.usdz`, usdzBuffer, "model/vnd.usdz+zip");
        }
      }
    } catch (err) {
      console.warn(
        "[tripoModelGenerator] USDZ conversion failed; continuing with GLB only:",
        err instanceof Error ? err.message : String(err)
      );
    }

    return {
      glbUrl,
      usdzUrl,
      arGlbUrl,
      units: "meters",
      bboxX: bbox.bboxX,
      bboxY: bbox.bboxY,
      bboxZ: bbox.bboxZ,
      scaleFactor,
    };
  },
};
