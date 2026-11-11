import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getPublicItem } from "@/lib/menu";
import { getMobilePlatform } from "@/lib/device";
import { buttonClass } from "@/components/ui";
import { ArrowLeftIcon, CubeIcon } from "@/components/icons";
import { ARViewerClient } from "./ARViewerClient";
import { ARErrorBoundary } from "./ARErrorBoundary";

type Props = { params: Promise<{ slug: string; itemId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, itemId } = await params;
  const data = await getPublicItem(slug, itemId);
  return { title: data ? `${data.item.name} in 3D` : "3D view" };
}

export default async function ARPage({ params }: Props) {
  const { slug, itemId } = await params;
  const data = await getPublicItem(slug, itemId);
  if (!data) notFound();
  const { restaurant, item, asset } = data;
  const itemHref = `/r/${slug}/item/${itemId}`;

  if (!asset) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-950 p-6 text-center text-white">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <CubeIcon size={28} />
        </span>
        <div>
          <p className="text-lg font-semibold">3D view coming soon</p>
          <p className="mt-1 text-sm text-stone-400">This dish doesn’t have a 3D model yet.</p>
        </div>
        <Link href={itemHref} className={buttonClass("secondary", "md")}>
          Back to {item.name}
        </Link>
      </main>
    );
  }

  const platform = getMobilePlatform((await headers()).get("user-agent") ?? "");

  return (
    <main className="fixed inset-0 overflow-hidden bg-gradient-to-b from-stone-100 to-stone-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href={itemHref}
          className="pointer-events-auto inline-flex h-10 items-center gap-1 rounded-full bg-white/90 pl-2 pr-4 text-sm font-medium text-stone-800 shadow-lift backdrop-blur hover:bg-white"
        >
          <ArrowLeftIcon size={18} /> Back
        </Link>
        <p className="truncate rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-stone-800 backdrop-blur">
          {item.name}
        </p>
      </div>
      <ARErrorBoundary itemHref={itemHref} glbUrl={asset.glbUrl}>
        <ARViewerClient
          restaurantId={restaurant.id}
          itemId={item.id}
          itemName={item.name}
          platform={platform}
          glbUrl={asset.glbUrl}
          usdzUrl={asset.usdzUrl}
          scaleFactor={asset.scaleFactor}
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
