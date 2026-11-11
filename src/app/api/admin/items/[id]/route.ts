import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { revalidatePublicMenu } from "@/lib/menu";
import {
  isMeasurementType,
  isValidMeasurementValue,
  MEASUREMENT_RANGE_ERROR,
  MEASUREMENT_TYPE_ERROR,
} from "@/lib/measurement";
import { deleteItemFiles } from "@/lib/supabase";

/**
 * PATCH /api/admin/items/[id]
 * Body: { name?, description?, price?, isAvailable?, categoryId?, measurementType?, measurementValue? }
 * Response includes `needsRegeneration` when the size changed on an item that already has a model:
 * the iOS and Android AR files have the old size baked in.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.menuItem.findUnique({
    where: { id },
    select: {
      restaurantId: true,
      measurementType: true,
      measurementValue: true,
      _count: { select: { assets: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const data: Prisma.MenuItemUncheckedUpdateInput = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.description !== undefined) {
    data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (body.price !== undefined) {
    data.price = typeof body.price === "string" ? body.price.trim() || null : null;
  }
  if (typeof body.isAvailable === "boolean") data.isAvailable = body.isAvailable;
  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") {
      data.categoryId = null;
    } else {
      const category =
        typeof body.categoryId === "string"
          ? await prisma.menuCategory.findFirst({
              where: { id: body.categoryId, restaurantId: existing.restaurantId },
              select: { id: true },
            })
          : null;
      if (!category) {
        return NextResponse.json({ error: "Category not found for this restaurant" }, { status: 400 });
      }
      data.categoryId = category.id;
    }
  }
  if (body.measurementType !== undefined) {
    if (!isMeasurementType(body.measurementType)) {
      return NextResponse.json({ error: MEASUREMENT_TYPE_ERROR }, { status: 400 });
    }
    data.measurementType = body.measurementType;
  }
  if (body.measurementValue !== undefined) {
    if (!isValidMeasurementValue(body.measurementValue)) {
      return NextResponse.json({ error: MEASUREMENT_RANGE_ERROR }, { status: 400 });
    }
    data.measurementValue = body.measurementValue;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const sizeChanged =
    (data.measurementType !== undefined && data.measurementType !== existing.measurementType) ||
    (data.measurementValue !== undefined && data.measurementValue !== existing.measurementValue);

  const item = await prisma.menuItem.update({ where: { id }, data });
  revalidatePublicMenu();
  return NextResponse.json({ ...item, needsRegeneration: sizeChanged && existing._count.assets > 0 });
}

/**
 * DELETE /api/admin/items/[id]
 * Deletes the item and then its photos and model files from storage.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.menuItem.delete({ where: { id } });
  } catch (e: unknown) {
    const notFound = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025";
    return NextResponse.json(
      { error: notFound ? "Item not found" : "Failed to delete item" },
      { status: notFound ? 404 : 400 }
    );
  }
  revalidatePublicMenu();
  await deleteItemFiles(id);
  return NextResponse.json({ ok: true });
}
