"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MEASUREMENT_OPTIONS = [
  "PLATE_DIAMETER_CM",
  "BOWL_DIAMETER_CM",
  "CUP_HEIGHT_CM",
  "MAX_WIDTH_CM",
];

export function EditItemForm({
  itemId,
  restaurantId,
  initial,
}: {
  itemId: string;
  restaurantId: string;
  initial: {
    name: string;
    description: string;
    price: string;
    isAvailable: boolean;
    measurementType: string;
    measurementValue: number;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [isAvailable, setIsAvailable] = useState(initial.isAvailable);
  const [measurementType, setMeasurementType] = useState(initial.measurementType);
  const [measurementValue, setMeasurementValue] = useState(initial.measurementValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          price: price || null,
          isAvailable,
          measurementType,
          measurementValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update");
        return;
      }
      router.push(`/admin/restaurants/${restaurantId}`);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Price</label>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="available"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
        />
        <label htmlFor="available" className="text-sm font-medium text-gray-700">Available</label>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Measurement type</label>
        <select
          value={measurementType}
          onChange={(e) => setMeasurementType(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
        >
          {MEASUREMENT_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Measurement value (cm, 1–200)
        </label>
        <input
          type="number"
          min={1}
          max={200}
          step={0.1}
          value={measurementValue}
          onChange={(e) => setMeasurementValue(Number(e.target.value))}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1"
        />
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <Link
          href={`/admin/restaurants/${restaurantId}`}
          className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
