import { NextResponse } from "next/server";
import { getPublicMenu } from "@/lib/menu";

/**
 * GET /api/public/restaurants/[slug]/menu
 * Returns categories + available items with a thumbnail and whether AR is ready.
 * Items without a category are returned in a final "More" category.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  if (!menu) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }
  return NextResponse.json(menu);
}
