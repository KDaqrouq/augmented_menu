import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePublicMenu } from "@/lib/menu";
import { slugify } from "@/lib/slug";
import { deleteItemFiles } from "@/lib/supabase";

/**
 * GET /api/admin/restaurants/[id]
 * Returns one restaurant with categories and items (for admin UI).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      categories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { items: true } } },
      },
      items: {
        orderBy: { name: "asc" },
        include: {
          category: { select: { id: true, name: true } },
          media: { orderBy: { sortOrder: "asc" }, take: 1 },
          _count: { select: { media: true } },
        },
      },
    },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  return NextResponse.json(restaurant);
}

/**
 * PATCH /api/admin/restaurants/[id]
 * Body: { name?, slug? }. Changing the slug changes the menu URL (printed QR codes stop working).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { name?: unknown; slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { name?: string; slug?: string } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.slug !== undefined) {
    const slug = typeof body.slug === "string" ? slugify(body.slug) : "";
    if (!slug) return NextResponse.json({ error: "slug needs letters or digits" }, { status: 400 });
    data.slug = slug;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const restaurant = await prisma.restaurant.update({ where: { id }, data });
    revalidatePublicMenu();
    return NextResponse.json(restaurant);
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2025") return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    if (code === "P2002") {
      return NextResponse.json({ error: `The URL /r/${data.slug} is already in use` }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update restaurant" }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/restaurants/[id]
 * Deletes the restaurant with its categories, items and their files.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await prisma.menuItem.findMany({ where: { restaurantId: id }, select: { id: true } });
  try {
    await prisma.restaurant.delete({ where: { id } });
  } catch (e: unknown) {
    const notFound = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025";
    return NextResponse.json(
      { error: notFound ? "Restaurant not found" : "Failed to delete restaurant" },
      { status: notFound ? 404 : 400 }
    );
  }
  revalidatePublicMenu();
  for (const item of items) await deleteItemFiles(item.id);
  return NextResponse.json({ ok: true });
}
