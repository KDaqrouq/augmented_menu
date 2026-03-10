"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  itemCount: number;
  categories: { id: string; name: string; sortOrder: number }[];
};

export function AdminDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/restaurants")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then(setRestaurants)
      .catch(() => setError("Failed to load restaurants"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Restaurants</h2>
      {restaurants.length === 0 ? (
        <p className="text-gray-500">No restaurants yet. Add one below.</p>
      ) : (
        <ul className="space-y-3">
          {restaurants.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded border border-gray-200 p-3"
            >
              <div>
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-sm text-gray-500">/{r.slug}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Menu URL:</span>
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {baseUrl}/r/{r.slug}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${baseUrl}/r/${r.slug}`);
                  }}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100"
                >
                  Copy
                </button>
              </div>
              <Link
                href={`/admin/restaurants/${r.id}`}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                Manage
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
