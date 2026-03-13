import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize } from "@gltf-transform/functions";

function getMaxAssetBytesFromEnv(): number {
  const mb = Number(process.env.MAX_ASSET_MB);
  const fallbackMb = Number.isFinite(mb) && mb > 0 ? mb : 25;
  return fallbackMb * 1024 * 1024;
}

/**
 * Read ENABLE_GLTF_COMPRESSION from env. Used by API route (Vercel) to pass into job payload.
 * Default: true. Falsy: "0", "false", "no" (case-insensitive).
 */
export function isCompressionEnabledFromEnv(): boolean {
  const flag = process.env.ENABLE_GLTF_COMPRESSION;
  if (flag === undefined) return true; // default: enabled
  const normalized = flag.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/**
 * Compress a GLB using glTF-Transform:
 * - dedup/prune/reorder
 * - quantize geometry
 *
 * When options.enableCompression is provided, that overrides env (used by worker from job payload).
 * When undefined, falls back to ENABLE_GLTF_COMPRESSION from env.
 * If compression is disabled, original buffer is returned and MAX_ASSET_MB is still enforced.
 */
export async function compressGlbBuffer(
  input: Buffer,
  options?: { targetMaxBytes?: number; enableCompression?: boolean }
): Promise<Buffer> {
  const maxBytes = options?.targetMaxBytes ?? getMaxAssetBytesFromEnv();
  const enableCompression =
    options?.enableCompression !== undefined ? options.enableCompression : isCompressionEnabledFromEnv();

  const originalBytes = input.byteLength;
  console.log(
    `[compress-asset] Original GLB size: ${(originalBytes / (1024 * 1024)).toFixed(2)} MB`
  );

  if (!enableCompression) {
    console.log("[compress-asset] Compression disabled; skipping transforms.");
    if (originalBytes > maxBytes) {
      throw new Error(
        `Model is too large (${(originalBytes / (1024 * 1024)).toFixed(
          2
        )} MB) and compression is disabled. Enable compression or reduce source model size.`
      );
    }
    return Buffer.from(input);
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  const document = await io.readBinary(input);

  await document.transform(dedup(), prune(), quantize());

  const compressed = await io.writeBinary(document);
  const compressedBytes = compressed.byteLength;

  console.log(
    `[compress-asset] Compressed GLB size: ${(compressedBytes / (1024 * 1024)).toFixed(
      2
    )} MB`
  );

  if (compressedBytes > maxBytes) {
    throw new Error(
      `Compressed model is still too large (${(
        compressedBytes /
        (1024 * 1024)
      ).toFixed(
        2
      )} MB). Try fewer photos, a lower-quality generation mode, or increasing storage limits.`
    );
  }

  return Buffer.from(compressed);
}

/**
 * Log size of any binary asset (GLB/USDZ) before deciding whether to upload.
 */
export function logAssetSize(label: string, buf: Buffer): void {
  const mb = buf.byteLength / (1024 * 1024);
  console.log(`[compress-asset] ${label} size: ${mb.toFixed(2)} MB`);
}

/**
 * Shared helper so other modules can respect the same MAX_ASSET_MB cap.
 */
export function getMaxAssetBytes(): number {
  return getMaxAssetBytesFromEnv();
}

