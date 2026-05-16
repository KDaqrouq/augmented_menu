import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/admin/restaurants/[id]/categories/[categoryId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  const { id: restaurantId, categoryId } = await params;
  const category = await prisma.menuCategory.findFirst({
    where: { id: categoryId, restaurantId },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  try {
    await prisma.menuCategory.delete({ where: { id: categoryId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 400 });
  }
}
