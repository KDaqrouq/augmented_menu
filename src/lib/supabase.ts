import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client with service role (for Storage uploads).
 * Use only in API routes / server components; never expose service role key to client.
 */
function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for storage uploads");
  }
  return createClient(url, key);
}

export function getSupabaseStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "menu-images";
}

export function getSupabaseAdminClient() {
  return getSupabaseAdmin();
}

/**
 * Public URL for a file in the storage bucket (public bucket).
 */
export function getStoragePublicUrl(bucket: string, path: string): string {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!url) throw new Error("SUPABASE_URL is required");
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Inverse of getStoragePublicUrl: the object path inside `bucket`, or null for foreign URLs.
 */
export function storagePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  try {
    const { pathname } = new URL(publicUrl);
    const idx = pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

/** Storage folder that holds an item's photos. */
export function itemPhotosPrefix(itemId: string): string {
  return `items/${itemId}`;
}

/** Storage folder that holds one generated model version (GLB, USDZ, Android GLB). */
export function itemAssetVersionPrefix(itemId: string, version: number): string {
  return `assets/items/${itemId}/v${version}`;
}

/**
 * Upload a file to storage and return its public URL.
 * Used for AR assets at assets/items/{itemId}/v{version}/model.glb|model.usdz|model-ar.glb
 */
export async function uploadAssetFile(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return getStoragePublicUrl(bucket, path);
}

/** Remove specific object paths. Missing files are not an error. */
export async function deleteStorageFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }
}

/**
 * Recursively remove everything under a folder prefix (Supabase `list` is not recursive;
 * entries without an id are sub-folders).
 */
export async function deleteStorageFolder(prefix: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const bucket = getSupabaseStorageBucket();
  const files: string[] = [];
  const pending = [prefix.replace(/\/$/, "")];

  while (pending.length > 0) {
    const folder = pending.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, { limit: 1000, offset });
      if (error) throw new Error(`Storage list failed: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const path = `${folder}/${entry.name}`;
        if (entry.id) files.push(path);
        else pending.push(path);
      }
      if (data.length < 1000) break;
    }
  }

  await deleteStorageFiles(files);
}

/**
 * Best-effort cleanup: storage problems are logged, never surfaced to the admin action
 * that triggered them (the database change already happened).
 */
export async function cleanupStorage(label: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    console.warn(`[storage] Cleanup failed (${label}):`, err instanceof Error ? err.message : err);
  }
}

/** Remove all photos and generated models of a deleted item. Best-effort. */
export async function deleteItemFiles(itemId: string): Promise<void> {
  await cleanupStorage(`item ${itemId} photos`, () => deleteStorageFolder(itemPhotosPrefix(itemId)));
  await cleanupStorage(`item ${itemId} models`, () => deleteStorageFolder(`assets/items/${itemId}`));
}
