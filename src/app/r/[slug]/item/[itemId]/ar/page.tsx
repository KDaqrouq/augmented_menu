import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { computeScaleFactor } from "@/lib/scale";
import type { MeasurementType } from "@prisma/client";
import { ARViewer } from "./ARViewer";
import { ARErrorBoundary } from "./ARErrorBoundary";

export default async function ARPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}) {
  const { slug, itemId } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!restaurant) notFound();

  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId: restaurant.id },
    include: {
      assets: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!item) notFound();

  const asset = item.assets[0];
  if (!asset) {
    return (
      <main className="min-h-screen bg-gray-900 p-6 text-white">
        <p className="mb-4">No 3D asset yet. Generate 3D in admin first.</p>
        <Link href={`/r/${slug}/item/${itemId}`} className="text-blue-400 underline">
          Back to item
        </Link>
      </main>
    );
  }

  const scaleFactor = computeScaleFactor(
    item.measurementType as MeasurementType,
    item.measurementValue,
    asset.bboxX,
    asset.bboxY,
    asset.bboxZ
  );

  return (
    <main className="min-h-screen bg-gray-900">
      <div className="absolute left-0 top-0 z-10 flex items-center gap-3 p-3">
        <Link
          href={`/r/${slug}/item/${itemId}`}
          className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
        >
          ← Back
        </Link>
      </div>
      <ARErrorBoundary slug={slug} itemId={itemId}>
        <ARViewer
          restaurantId={restaurant.id}
          itemId={item.id}
          glbUrl={`${asset.glbUrl}${asset.glbUrl.includes("?") ? "&" : "?"}v=${asset.version}`}
        usdzUrl={
          asset.usdzUrl
            ? `${asset.usdzUrl}${asset.usdzUrl.includes("?") ? "&" : "?"}v=${asset.version}`
            : undefined
        }
        scaleFactor={scaleFactor}
        itemName={item.name}
        measurementType={item.measurementType}
        measurementValueCm={item.measurementValue}
        bboxX={asset.bboxX}
        bboxY={asset.bboxY}
        bboxZ={asset.bboxZ}
        />
      </ARErrorBoundary>
    </main>
  );
}
