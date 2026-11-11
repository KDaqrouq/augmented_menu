import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePublicMenu } from "@/lib/menu";

type Params = { params: Promise<{ id: string; categoryId: string }> };

/**
 * PATCH /api/admin/restaurants/[id]/categories/[categoryId]
 * Body: { name }
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id: restaurantId, categoryId } = await params;
  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const { count } = await prisma.menuCategory.updateMany({
    where: { id: categoryId, restaurantId },
    data: { name: body.name.trim() },
  });
  if (count === 0) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  revalidatePublicMenu();
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/restaurants/[id]/categories/[categoryId]
 * Items in the category stay on the menu, under "More".
 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id: restaurantId, categoryId } = await params;
  const { count } = await prisma.menuCategory.deleteMany({ where: { id: categoryId, restaurantId } });
  if (count === 0) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  revalidatePublicMenu();
  return NextResponse.json({ ok: true });
}
