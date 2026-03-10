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
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "menu-images";
  return bucket;
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
