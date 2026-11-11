/**
 * Tripo 3D API client for multiview → 3D generation.
 * Uses REST: create task → poll until done → (optionally) convert to USDZ.
 *
 * Every task we create is reported through `onTaskCreated`, so a retried job can
 * resume by polling the existing task instead of paying for a new one.
 *
 * Docs: https://platform.tripo3d.ai/docs/introduction
 */

const DEFAULT_BASE = "https://api.tripo3d.ai/v2/openapi";
const POLL_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 300000; // 5 min

export type TripoStage = "base" | "lowpoly" | "usdz";

/** Called with a task id as soon as Tripo accepts it (or null when a stored id should be forgotten). */
export type OnTaskCreated = (stage: TripoStage, taskId: string | null) => Promise<void> | void;

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

/** A Tripo task reached a terminal non-success state (failed, cancelled, banned, expired). */
export class TripoTaskFailedError extends Error {
  constructor(
    message: string,
    readonly taskId: string,
    readonly status: string
  ) {
    super(message);
    this.name = "TripoTaskFailedError";
  }
}

async function postTask(body: unknown): Promise<string> {
  const res = await fetch(`${getBaseUrl()}/task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
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
 * Create a multiview_to_model task. The first 4 URLs map to [front, left, back, right].
 */
export async function createMultiviewToModelTask(imageUrls: string[]): Promise<string> {
  if (imageUrls.length < 4) {
    throw new Error(
      "At least 4 image URLs are required for multiview_to_model (front, left, back, right)"
    );
  }

  const files = imageUrls.slice(0, 4).map((url) => ({ type: getFileTypeFromUrl(url), url }));

  return postTask({
    type: "multiview_to_model" as const,
    files,
    // Explicitly choose model_version and texture_quality for consistent output.
    model_version: "v3.1-20260211",
    texture_quality: "standard",
  });
}

/**
 * Reduce polygon count after high-poly multiview generation (Smart LowPoly).
 */
export async function createHighpolyToLowpolyTask(
  originalTaskId: string,
  options: { faceLimit?: number; quad?: boolean; bake?: boolean } = {}
): Promise<string> {
  return postTask({
    type: "highpoly_to_lowpoly" as const,
    original_model_task_id: originalTaskId,
    face_limit: options.faceLimit ?? 15000,
    quad: options.quad ?? false,
    bake: options.bake ?? true,
  });
}

/**
 * Get task status and output.
 */
export async function getTask(taskId: string): Promise<TripoTaskResponse["data"]> {
  const res = await fetch(`${getBaseUrl()}/task/${taskId}`, {
    headers: { Authorization: `Bearer ${getApiKey()}` },
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
    const status = (data?.status ?? "").toLowerCase();

    if (status === "success") {
      const output = data?.output ?? {};
      return {
        modelUrl: (output.model as string | undefined) ?? null,
        baseModelUrl: (output.base_model as string | undefined) ?? null,
        pbrModelUrl: (output.pbr_model as string | undefined) ?? null,
        renderedImageUrl: (output.rendered_image as string | undefined) ?? null,
        rawOutput: output,
      };
    }

    if (status === "failed" || status === "cancelled" || status === "banned" || status === "expired") {
      throw new TripoTaskFailedError(
        data?.message ?? `Tripo task ${taskId} ended with status ${status}`,
        taskId,
        status
      );
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Tripo task ${taskId} timed out after ${timeoutMs}ms`);
}

/**
 * Wait for a stored task if we have one; if it ended badly (or there is none), create a fresh one.
 * Creating is the paid step, so a retry after a timeout or crash only polls.
 */
async function resumeOrCreate(
  stage: TripoStage,
  existingTaskId: string | null | undefined,
  create: () => Promise<string>,
  timeoutMs: number,
  onTaskCreated?: OnTaskCreated
): Promise<{ taskId: string; output: TaskOutputUrls }> {
  if (existingTaskId) {
    try {
      return { taskId: existingTaskId, output: await waitForTask(existingTaskId, { timeoutMs }) };
    } catch (err) {
      if (!(err instanceof TripoTaskFailedError)) throw err;
      console.warn(`[tripo] Stored ${stage} task ${existingTaskId} ${err.status}; creating a new one.`);
      await onTaskCreated?.(stage, null);
    }
  }
  const taskId = await create();
  await onTaskCreated?.(stage, taskId);
  return { taskId, output: await waitForTask(taskId, { timeoutMs }) };
}

export type GenerateResume = { baseTaskId?: string | null; lowpolyTaskId?: string | null };

/**
 * Full flow (GLB):
 * - Requires at least 4 images (multiview_to_model).
 * - Optionally runs highpoly_to_lowpoly to reduce polygon count / file size.
 *
 * Returns the primary GLB URL and the final task id (low-poly when optimized)
 * so callers can run convert_model (e.g. to USDZ) on the optimized mesh.
 */
export async function generateFromImages(
  imageUrls: string[],
  options: {
    timeoutMs?: number;
    optimize?: boolean;
    faceLimit?: number;
    resume?: GenerateResume;
    onTaskCreated?: OnTaskCreated;
  } = {}
): Promise<{ glbUrl: string; baseTaskId: string; finalTaskId: string }> {
  if (imageUrls.length < 4) {
    throw new Error(
      "At least 4 image URLs are required for 3D generation; first 4 must be [front, left, back, right]"
    );
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { resume, onTaskCreated } = options;

  // 1) Base model
  const base = await resumeOrCreate(
    "base",
    resume?.baseTaskId,
    () => createMultiviewToModelTask(imageUrls),
    timeoutMs,
    onTaskCreated
  );

  let final = base;

  // 2) Optional low-poly optimization. A new base task invalidates any stored low-poly task.
  if (options.optimize ?? true) {
    const storedLowpoly = base.taskId === resume?.baseTaskId ? resume?.lowpolyTaskId : null;
    final = await resumeOrCreate(
      "lowpoly",
      storedLowpoly,
      () =>
        createHighpolyToLowpolyTask(base.taskId, {
          faceLimit: options.faceLimit ?? 15000,
          quad: false,
          bake: true,
        }),
      timeoutMs,
      onTaskCreated
    );
  }

  const glbUrl = final.output.pbrModelUrl ?? final.output.modelUrl ?? final.output.baseModelUrl ?? null;
  if (!glbUrl) {
    throw new Error(`Tripo task ${final.taskId} succeeded but no model URL in output`);
  }

  return { glbUrl, baseTaskId: base.taskId, finalTaskId: final.taskId };
}

/**
 * Run a convert_model → USDZ task for an existing model task.
 * scale_factor pre-scales the asset to real-world size for Quick Look.
 */
export async function convertModelToUsdZ(
  originalTaskId: string,
  options: {
    timeoutMs?: number;
    scaleFactor?: number;
    faceLimit?: number;
    existingTaskId?: string | null;
    onTaskCreated?: OnTaskCreated;
  } = {}
): Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const body: Record<string, unknown> = {
    type: "convert_model" as const,
    format: "USDZ" as const,
    original_model_task_id: originalTaskId,
    texture_size: 2048,
    texture_format: "JPEG",
    face_limit: options.faceLimit ?? 15000,
    bake: true,
  };

  if (typeof options.scaleFactor === "number" && Number.isFinite(options.scaleFactor)) {
    body.scale_factor = options.scaleFactor;
  }

  const { output } = await resumeOrCreate(
    "usdz",
    options.existingTaskId,
    () => postTask(body),
    timeoutMs,
    options.onTaskCreated
  );

  return output.modelUrl ?? output.baseModelUrl ?? output.pbrModelUrl ?? null;
}
