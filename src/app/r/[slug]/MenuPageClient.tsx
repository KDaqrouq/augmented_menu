"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

type Item = {
  id: string;
  name: string;
  description?: string;
  price?: string;
  thumbnail?: string;
  arAssetStatus: string;
};

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  items: Item[];
};

export function MenuPageClient({
  slug,
  restaurantId,
  restaurantName,
  categories,
}: {
  slug: string;
  restaurantId: string;
  restaurantName: string;
  categories: Category[];
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    trackEvent("menu_view", { restaurantId });
  }, [restaurantId]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.description?.toLowerCase().includes(q) ?? false)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, search]);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-bold text-gray-900">{restaurantName}</h1>
          <p className="text-sm text-gray-500">Menu</p>
          <div className="mt-3">
            <input
              type="search"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-label="Search menu items"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {filteredCategories.length === 0 ? (
          <p className="text-center text-gray-500">
            {search.trim() ? "No items match your search." : "No menu items yet."}
          </p>
        ) : (
          <ul className="space-y-8">
            {filteredCategories.map((cat) => (
              <li key={cat.id}>
                <h2 className="mb-3 text-lg font-semibold text-gray-800">
                  {cat.name}
                </h2>
                <ul className="space-y-2">
                  {cat.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/r/${slug}/item/${item.id}`}
                        className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300 hover:shadow"
                      >
                        {item.thumbnail && (
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-gray-900">
                            {item.name}
                          </span>
                          {item.price && (
                            <span className="ml-2 text-sm font-medium text-gray-600">
                              {item.price}
                            </span>
                          )}
                          {item.description && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
