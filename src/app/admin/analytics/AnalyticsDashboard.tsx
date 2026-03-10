"use client";

import { useState, useEffect } from "react";

type Stats = {
  totalEvents: number;
  byEventName: Record<string, number>;
  topItems: { itemId: string; count: number }[];
  byDeviceType: Record<string, number>;
  byArMode: Record<string, number>;
};

type Restaurant = { id: string; name: string; slug: string };

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/restaurants")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((list: Restaurant[]) => setRestaurants(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = restaurantId
      ? `/api/admin/analytics?restaurantId=${encodeURIComponent(restaurantId)}`
      : "/api/admin/analytics";
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then(setStats)
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (loading && !stats) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <label className="mr-2 text-sm font-medium">Filter by restaurant:</label>
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All restaurants</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-500">Total events</h3>
          <p className="mt-1 text-2xl font-bold">{stats.totalEvents}</p>
        </div>
      </div>

      <div className="rounded border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-500">By event name</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {Object.entries(stats.byEventName)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => (
              <li key={name} className="flex justify-between gap-4">
                <span>{name}</span>
                <span className="font-mono">{count}</span>
              </li>
            ))}
        </ul>
      </div>

      <div className="rounded border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-500">Top items (by views)</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {stats.topItems.length === 0 ? (
            <li className="text-gray-500">No item views yet</li>
          ) : (
            stats.topItems.map(({ itemId, count }) => (
              <li key={itemId} className="flex justify-between gap-4">
                <code className="text-xs">{itemId.slice(0, 8)}…</code>
                <span className="font-mono">{count}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-500">Device breakdown</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(stats.byDeviceType)
              .sort(([, a], [, b]) => b - a)
              .map(([device, count]) => (
                <li key={device} className="flex justify-between gap-4">
                  <span>{device}</span>
                  <span className="font-mono">{count}</span>
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-500">AR mode</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(stats.byArMode)
              .sort(([, a], [, b]) => b - a)
              .map(([mode, count]) => (
                <li key={mode} className="flex justify-between gap-4">
                  <span>{mode}</span>
                  <span className="font-mono">{count}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
