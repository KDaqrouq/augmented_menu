import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePublicMenu } from "@/lib/menu";

/**
 * POST /api/admin/restaurants/[id]/categories
 * Body: { name, sortOrder? } — without sortOrder the category goes last.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: restaurantId } = await params;
  let body: { name?: unknown; sortOrder?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  let sortOrder: number;
  if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) {
    sortOrder = body.sortOrder;
  } else {
    const last = await prisma.menuCategory.aggregate({ where: { restaurantId }, _max: { sortOrder: true } });
    sortOrder = (last._max.sortOrder ?? -1) + 1;
  }

  try {
    const category = await prisma.menuCategory.create({
      data: { restaurantId, name: body.name.trim(), sortOrder },
    });
    revalidatePublicMenu();
    return NextResponse.json(category);
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2003"
        ? "Restaurant not found"
        : "Failed to create category";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * PATCH /api/admin/restaurants/[id]/categories
 * Body: { order: string[] } — every category id of the restaurant, in display order.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: restaurantId } = await params;
  let body: { order?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const order = body.order;
  if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "order must be an array of category ids" }, { status: 400 });
  }
  const categories = await prisma.menuCategory.findMany({ where: { restaurantId }, select: { id: true } });
  const known = new Set(categories.map((c) => c.id));
  if (order.length !== known.size || new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
    return NextResponse.json({ error: "order must list each category exactly once" }, { status: 400 });
  }

  await prisma.$transaction(
    (order as string[]).map((id, index) => prisma.menuCategory.update({ where: { id }, data: { sortOrder: index } }))
  );
  revalidatePublicMenu();
  return NextResponse.json({ ok: true });
}
