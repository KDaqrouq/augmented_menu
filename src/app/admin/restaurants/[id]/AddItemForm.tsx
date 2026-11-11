"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MeasurementType } from "@/lib/measurement";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { MeasurementFields } from "../../MeasurementFields";

export function AddItemForm({
  restaurantId,
  categories,
  defaultCategoryId,
  onDone,
  canCancel,
}: {
  restaurantId: string;
  categories: { id: string; name: string }[];
  defaultCategoryId: string;
  onDone: () => void;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [measurementType, setMeasurementType] = useState<MeasurementType>("PLATE_DIAMETER_CM");
  const [measurementValue, setMeasurementValue] = useState<number | "">(28);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          categoryId: categoryId || null,
          name,
          description: description || null,
          price: price || null,
          measurementType,
          measurementValue: measurementValue === "" ? null : measurementValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add dish");
        return;
      }
      // Straight to the dish page: photos and 3D are the next steps.
      router.push(`/admin/restaurants/${restaurantId}/items/${data.id}`);
      onDone();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Dish name" htmlFor="new-name">
          <input id="new-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required autoFocus />
        </Field>
        <Field label="Price" htmlFor="new-price">
          <input id="new-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$14" className={inputClass} />
        </Field>
      </div>
      <Field label="Description" htmlFor="new-desc">
        <textarea
          id="new-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </Field>
      <Field label="Category" htmlFor="new-cat">
        <select id="new-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">No category (shown under “More”)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <MeasurementFields
        idPrefix="new"
        type={measurementType}
        value={measurementValue}
        onTypeChange={setMeasurementType}
        onValueChange={setMeasurementValue}
      />
      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !name.trim()} className={buttonClass("primary", "md")}>
          {loading ? "Adding…" : "Add dish and upload photos"}
        </button>
        {canCancel && (
          <button type="button" onClick={onDone} className={buttonClass("ghost", "md")}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
