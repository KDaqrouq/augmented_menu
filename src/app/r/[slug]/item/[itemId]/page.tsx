import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ItemViewTracker } from "./ItemViewTracker";

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
    },
  });
  if (!item) notFound();

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
          <Link
            href={`/r/${slug}/item/${itemId}/ar`}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
          >
            View in AR
          </Link>
        </div>
      </div>
    </main>
  );
}
