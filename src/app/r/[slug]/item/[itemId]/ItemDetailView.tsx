import Link from "next/link";
import type { PublicItem, PublicAsset } from "@/lib/menu";
import type { MobilePlatform } from "@/lib/device";
import { sceneViewerIntentUrl } from "@/lib/ar-links";
import { MEASUREMENT_LABELS, type MeasurementType } from "@/lib/measurement";
import { buttonClass } from "@/components/ui";
import { ArrowLeftIcon, CubeIcon, RulerIcon } from "@/components/icons";
import { ItemViewTracker } from "./ItemViewTracker";
import { PhotoGallery } from "./PhotoGallery";
import { TrackedARLink } from "./TrackedARLink";

/** Dish page body (no data fetching), so it can be rendered from any data source. */
export function ItemDetailView({
  slug,
  data,
  platform,
  origin,
}: {
  slug: string;
  data: PublicItem;
  platform: MobilePlatform;
  origin: string;
}) {
  const { restaurant, item, asset } = data;
  const viewerHref = `/r/${slug}/item/${item.id}/ar`;

  return (
    <main className="min-h-screen bg-stone-50 pb-36">
      <ItemViewTracker restaurantId={restaurant.id} itemId={item.id} />

      <div className="relative mx-auto max-w-2xl sm:px-4 sm:pt-4">
        <PhotoGallery photos={item.photos} alt={item.name} />
        <Link
          href={`/r/${slug}`}
          className="absolute left-3 top-3 inline-flex h-10 items-center gap-1 rounded-full bg-white/90 pl-2 pr-4 text-sm font-medium text-stone-800 shadow-lift backdrop-blur hover:bg-white sm:left-7 sm:top-7"
        >
          <ArrowLeftIcon size={18} /> Menu
        </Link>
      </div>

      <article className="mx-auto max-w-2xl px-4 pt-5">
        {item.categoryName && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{item.categoryName}</p>
        )}
        <div className="mt-1 flex items-start justify-between gap-4">
          <h1 className="font-display text-3xl font-semibold leading-tight text-stone-900">{item.name}</h1>
          {item.price && <p className="pt-1 text-xl font-semibold tabular-nums text-stone-900">{item.price}</p>}
        </div>
        {item.description && <p className="mt-3 text-[15px] leading-relaxed text-stone-600">{item.description}</p>}

        {asset && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-card">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <RulerIcon size={20} />
            </span>
            <p className="text-sm text-stone-600">
              <span className="font-medium text-stone-900">Shown at real size</span> ·{" "}
              {sizeLabel(item.measurementType, item.measurementValue)}
            </p>
          </div>
        )}
        <p className="mt-8 text-center text-xs text-stone-400">{restaurant.name}</p>
      </article>

      {asset && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-4 pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <ARActions
              platform={platform}
              asset={asset}
              title={item.name}
              restaurantId={restaurant.id}
              itemId={item.id}
              viewerHref={viewerHref}
              fallbackUrl={`${origin}${viewerHref}`}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function sizeLabel(type: MeasurementType, value: number): string {
  const label = MEASUREMENT_LABELS[type]?.label.toLowerCase() ?? "size";
  return `${Number(value.toFixed(1))} cm ${label}`;
}

/**
 * iOS with a USDZ → AR Quick Look in one tap. Android with a baked GLB → Scene Viewer in one tap.
 * Everyone else (and the secondary link) → our in-browser 3D / WebXR viewer.
 */
function ARActions({
  platform,
  asset,
  title,
  restaurantId,
  itemId,
  viewerHref,
  fallbackUrl,
}: {
  platform: MobilePlatform;
  asset: PublicAsset;
  title: string;
  restaurantId: string;
  itemId: string;
  viewerHref: string;
  fallbackUrl: string;
}) {
  const primary = buttonClass("primary", "lg", "w-full");
  const label = (
    <>
      <CubeIcon size={20} /> View on your table
    </>
  );

  const nativeHref =
    platform === "ios" && asset.usdzUrl
      ? { href: asset.usdzUrl, mode: "quicklook" as const }
      : platform === "android" && asset.arGlbUrl
        ? {
            href: sceneViewerIntentUrl({ glbUrl: asset.arGlbUrl, title, fallbackUrl }),
            mode: "sceneviewer" as const,
          }
        : null;

  if (!nativeHref) {
    return (
      <Link href={viewerHref} className={primary}>
        {platform === "other" ? (
          <>
            <CubeIcon size={20} /> View in 3D
          </>
        ) : (
          label
        )}
      </Link>
    );
  }

  return (
    <>
      <TrackedARLink
        href={nativeHref.href}
        arMode={nativeHref.mode}
        restaurantId={restaurantId}
        itemId={itemId}
        className={primary}
      >
        {label}
      </TrackedARLink>
      <Link href={viewerHref} className="py-1 text-center text-sm font-medium text-stone-500 hover:text-stone-800">
        Or rotate it in 3D
      </Link>
    </>
  );
}
