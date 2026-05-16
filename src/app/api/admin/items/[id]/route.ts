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
 * PATCH /api/admin/items/[id]
 * Body: { name?, description?, price?, isAvailable?, measurementType?, measurementValue? }
 * TECH_SPECS §4 Admin API.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: {
    name?: string;
    description?: string | null;
    price?: string | null;
    isAvailable?: boolean;
    measurementType?: string;
    measurementValue?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    body.measurementType != null &&
    !MEASUREMENT_TYPES.includes(body.measurementType as MeasurementType)
  ) {
    return NextResponse.json(
      { error: "measurementType must be one of: " + MEASUREMENT_TYPES.join(", ") },
      { status: 400 }
    );
  }
  const data: Parameters<typeof prisma.menuItem.update>[0]["data"] = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined)
    data.description = body.description == null || body.description === "" ? null : String(body.description).trim();
  if (body.price !== undefined)
    data.price = body.price == null || body.price === "" ? null : String(body.price).trim();
  if (typeof body.isAvailable === "boolean") data.isAvailable = body.isAvailable;
  if (body.measurementType != null) data.measurementType = body.measurementType as MeasurementType;
  if (typeof body.measurementValue === "number") {
    if (body.measurementValue < MEASUREMENT_CM_MIN || body.measurementValue > MEASUREMENT_CM_MAX) {
      return NextResponse.json(
        { error: `measurementValue must be between ${MEASUREMENT_CM_MIN} and ${MEASUREMENT_CM_MAX} cm` },
        { status: 400 }
      );
    }
    data.measurementValue = body.measurementValue;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  try {
    const item = await prisma.menuItem.update({
      where: { id },
      data,
    });
    return NextResponse.json(item);
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025"
        ? "Item not found"
        : "Failed to update item";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/items/[id]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025"
        ? "Item not found"
        : "Failed to delete item";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
