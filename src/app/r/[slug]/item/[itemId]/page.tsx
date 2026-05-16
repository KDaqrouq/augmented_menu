import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { isIOSUserAgent } from "@/lib/device";
import { ItemViewTracker } from "./ItemViewTracker";
import { ViewInARButton } from "./ViewInARButton";

export default async function ItemDetailPage({
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
    where: { id: itemId, restaurantId: restaurant.id, isAvailable: true },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      category: { select: { name: true } },
      assets: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!item) notFound();

  const asset = item.assets[0];
  const usdzUrl =
    asset?.usdzUrl != null
      ? `${asset.usdzUrl}${asset.usdzUrl.includes("?") ? "&" : "?"}v=${asset.version}`
      : undefined;

  const userAgent = (await headers()).get("user-agent") ?? "";
  const isIOS = isIOSUserAgent(userAgent);

  return (
    <main className="min-h-screen bg-gray-50">
      <ItemViewTracker restaurantId={restaurant.id} itemId={item.id} />
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href={`/r/${slug}`}
            className="text-sm font-medium text-blue-600 underline"
          >
            ← Menu
          </Link>
          <span className="text-gray-400">|</span>
          <h1 className="truncate text-lg font-bold text-gray-900">
            {item.name}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {item.media.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {item.media.map((m) => (
              <img
                key={m.id}
                src={m.url}
                alt=""
                className="h-48 w-48 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        {item.category && (
          <p className="text-sm text-gray-500">{item.category.name}</p>
        )}
        {item.price && (
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {item.price}
          </p>
        )}
        {item.description && (
          <p className="mt-3 text-gray-700">{item.description}</p>
        )}

        <div className="mt-8">
          <ViewInARButton
            slug={slug}
            itemId={itemId}
            restaurantId={restaurant.id}
            isIOS={isIOS}
            usdzUrl={usdzUrl}
          />
        </div>
      </div>
    </main>
  );
}
