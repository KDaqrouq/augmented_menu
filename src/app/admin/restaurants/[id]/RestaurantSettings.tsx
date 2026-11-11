"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/slug";
import { Alert, Card, CardHeader, Field, buttonClass, inputClass } from "@/components/ui";

export function RestaurantSettings({ restaurantId, name, slug }: { restaurantId: string; name: string; slug: string }) {
  const router = useRouter();
  const [newName, setNewName] = useState(name);
  const [newSlug, setNewSlug] = useState(slug);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const normalizedSlug = slugify(newSlug);
  const slugChanged = normalizedSlug !== slug;
  const dirty = newName.trim() !== name || slugChanged;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (slugChanged && !confirm(`Change the menu URL to /r/${normalizedSlug}? QR codes already printed for /r/${slug} will stop working.`)) {
      return;
    }
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, slug: normalizedSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setNewSlug(data.slug);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const typed = prompt(`This deletes ${name}, all its dishes, photos and 3D models. Type the restaurant name to confirm.`);
    if (typed?.trim() !== name) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurantId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Settings" />
      <form onSubmit={save} className="space-y-4 p-5">
        <Field label="Restaurant name" htmlFor="settings-name">
          <input id="settings-name" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} required />
        </Field>
        <Field
          label="Menu URL"
          htmlFor="settings-slug"
          hint={slugChanged ? <span className="text-amber-700">Printed QR codes point to the old URL.</span> : undefined}
        >
          <div className="flex items-center rounded-xl border border-stone-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
            <span className="pl-3 font-mono text-sm text-stone-400">/r/</span>
            <input
              id="settings-slug"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="w-full rounded-xl bg-transparent px-1 py-2 font-mono text-sm focus:outline-none"
              required
            />
          </div>
        </Field>
        {error && <Alert>{error}</Alert>}
        {saved && !dirty && <Alert tone="green">Saved.</Alert>}
        <button type="submit" disabled={saving || !dirty} className={buttonClass("secondary", "md", "w-full")}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
      <div className="border-t border-stone-100 p-5">
        <button type="button" onClick={remove} disabled={deleting} className={buttonClass("danger", "md", "w-full")}>
          {deleting ? "Deleting…" : "Delete restaurant"}
        </button>
      </div>
    </Card>
  );
}
