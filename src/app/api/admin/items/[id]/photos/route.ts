import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { revalidatePublicMenu } from "@/lib/menu";
import {
  getSupabaseAdminClient,
  getSupabaseStorageBucket,
  getStoragePublicUrl,
  itemPhotosPrefix,
} from "@/lib/supabase";

const MAX_FILES = 12;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "image";
}

/**
 * POST /api/admin/items/[id]/photos (multipart)
 * Validates every file first, then uploads to Supabase Storage and appends MenuItemMedia rows.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await params;

  const item = await prisma.menuItem.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Storage not configured (Supabase env vars)" }, { status: 503 });
  }
  const bucket = getSupabaseStorageBucket();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const files = [...formData.values()].filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "No files provided" }, { status: 400 });

  const existingCount = await prisma.menuItemMedia.count({ where: { itemId } });
  if (existingCount + files.length > MAX_FILES) {
    return NextResponse.json(
      {
        error: `Maximum ${MAX_FILES} photos per item. You have ${existingCount}, tried to add ${files.length}.`,
      },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!EXTENSION_BY_TYPE[file.type]) {
      return NextResponse.json(
        { error: `${file.name}: only JPEG, PNG and WebP images are allowed` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: `${file.name} is larger than 10 MB` }, { status: 400 });
    }
  }

  const uploaded: { id: string; url: string; sortOrder: number }[] = [];
  let sortOrder = existingCount;

  for (const file of files) {
    const safeName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
    const path = `${itemPhotosPrefix(itemId)}/${randomUUID()}-${safeName}.${EXTENSION_BY_TYPE[file.type]}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      });
    if (uploadError) {
      if (uploaded.length) revalidatePublicMenu();
      return NextResponse.json(
        { error: `Upload failed for ${file.name}: ${uploadError.message}`, uploaded },
        { status: 500 }
      );
    }

    const media = await prisma.menuItemMedia.create({
      data: { itemId, url: getStoragePublicUrl(bucket, path), sortOrder },
    });
    uploaded.push({ id: media.id, url: media.url, sortOrder: media.sortOrder });
    sortOrder += 1;
  }

  revalidatePublicMenu();
  return NextResponse.json({ uploaded });
}

/**
 * PATCH /api/admin/items/[id]/photos
 * Body: { order: string[] } — every photo id of the item, in the new order.
 * The first four are used for 3D generation as front, left, back, right.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await params;
  let body: { order?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const order = body.order;
  if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "order must be an array of photo ids" }, { status: 400 });
  }

  const media = await prisma.menuItemMedia.findMany({ where: { itemId }, select: { id: true } });
  const known = new Set(media.map((m) => m.id));
  if (order.length !== known.size || new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
    return NextResponse.json({ error: "order must list each of the item's photos exactly once" }, { status: 400 });
  }

  await prisma.$transaction(
    (order as string[]).map((id, index) =>
      prisma.menuItemMedia.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  revalidatePublicMenu();

  const updated = await prisma.menuItemMedia.findMany({
    where: { itemId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, url: true, sortOrder: true },
  });
  return NextResponse.json({ media: updated });
}
