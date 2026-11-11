"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/slug";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";

export function AddRestaurantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const effectiveSlug = slugify(slugEdited ? slug : name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: effectiveSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create");
        return;
      }
      router.push(`/admin/restaurants/${data.id}`);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Name" htmlFor="restaurant-name">
        <input
          id="restaurant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Trattoria Roma"
          className={inputClass}
          required
        />
      </Field>
      <Field
        label="Menu URL"
        htmlFor="restaurant-slug"
        hint={
          <>
            Diners will open <span className="font-mono text-stone-700">/r/{effectiveSlug || "…"}</span>
          </>
        }
      >
        <input
          id="restaurant-slug"
          value={slugEdited ? slug : effectiveSlug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(e.target.value);
          }}
          placeholder="trattoria-roma"
          className={`${inputClass} font-mono`}
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      <button type="submit" disabled={loading || !name.trim()} className={buttonClass("primary", "md", "w-full")}>
        {loading ? "Creating…" : "Create restaurant"}
      </button>
    </form>
  );
}
