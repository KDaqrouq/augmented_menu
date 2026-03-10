"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Media = { id: string; url: string; sortOrder: number };

export function ItemPhotosSection({
  itemId,
  media: initialMedia,
}: {
  itemId: string;
  media: Media[];
}) {
  const router = useRouter();
  const [media, setMedia] = useState(initialMedia);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setError("");
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    try {
      const res = await fetch(`/api/admin/items/${itemId}/photos`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      if (data.uploaded?.length) {
        setMedia((prev) => [...prev, ...data.uploaded].sort((a, b) => a.sortOrder - b.sortOrder));
        router.refresh();
      }
    } catch {
      setError("Request failed");
    } finally {
      setUploading(false);
      e.target.value = "";
      fileInputRef.current?.value && (fileInputRef.current.value = "");
    }
  }

  const remaining = Math.max(0, 12 - media.length);

  return (
    <div className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="text-lg font-semibold">Photos (6–12 recommended)</h2>
      <p className="mt-1 text-sm text-gray-500">
        {media.length} uploaded. {remaining} slots left.
      </p>

      {media.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {media.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-24 w-24 overflow-hidden rounded border border-gray-200 bg-gray-100"
            >
              <img
                src={m.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            className="block text-sm text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700"
          />
          {uploading && <p className="mt-1 text-sm text-gray-500">Uploading…</p>}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
