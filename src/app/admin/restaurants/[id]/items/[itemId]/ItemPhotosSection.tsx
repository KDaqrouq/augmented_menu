"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Alert, Badge, Card, CardHeader, Spinner, cn } from "@/components/ui";
import { ArrowLeftIcon, ChevronRightIcon, PhotoIcon, PlusIcon, TrashIcon } from "@/components/icons";

type Media = { id: string; url: string; sortOrder: number };

const MAX_PHOTOS = 12;
const VIEW_LABELS = ["Front", "Left", "Back", "Right"];

/**
 * Photo manager. The first four photos feed 3D generation as front, left, back, right,
 * so each of those slots is labeled and photos can be dragged (or nudged) into place.
 */
export function ItemPhotosSection({ itemId, media: initialMedia }: { itemId: string; media: Media[] }) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = Math.max(0, MAX_PHOTOS - media.length);
  const base = `/api/admin/items/${itemId}/photos`;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError("");
    setUploading(true);
    const formData = new FormData();
    list.forEach((f) => formData.append("files", f));
    try {
      const res = await fetch(base, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (data.uploaded?.length) setMedia((prev) => [...prev, ...data.uploaded]);
      if (!res.ok) setError(data.error ?? "Upload failed");
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveOrder(next: Media[]) {
    const previous = media;
    setMedia(next);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((m) => m.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMedia(previous);
        setError(data.error ?? "Could not save the new order");
        return;
      }
      setMedia(data.media);
      router.refresh();
    } catch {
      setMedia(previous);
      setError("Could not save the new order");
    } finally {
      setBusy(false);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= media.length || from === to) return;
    const next = [...media];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveOrder(next);
  }

  async function remove(m: Media, index: number) {
    const label = index < 4 ? `the ${VIEW_LABELS[index].toLowerCase()} photo` : "this photo";
    if (!confirm(`Delete ${label}?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${base}/${m.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not delete the photo");
        return;
      }
      setMedia(data.media);
      router.refresh();
    } catch {
      setError("Could not delete the photo");
    } finally {
      setBusy(false);
    }
  }

  const missingViews = VIEW_LABELS.slice(media.length);

  return (
    <Card>
      <CardHeader
        title="Photos"
        description="The first four are used to build the 3D model, in this order. Drag to reorder."
        action={
          <Badge tone={media.length >= 4 ? "green" : "amber"}>
            {media.length}/{MAX_PHOTOS}
          </Badge>
        }
      />
      <div className="p-5">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((m, index) => (
            <li
              key={m.id}
              draggable={!busy}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => {
                if (dragIndex !== null) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={cn(
                "group relative aspect-square cursor-grab overflow-hidden rounded-xl border bg-stone-100 active:cursor-grabbing",
                index < 4 ? "border-brand-200" : "border-stone-200",
                dragIndex === index && "opacity-40"
              )}
            >
              <Image src={m.url} alt="" fill sizes="(min-width: 640px) 180px, 45vw" className="object-cover" draggable={false} />
              <span
                className={cn(
                  "absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold shadow-sm",
                  index < 4 ? "bg-brand-600 text-white" : "bg-white/90 text-stone-600"
                )}
              >
                {index < 4 ? `${index + 1} · ${VIEW_LABELS[index]}` : "Gallery"}
              </span>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <div className="flex gap-1">
                  <TileButton label="Move earlier" disabled={busy || index === 0} onClick={() => move(index, index - 1)}>
                    <ArrowLeftIcon size={15} />
                  </TileButton>
                  <TileButton
                    label="Move later"
                    disabled={busy || index === media.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronRightIcon size={15} />
                  </TileButton>
                </div>
                <TileButton label="Delete photo" disabled={busy} onClick={() => remove(m, index)}>
                  <TrashIcon size={15} />
                </TileButton>
              </div>
            </li>
          ))}

          {missingViews.map((label, i) => (
            <li
              key={label}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 text-center text-brand-700"
            >
              <PhotoIcon size={22} />
              <span className="text-xs font-semibold">
                {media.length + i + 1} · {label}
              </span>
            </li>
          ))}
        </ul>

        {remaining > 0 && (
          <div
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDropActive(true);
              }
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
            }}
            className={cn(
              "mt-4 rounded-2xl border-2 border-dashed p-5 text-center transition-colors",
              dropActive ? "border-brand-400 bg-brand-50" : "border-stone-200"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => e.target.files && upload(e.target.files)}
              disabled={uploading}
              className="sr-only"
              id={`upload-${itemId}`}
            />
            <label
              htmlFor={`upload-${itemId}`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              {uploading ? <Spinner /> : <PlusIcon size={16} />}
              {uploading ? "Uploading…" : "Add photos"}
            </label>
            <p className="mt-2 text-xs text-stone-500">
              Or drop images here. JPEG, PNG or WebP up to 10 MB, {remaining} more allowed. Shoot each side on a plain
              background in even light.
            </p>
          </div>
        )}

        {error && <Alert className="mt-4">{error}</Alert>}
      </div>
    </Card>
  );
}

function TileButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-stone-700 shadow-sm hover:bg-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
