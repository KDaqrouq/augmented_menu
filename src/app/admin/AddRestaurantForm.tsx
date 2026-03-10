"use client";

import { useState } from "react";

export function AddRestaurantForm({ onAdded }: { onAdded?: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/\s+/g, "-") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create");
        return;
      }
      setName("");
      setSlug("");
      onAdded?.();
      if (typeof window !== "undefined") window.location.reload();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3 rounded border border-gray-200 p-3">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 rounded border border-gray-300 px-2 py-1"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Slug (URL)</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. my-place"
          className="mt-1 rounded border border-gray-300 px-2 py-1"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-green-600 px-3 py-1.5 text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Adding…" : "Add restaurant"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
