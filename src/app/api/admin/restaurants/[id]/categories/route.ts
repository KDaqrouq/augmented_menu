import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/restaurants/[id]/categories
 * Body: { name, sortOrder }
 * TECH_SPECS §4 Admin API.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: restaurantId } = await params;
  let body: { name?: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, sortOrder } = body;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const order = typeof sortOrder === "number" ? sortOrder : 0;
  try {
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId,
        name: name.trim(),
        sortOrder: order,
      },
    });
    return NextResponse.json(category);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2003"
      ? "Restaurant not found"
      : "Failed to create category";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
