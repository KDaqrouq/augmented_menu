import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { revalidatePublicMenu } from "@/lib/menu";
import {
  isMeasurementType,
  isValidMeasurementValue,
  MEASUREMENT_RANGE_ERROR,
  MEASUREMENT_TYPE_ERROR,
} from "@/lib/measurement";

/**
 * POST /api/admin/items
 * Body: { restaurantId, categoryId?, name, description?, price?, measurementType, measurementValue }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { restaurantId, categoryId, name, description, price, measurementType, measurementValue } = body;

  if (typeof restaurantId !== "string" || !restaurantId || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "restaurantId and name are required" }, { status: 400 });
  }
  if (!isMeasurementType(measurementType)) {
    return NextResponse.json({ error: MEASUREMENT_TYPE_ERROR }, { status: 400 });
  }
  if (!isValidMeasurementValue(measurementValue)) {
    return NextResponse.json({ error: MEASUREMENT_RANGE_ERROR }, { status: 400 });
  }

  let category: string | null = null;
  if (typeof categoryId === "string" && categoryId) {
    const found = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId },
      select: { id: true },
    });
    if (!found) {
      return NextResponse.json({ error: "Category not found for this restaurant" }, { status: 400 });
    }
    category = found.id;
  }

  try {
    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: category,
        name: name.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        price: typeof price === "string" ? price.trim() || null : null,
        measurementType,
        measurementValue,
      },
    });
    revalidatePublicMenu();
    return NextResponse.json(item);
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2003"
        ? "Restaurant not found"
        : "Failed to create item";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
