"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MEASUREMENT_LABELS, type MeasurementType } from "@/lib/measurement";
import { Alert, Card, CardHeader, EmptyState, buttonClass, cn } from "@/components/ui";
import { PhotoIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ModelStatusBadge } from "../../ModelStatusBadge";
import { AddItemForm } from "./AddItemForm";

type Item = {
  id: string;
  name: string;
  price: string | null;
  isAvailable: boolean;
  measurementType: MeasurementType;
  measurementValue: number;
  arAssetStatus: string;
  categoryId: string | null;
  thumbnail: string | null;
  photoCount: number;
  hasModel: boolean;
};

const ALL = "__all";
const NONE = "__none";

export function ItemsPanel({
  restaurantId,
  categories,
  items,
}: {
  restaurantId: string;
  categories: { id: string; name: string }[];
  items: Item[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState(ALL);
  const [adding, setAdding] = useState(items.length === 0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const hasUncategorized = items.some((i) => !i.categoryId);
  const visible = items.filter((i) =>
    filter === ALL ? true : filter === NONE ? !i.categoryId : i.categoryId === filter
  );

  async function mutate(id: string, init: RequestInit) {
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/items/${id}`, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Something went wrong");
      else router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Dishes"
        description={`${items.length} on this menu`}
        action={
          !adding && (
            <button type="button" onClick={() => setAdding(true)} className={buttonClass("primary", "sm")}>
              <PlusIcon size={16} /> Add dish
            </button>
          )
        }
      />

      {adding && (
        <div className="border-b border-stone-100 bg-stone-50/60 p-5">
          <AddItemForm
            restaurantId={restaurantId}
            categories={categories}
            defaultCategoryId={filter !== ALL && filter !== NONE ? filter : ""}
            onDone={() => setAdding(false)}
            canCancel={items.length > 0}
          />
        </div>
      )}

      {(categories.length > 0 || hasUncategorized) && items.length > 0 && (
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto border-b border-stone-100 px-5 py-3">
          {[
            { id: ALL, name: "All" },
            ...categories,
            ...(hasUncategorized ? [{ id: NONE, name: "No category" }] : []),
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                filter === c.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {error && <Alert className="m-5 mb-0">{error}</Alert>}

      {items.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<PhotoIcon size={32} />} title="No dishes yet">
            Add a dish, upload 4 photos (front, left, back, right), then generate its 3D model.
          </EmptyState>
        </div>
      ) : visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-stone-500">No dishes in this category.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {visible.map((item) => (
            <li key={item.id} className={cn("flex items-center gap-4 px-5 py-3", busyId === item.id && "opacity-60")}>
              <Link
                href={`/admin/restaurants/${restaurantId}/items/${item.id}`}
                className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-stone-300"
              >
                {item.thumbnail ? (
                  <Image src={item.thumbnail} alt="" fill sizes="56px" className="object-cover" />
                ) : (
                  <PhotoIcon size={22} />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/admin/restaurants/${restaurantId}/items/${item.id}`}
                    className="truncate font-medium text-stone-900 hover:text-brand-700"
                  >
                    {item.name}
                  </Link>
                  {item.price && <span className="text-sm tabular-nums text-stone-500">{item.price}</span>}
                  {!item.isAvailable && <span className="text-xs font-medium text-amber-700">Hidden</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                  <span>{item.categoryId ? categoryName.get(item.categoryId) : "No category"}</span>
                  <span>
                    {item.measurementValue} cm {MEASUREMENT_LABELS[item.measurementType].label.toLowerCase()}
                  </span>
                  <span className={item.photoCount < 4 ? "text-amber-700" : undefined}>
                    {item.photoCount} photo{item.photoCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="hidden sm:block">
                <ModelStatusBadge status={item.arAssetStatus} hasModel={item.hasModel} />
              </div>
              <label className="hidden cursor-pointer items-center gap-2 text-xs text-stone-500 md:flex" title="Show on the menu">
                <input
                  type="checkbox"
                  checked={item.isAvailable}
                  disabled={busyId === item.id}
                  onChange={(e) =>
                    mutate(item.id, { method: "PATCH", body: JSON.stringify({ isAvailable: e.target.checked }) })
                  }
                  className="h-4 w-4 rounded border-stone-300 accent-brand-600"
                />
                On menu
              </label>
              <div className="flex items-center gap-1">
                <Link
                  href={`/admin/restaurants/${restaurantId}/items/${item.id}`}
                  className={buttonClass("secondary", "sm")}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  aria-label={`Delete ${item.name}`}
                  disabled={busyId === item.id}
                  onClick={() => {
                    if (confirm(`Delete “${item.name}”? Its photos and 3D model are deleted too.`)) {
                      mutate(item.id, { method: "DELETE" });
                    }
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
