"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, CardHeader, buttonClass, cn, inputClass } from "@/components/ui";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";

type Category = { id: string; name: string; itemCount: number };

export function CategoriesPanel({ restaurantId, categories }: { restaurantId: string; categories: Category[] }) {
  const router = useRouter();
  const [list, setList] = useState(categories);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Server data wins after router.refresh().
  const [lastProp, setLastProp] = useState(categories);
  if (lastProp !== categories) {
    setLastProp(categories);
    setList(categories);
  }

  const base = `/api/admin/restaurants/${restaurantId}/categories`;

  async function call(url: string, init: RequestInit): Promise<boolean> {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call(base, { method: "POST", body: JSON.stringify({ name: newName }) })) setNewName("");
  }

  async function rename(id: string) {
    if (await call(`${base}/${id}`, { method: "PATCH", body: JSON.stringify({ name: editName }) })) setEditingId(null);
  }

  async function remove(c: Category) {
    const note = c.itemCount
      ? ` Its ${c.itemCount} dish${c.itemCount === 1 ? "" : "es"} will stay on the menu under “More”.`
      : "";
    if (!confirm(`Delete category “${c.name}”?${note}`)) return;
    await call(`${base}/${c.id}`, { method: "DELETE" });
  }

  async function move(index: number, delta: -1 | 1) {
    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved);
    setList(next);
    await call(base, { method: "PATCH", body: JSON.stringify({ order: next.map((c) => c.id) }) });
  }

  return (
    <Card>
      <CardHeader title="Categories" description="Order here is the order on the menu." />
      <div className="p-3">
        {list.length === 0 ? (
          <p className="px-2 py-3 text-sm text-stone-500">No categories yet. Dishes without one appear under “More”.</p>
        ) : (
          <ul className="space-y-1">
            {list.map((c, i) => (
              <li key={c.id} className="group flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-stone-50">
                {editingId === c.id ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      rename(c.id);
                    }}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                      className={cn(inputClass, "h-8 py-1")}
                    />
                    <button type="submit" disabled={busy} className={buttonClass("ghost", "sm", "px-2")} aria-label="Save name">
                      <CheckIcon size={16} />
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">{c.name}</span>
                    <span className="mr-1 text-xs tabular-nums text-stone-400">{c.itemCount}</span>
                    <div className="flex items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <IconButton label="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                        <ChevronUpIcon size={16} />
                      </IconButton>
                      <IconButton label="Move down" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)}>
                        <ChevronDownIcon size={16} />
                      </IconButton>
                      <IconButton
                        label="Rename"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                        }}
                      >
                        <PencilIcon size={15} />
                      </IconButton>
                      <IconButton label="Delete" disabled={busy} onClick={() => remove(c)} danger>
                        <TrashIcon size={15} />
                      </IconButton>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-2 flex gap-2 border-t border-stone-100 px-1 pt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category"
            className={cn(inputClass, "h-9 py-1.5")}
            required
          />
          <button type="submit" disabled={busy || !newName.trim()} className={buttonClass("secondary", "sm", "h-9")}>
            <PlusIcon size={16} /> Add
          </button>
        </form>
        {error && <Alert className="mt-3">{error}</Alert>}
      </div>
    </Card>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 disabled:opacity-30",
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-stone-200 hover:text-stone-900"
      )}
    >
      {children}
    </button>
  );
}
