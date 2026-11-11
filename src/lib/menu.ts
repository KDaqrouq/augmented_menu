import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "./db";
import { computeScaleFactor, isBakedScaleStale } from "./scale";
import type { MeasurementType } from "./measurement";

/**
 * Public (diner-facing) menu data, cached across requests.
 * Admin mutations call revalidatePublicMenu(); the worker runs outside Next, so a model
 * that finishes generating shows up within REVALIDATE_SECONDS.
 */

const PUBLIC_MENU_TAG = "public-menu";
const REVALIDATE_SECONDS = 60;

/** Pseudo-category for items with no category, so they are never hidden from diners. */
export const UNCATEGORIZED_ID = "uncategorized";
export const UNCATEGORIZED_NAME = "More";

export type PublicMenuItem = {
  id: string;
  name: string;
  description?: string;
  price?: string;
  thumbnail?: string;
  hasAR: boolean;
};

export type PublicMenuCategory = {
  id: string;
  name: string;
  items: PublicMenuItem[];
};

export type PublicMenu = {
  restaurant: { id: string; name: string; slug: string };
  categories: PublicMenuCategory[];
};

export type PublicAsset = {
  version: number;
  glbUrl: string;
  usdzUrl?: string;
  arGlbUrl?: string;
  bboxX: number;
  bboxY: number;
  bboxZ: number;
  /** Scale for the in-browser viewer, from the item's current measurement. */
  scaleFactor: number;
  /** USDZ / Android GLB were generated for a different size than the current measurement. */
  bakedScaleStale: boolean;
};

export type PublicItem = {
  restaurant: { id: string; name: string; slug: string };
  item: {
    id: string;
    name: string;
    description?: string;
    price?: string;
    categoryName?: string;
    measurementType: MeasurementType;
    measurementValue: number;
    photos: { id: string; url: string }[];
  };
  asset?: PublicAsset;
};

export function withVersion(url: string, version: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}

async function loadPublicMenu(slug: string): Promise<PublicMenu | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } },
      items: {
        where: { isAvailable: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          categoryId: true,
          media: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          assets: { take: 1, select: { id: true } },
        },
      },
    },
  });
  if (!restaurant) return null;

  const byCategory = new Map<string, PublicMenuItem[]>();
  for (const item of restaurant.items) {
    const key = item.categoryId ?? UNCATEGORIZED_ID;
    const list = byCategory.get(key) ?? [];
    list.push({
      id: item.id,
      name: item.name,
      description: item.description ?? undefined,
      price: item.price ?? undefined,
      thumbnail: item.media[0]?.url,
      hasAR: item.assets.length > 0,
    });
    byCategory.set(key, list);
  }

  const categories: PublicMenuCategory[] = restaurant.categories
    .map((c) => ({ id: c.id, name: c.name, items: byCategory.get(c.id) ?? [] }))
    .filter((c) => c.items.length > 0);
  const uncategorized = byCategory.get(UNCATEGORIZED_ID);
  if (uncategorized?.length) {
    categories.push({
      id: UNCATEGORIZED_ID,
      name: categories.length === 0 ? "Menu" : UNCATEGORIZED_NAME,
      items: uncategorized,
    });
  }

  return {
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    categories,
  };
}

async function loadPublicItem(slug: string, itemId: string): Promise<PublicItem | null> {
  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, isAvailable: true, restaurant: { slug } },
    include: {
      restaurant: { select: { id: true, name: true, slug: true } },
      media: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true } },
      category: { select: { name: true } },
      assets: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!item) return null;

  const latest = item.assets[0];
  let asset: PublicAsset | undefined;
  if (latest) {
    const scaleFactor = computeScaleFactor(
      item.measurementType,
      item.measurementValue,
      latest.bboxX,
      latest.bboxY,
      latest.bboxZ
    );
    asset = {
      version: latest.version,
      glbUrl: withVersion(latest.glbUrl, latest.version),
      usdzUrl: latest.usdzUrl ? withVersion(latest.usdzUrl, latest.version) : undefined,
      arGlbUrl: latest.arGlbUrl ? withVersion(latest.arGlbUrl, latest.version) : undefined,
      bboxX: latest.bboxX,
      bboxY: latest.bboxY,
      bboxZ: latest.bboxZ,
      scaleFactor,
      bakedScaleStale: isBakedScaleStale(latest.scaleFactor, scaleFactor),
    };
  }

  return {
    restaurant: item.restaurant,
    item: {
      id: item.id,
      name: item.name,
      description: item.description ?? undefined,
      price: item.price ?? undefined,
      categoryName: item.category?.name,
      measurementType: item.measurementType,
      measurementValue: item.measurementValue,
      photos: item.media,
    },
    asset,
  };
}

export const getPublicMenu = unstable_cache(loadPublicMenu, ["public-menu"], {
  tags: [PUBLIC_MENU_TAG],
  revalidate: REVALIDATE_SECONDS,
});

export const getPublicItem = unstable_cache(loadPublicItem, ["public-item"], {
  tags: [PUBLIC_MENU_TAG],
  revalidate: REVALIDATE_SECONDS,
});

/** Call after any admin change that diners can see. */
export function revalidatePublicMenu(): void {
  revalidateTag(PUBLIC_MENU_TAG, { expire: 0 });
}
