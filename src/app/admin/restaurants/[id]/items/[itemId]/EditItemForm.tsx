"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MeasurementType } from "@/lib/measurement";
import { Alert, Card, CardHeader, Field, buttonClass, inputClass } from "@/components/ui";
import { MeasurementFields } from "@/app/admin/MeasurementFields";

type Values = {
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
  categoryId: string;
  measurementType: MeasurementType;
  measurementValue: number;
};

export function EditItemForm({
  itemId,
  restaurantId,
  categories,
  hasModel,
  initial,
}: {
  itemId: string;
  restaurantId: string;
  categories: { id: string; name: string }[];
  hasModel: boolean;
  initial: Values;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [isAvailable, setIsAvailable] = useState(initial.isAvailable);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [measurementType, setMeasurementType] = useState(initial.measurementType);
  const [measurementValue, setMeasurementValue] = useState<number | "">(initial.measurementValue);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<"saved" | "regenerate" | null>(null);

  const sizeEdited = measurementType !== saved.measurementType || measurementValue !== saved.measurementValue;
  const dirty =
    sizeEdited ||
    name !== saved.name ||
    description !== saved.description ||
    price !== saved.price ||
    isAvailable !== saved.isAvailable ||
    categoryId !== saved.categoryId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price,
          isAvailable,
          categoryId: categoryId || null,
          measurementType,
          measurementValue: measurementValue === "" ? null : measurementValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setSaved({
        name,
        description,
        price,
        isAvailable,
        categoryId,
        measurementType,
        measurementValue: measurementValue === "" ? saved.measurementValue : measurementValue,
      });
      setNotice(data.needsRegeneration ? "regenerate" : "saved");
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete “${saved.name}”? Its photos and 3D model are deleted too.`)) return;
    setError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/items/${itemId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete");
        return;
      }
      router.push(`/admin/restaurants/${restaurantId}`);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Details" />
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Dish name" htmlFor="edit-name">
            <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </Field>
          <Field label="Price" htmlFor="edit-price">
            <input id="edit-price" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Description" htmlFor="edit-desc">
          <textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            rows={3}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="edit-cat">
            <select id="edit-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">No category (shown under “More”)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Visibility" htmlFor="edit-available">
            <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 text-sm shadow-sm">
              <input
                id="edit-available"
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 accent-brand-600"
              />
              Show on the menu
            </label>
          </Field>
        </div>
        <MeasurementFields
          idPrefix="edit"
          type={measurementType}
          value={measurementValue}
          onTypeChange={setMeasurementType}
          onValueChange={setMeasurementValue}
        />
        {hasModel && sizeEdited && (
          <Alert tone="amber">
            The iPhone and Android AR files have the current size built in. After saving, generate the 3D model again so
            they match.
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
        {notice === "saved" && !dirty && <Alert tone="green">Saved.</Alert>}
        {notice === "regenerate" && !dirty && (
          <Alert tone="amber">Saved. Generate the 3D model again so iPhone and Android AR use the new size.</Alert>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="submit" disabled={loading || deleting || !dirty} className={buttonClass("primary", "md")}>
            {loading ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading || deleting}
            className={buttonClass("danger", "md", "ml-auto")}
          >
            {deleting ? "Deleting…" : "Delete dish"}
          </button>
        </div>
      </form>
    </Card>
  );
}
