/**
 * Tripo 3D API client for image/multiview → 3D generation.
 * Uses REST: create task → poll until done → (optionally) convert to USDZ.
 *
 * Docs: https://platform.tripo3d.ai/docs/introduction
 */

const DEFAULT_BASE = "https://api.tripo3d.ai/v2/openapi";
const POLL_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 300000; // 5 min

function getApiKey(): string {
  const key = process.env.TRIPO_API_KEY;
  if (!key?.trim()) throw new Error("TRIPO_API_KEY is required for 3D generation");
  return key.trim();
}

function getBaseUrl(): string {
  return (process.env.TRIPO_API_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
}

function getFileTypeFromUrl(url: string): "jpeg" | "png" | "webp" {
  try {
    const lower = new URL(url).pathname.toLowerCase();
    if (lower.endsWith(".png")) return "png";
    if (lower.endsWith(".webp")) return "webp";
    return "jpeg";
  } catch {
    return "jpeg";
  }
}

export type TripoTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "unknown"
  | "banned"
  | "expired";

export type TripoTaskOutput = {
  model?: string;
  base_model?: string;
  pbr_model?: string;
  rendered_image?: string;
  [key: string]: unknown;
};

export type TripoTaskResponse = {
  code: number;
  data?: {
    task_id: string;
    type?: string;
    status: TripoTaskStatus | string;
    output?: TripoTaskOutput;
    message?: string;
  };
};

type TaskOutputUrls = {
  modelUrl?: string | null;
  baseModelUrl?: string | null;
  pbrModelUrl?: string | null;
  renderedImageUrl?: string | null;
  rawOutput?: TripoTaskOutput;
};

async function postTask(body: unknown): Promise<string> {
  const base = getBaseUrl();
  const key = getApiKey();
  const url = `${base}/task`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tripo API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as TripoTaskResponse;
  if (json.code !== 0 || !json.data?.task_id) {
    throw new Error(json.data?.message ?? `Tripo returned code ${json.code}`);
  }
  return json.data.task_id;
}

/**
 * Create an image_to_model task (single image) using ImageToModelRequest.
 */
export async function createImageToModelTask(imageUrl: string): Promise<string> {
  if (!imageUrl) throw new Error("imageUrl is required");
  const fileType = getFileTypeFromUrl(imageUrl);

  const body = {
    type: "image_to_model" as const,
    file: {
      type: fileType,
      url: imageUrl,
    },
    // Use Tripo defaults for model_version, texture, pbr, etc.
  };

  return postTask(body);
}

/**
 * Create a multiview_to_model task when we have multiple images.
 * We map up to 4 URLs into [front, left, back, right] order.
 */
export async function createMultiviewToModelTask(
  imageUrls: string[]
): Promise<string> {
  if (imageUrls.length < 2) {
    throw new Error("At least two image URLs are required for multiview_to_model");
  }

  const files: unknown[] = [{}, {}, {}, {}];

  imageUrls.slice(0, 4).forEach((url, index) => {
    const fileType = getFileTypeFromUrl(url);
    files[index] = {
      type: fileType,
      url,
    };
  });

  const body = {
    type: "multiview_to_model" as const,
    files,
    // Let model_version/defaults be chosen by Tripo.
  };

  return postTask(body);
}

/**
 * Create a convert_model task to turn an existing model into USDZ.
 */
async function createConvertToUsdZTask(originalTaskId: string): Promise<string> {
  const body = {
    type: "convert_model" as const,
    format: "USDZ" as const,
    original_model_task_id: originalTaskId,
  };
  return postTask(body);
}

/**
 * Get task status and output.
 */
export async function getTask(taskId: string): Promise<TripoTaskResponse["data"]> {
  const base = getBaseUrl();
  const key = getApiKey();
  const res = await fetch(`${base}/task/${taskId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tripo API get task error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as TripoTaskResponse;
  if (json.code !== 0) {
    throw new Error(json.data?.message ?? `Tripo returned code ${json.code}`);
  }
  return json.data;
}

/**
 * Poll task until it reaches a final state or timeout.
 * Returns extracted output URLs (model/base_model/pbr_model/rendered_image).
 */
export async function waitForTask(
  taskId: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<TaskOutputUrls> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const data = await getTask(taskId);
    const status = (data?.status ?? "").toLowerCase() as TripoTaskStatus | string;

    if (status === "success") {
      const output = data?.output ?? {};
      const modelUrl = (output.model as string | undefined) ?? null;
      const baseModelUrl = (output.base_model as string | undefined) ?? null;
      const pbrModelUrl = (output.pbr_model as string | undefined) ?? null;
      const renderedImageUrl = (output.rendered_image as string | undefined) ?? null;

      return {
        modelUrl,
        baseModelUrl,
        pbrModelUrl,
        renderedImageUrl,
        rawOutput: output,
      };
    }

    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "banned" ||
      status === "expired"
    ) {
      throw new Error(data?.message ?? `Tripo task ${taskId} ended with status ${status}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Tripo task ${taskId} timed out after ${timeoutMs}ms`);
}

/**
 * Full flow (GLB only):
 * - If one image: image_to_model
 * - If multiple images: multiview_to_model
 *
 * Returns the primary GLB URL and the base task id so callers can
 * optionally run convert_model (e.g. to USDZ) with additional options
 * like scale_factor.
 */
export async function generateFromImages(
  imageUrls: string[],
  options?: { timeoutMs?: number }
): Promise<{ glbUrl: string; baseTaskId: string }> {
  if (imageUrls.length === 0) {
    throw new Error("At least one image URL is required");
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // 1) Base model (GLB) task.
  const baseTaskId =
    imageUrls.length === 1
      ? await createImageToModelTask(imageUrls[0]!)
      : await createMultiviewToModelTask(imageUrls);

  const baseOutput = await waitForTask(baseTaskId, { timeoutMs });
  const glbUrl =
    baseOutput.pbrModelUrl ??
    baseOutput.modelUrl ??
    baseOutput.baseModelUrl ??
    null;

  if (!glbUrl) {
    throw new Error(`Tripo task ${baseTaskId} succeeded but no model URL in output`);
  }

  return { glbUrl, baseTaskId };
}

/**
 * Helper to run a convert_model → USDZ task for an existing model task.
 * Accepts optional Tripo scale_factor so the converted asset can be
 * pre-scaled (e.g. to match real-world size for Quick Look).
 */
export async function convertModelToUsdZ(
  originalTaskId: string,
  options: { timeoutMs?: number; scaleFactor?: number } = {}
): Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const body: Record<string, unknown> = {
    type: "convert_model" as const,
    format: "USDZ" as const,
    original_model_task_id: originalTaskId,
  };

  if (typeof options.scaleFactor === "number" && Number.isFinite(options.scaleFactor)) {
    body.scale_factor = options.scaleFactor;
  }

  const convertTaskId = await postTask(body);
  const convertOutput = await waitForTask(convertTaskId, { timeoutMs });

  const usdzUrl =
    convertOutput.modelUrl ??
    convertOutput.baseModelUrl ??
    convertOutput.pbrModelUrl ??
    null;

  return usdzUrl ?? null;
}
