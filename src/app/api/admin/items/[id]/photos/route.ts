import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSupabaseAdminClient,
  getSupabaseStorageBucket,
  getStoragePublicUrl,
} from "@/lib/supabase";
import { randomUUID } from "crypto";

const MAX_FILES = 12;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "image";
}

/**
 * POST /api/admin/items/[id]/photos (multipart)
 * Uploads files to Supabase Storage, creates MenuItemMedia rows with url and sortOrder.
 * TECH_SPECS §4 Admin API.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itemId } = await params;

  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: "Storage not configured (Supabase env vars)" },
      { status: 503 }
    );
  }
  const bucket = getSupabaseStorageBucket();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (value instanceof File && value.size > 0) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const existingCount = await prisma.menuItemMedia.count({ where: { itemId } });
  if (existingCount + files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} photos per item. You have ${existingCount}, tried to add ${files.length}.` },
      { status: 400 }
    );
  }

  const uploaded: { id: string; url: string; sortOrder: number }[] = [];
  let sortOrder = existingCount;

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File ${file.name} exceeds 10 MB limit` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
    const path = `items/${itemId}/${randomUUID()}-${safeName}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const url = getStoragePublicUrl(bucket, path);
    const media = await prisma.menuItemMedia.create({
      data: { itemId, url, sortOrder },
    });
    uploaded.push({ id: media.id, url: media.url, sortOrder: media.sortOrder });
    sortOrder += 1;
  }

  return NextResponse.json({ uploaded });
}
