import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePublicMenu } from "@/lib/menu";
import { slugify } from "@/lib/slug";

/**
 * GET /api/admin/restaurants
 * Returns all restaurants with category and item counts (for admin UI).
 */
export async function GET() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: { select: { items: true, categories: true } },
    },
  });
  return NextResponse.json(
    restaurants.map(({ _count, ...r }) => ({
      ...r,
      itemCount: _count.items,
      categoryCount: _count.categories,
    }))
  );
}

/**
 * POST /api/admin/restaurants
 * Body: { name, slug? } — slug defaults to the name, normalized to a URL-safe form.
 */
export async function POST(request: Request) {
  let body: { name?: unknown; slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slug = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : name);
  if (!name || !slug) {
    return NextResponse.json({ error: "A name (and a URL slug with letters or digits) is required" }, { status: 400 });
  }
  try {
    const restaurant = await prisma.restaurant.create({ data: { name, slug } });
    revalidatePublicMenu();
    return NextResponse.json(restaurant);
  } catch (e: unknown) {
    const taken = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002";
    return NextResponse.json(
      { error: taken ? `The URL /r/${slug} is already in use` : "Failed to create restaurant" },
      { status: 400 }
    );
  }
}
