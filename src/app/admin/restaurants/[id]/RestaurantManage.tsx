"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Category = { id: string; name: string; sortOrder: number };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  isAvailable: boolean;
  measurementType: string;
  measurementValue: number;
  arAssetStatus: string;
  category: { id: string; name: string } | null;
  media: { id: string; url: string; sortOrder: number }[];
};

const MEASUREMENT_OPTIONS = [
  "PLATE_DIAMETER_CM",
  "BOWL_DIAMETER_CM",
  "CUP_HEIGHT_CM",
  "MAX_WIDTH_CM",
];

export function RestaurantManage({
  restaurantId,
  slug,
  categories: initialCategories,
  items: initialItems,
}: {
  restaurantId: string;
  slug: string;
  categories: Category[];
  items: Item[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);
  const [catName, setCatName] = useState("");
  const [catSortOrder, setCatSortOrder] = useState(0);
  const [catLoading, setCatLoading] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemMeasurementType, setItemMeasurementType] = useState("PLATE_DIAMETER_CM");
  const [itemMeasurementValue, setItemMeasurementValue] = useState(28);
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemLoading, setItemLoading] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch(`/api/admin/restaurants/${restaurantId}`);
    if (!res.ok) return;
    const data = await res.json();
    setCategories(data.categories ?? []);
    setItems(data.items ?? []);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCatLoading(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurantId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName, sortOrder: catSortOrder }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setCatName("");
      setCatSortOrder(categories.length);
      refresh();
    } catch {
      setError("Request failed");
    } finally {
      setCatLoading(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setItemLoading(true);
    try {
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          categoryId: itemCategoryId || null,
          name: itemName,
          description: itemDesc || null,
          price: itemPrice || null,
          measurementType: itemMeasurementType,
          measurementValue: itemMeasurementValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setItemName("");
      setItemDesc("");
      setItemPrice("");
      setItemMeasurementValue(28);
      refresh();
    } catch {
      setError("Request failed");
    } finally {
      setItemLoading(false);
    }
  }

  async function deleteCategory(categoryId: string, name: string) {
    if (!confirm(`Delete category "${name}"? Items in this category will become uncategorized.`)) {
      return;
    }
    setError("");
    setDeletingCategoryId(categoryId);
    try {
      const res = await fetch(
        `/api/admin/restaurants/${restaurantId}/categories/${categoryId}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete category");
        return;
      }
      refresh();
    } catch {
      setError("Request failed");
    } finally {
      setDeletingCategoryId(null);
    }
  }

  async function deleteItem(itemId: string, name: string) {
    if (!confirm(`Delete item "${name}"? This cannot be undone.`)) {
      return;
    }
    setError("");
    setDeletingItemId(itemId);
    try {
      const res = await fetch(`/api/admin/items/${itemId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete item");
        return;
      }
      refresh();
    } catch {
      setError("Request failed");
    } finally {
      setDeletingItemId(null);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Categories</h2>
        <ul className="mt-2 space-y-1">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span>
                {c.name} (sort: {c.sortOrder})
              </span>
              <button
                type="button"
                onClick={() => deleteCategory(c.id, c.name)}
                disabled={deletingCategoryId === c.id}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {deletingCategoryId === c.id ? "Deleting…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCategory} className="mt-3 flex flex-wrap items-end gap-3">
          <input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Category name"
            className="rounded border px-2 py-1"
            required
          />
          <input
            type="number"
            value={catSortOrder}
            onChange={(e) => setCatSortOrder(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1"
          />
          <button type="submit" disabled={catLoading} className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 disabled:opacity-50">
            {catLoading ? "Adding…" : "Add category"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Items</h2>
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1">
              {item.media?.[0] && (
                <img
                  src={item.media[0].url}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded object-cover"
                />
              )}
              <span className="font-medium">{item.name}</span>
              <span className="text-sm text-gray-500">
                {item.measurementType} {item.measurementValue}cm
              </span>
              <span className="text-xs text-gray-400">
                {item.media?.length ?? 0} photo{item.media?.length !== 1 ? "s" : ""}
              </span>
              <Link
                href={`/admin/restaurants/${restaurantId}/items/${item.id}`}
                className="text-sm text-blue-600 underline"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => deleteItem(item.id, item.name)}
                disabled={deletingItemId === item.id}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {deletingItemId === item.id ? "Deleting…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addItem} className="mt-3 flex flex-wrap gap-3 rounded border border-gray-200 p-3">
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Item name"
            className="rounded border px-2 py-1"
            required
          />
          <input
            value={itemDesc}
            onChange={(e) => setItemDesc(e.target.value)}
            placeholder="Description"
            className="rounded border px-2 py-1"
          />
          <input
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
            placeholder="Price"
            className="rounded border px-2 py-1"
          />
          <select
            value={itemCategoryId}
            onChange={(e) => setItemCategoryId(e.target.value)}
            className="rounded border px-2 py-1"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={itemMeasurementType}
            onChange={(e) => setItemMeasurementType(e.target.value)}
            className="rounded border px-2 py-1"
          >
            {MEASUREMENT_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={200}
            step={0.1}
            value={itemMeasurementValue}
            onChange={(e) => setItemMeasurementValue(Number(e.target.value))}
            className="w-20 rounded border px-2 py-1"
            title="1–200 cm"
          />
          <span className="self-center text-sm text-gray-500">cm (1–200)</span>
          <button type="submit" disabled={itemLoading} className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 disabled:opacity-50">
            {itemLoading ? "Adding…" : "Add item"}
          </button>
        </form>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <p>
        <Link href={`/r/${slug}`} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
          View public menu →
        </Link>
      </p>
    </div>
  );
}
