import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePublicMenu } from "@/lib/menu";
import {
  cleanupStorage,
  deleteStorageFiles,
  getSupabaseStorageBucket,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

/**
 * DELETE /api/admin/items/[id]/photos/[mediaId]
 * Removes the photo, renumbers the rest (keeping their order), and deletes the file from storage.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const { id: itemId, mediaId } = await params;

  const media = await prisma.menuItemMedia.findFirst({ where: { id: mediaId, itemId } });
  if (!media) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const remaining = await prisma.$transaction(async (tx) => {
    await tx.menuItemMedia.delete({ where: { id: mediaId } });
    const rest = await tx.menuItemMedia.findMany({ where: { itemId }, orderBy: { sortOrder: "asc" } });
    for (const [index, m] of rest.entries()) {
      if (m.sortOrder !== index) await tx.menuItemMedia.update({ where: { id: m.id }, data: { sortOrder: index } });
    }
    return rest.map((m, index) => ({ id: m.id, url: m.url, sortOrder: index }));
  });
  revalidatePublicMenu();

  const path = storagePathFromPublicUrl(media.url, getSupabaseStorageBucket());
  if (path) await cleanupStorage(`photo ${mediaId}`, () => deleteStorageFiles([path]));

  return NextResponse.json({ media: remaining });
}
