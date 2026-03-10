import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { MeasurementType } from "@prisma/client";

const MEASUREMENT_TYPES: MeasurementType[] = [
  "PLATE_DIAMETER_CM",
  "BOWL_DIAMETER_CM",
  "CUP_HEIGHT_CM",
  "MAX_WIDTH_CM",
];

/** Checkpoint 2C: reasonable bounds for measurement (cm). */
const MEASUREMENT_CM_MIN = 1;
const MEASUREMENT_CM_MAX = 200;

/**
 * POST /api/admin/items
 * Body: { restaurantId, categoryId?, name, description?, price?, measurementType, measurementValue }
 * TECH_SPECS §4 Admin API.
 */
export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    categoryId?: string | null;
    name?: string;
    description?: string | null;
    price?: string | null;
    measurementType?: string;
    measurementValue?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const {
    restaurantId,
    categoryId,
    name,
    description,
    price,
    measurementType,
    measurementValue,
  } = body;
  if (
    typeof restaurantId !== "string" ||
    !restaurantId ||
    typeof name !== "string" ||
    !name.trim()
  ) {
    return NextResponse.json(
      { error: "restaurantId and name are required" },
      { status: 400 }
    );
  }
  if (
    !measurementType ||
    !MEASUREMENT_TYPES.includes(measurementType as MeasurementType)
  ) {
    return NextResponse.json(
      { error: "measurementType must be one of: " + MEASUREMENT_TYPES.join(", ") },
      { status: 400 }
    );
  }
  const value =
    typeof measurementValue === "number" && measurementValue >= MEASUREMENT_CM_MIN && measurementValue <= MEASUREMENT_CM_MAX
      ? measurementValue
      : typeof measurementValue === "number"
        ? null
        : 1;
  if (value === null) {
    return NextResponse.json(
      { error: `measurementValue must be between ${MEASUREMENT_CM_MIN} and ${MEASUREMENT_CM_MAX} cm` },
      { status: 400 }
    );
  }
  try {
    const item = await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId: categoryId && typeof categoryId === "string" ? categoryId : null,
        name: name.trim(),
        description: description != null ? String(description).trim() || null : null,
        price: price != null ? String(price).trim() || null : null,
        measurementType: measurementType as MeasurementType,
        measurementValue: value,
      },
    });
    return NextResponse.json(item);
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2003"
        ? "Restaurant or category not found"
        : "Failed to create item";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
