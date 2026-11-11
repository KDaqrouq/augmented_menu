"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Card, CardHeader, Spinner, buttonClass } from "@/components/ui";
import { CubeIcon, ExternalIcon, RefreshIcon } from "@/components/icons";
import { ModelStatusBadge } from "@/app/admin/ModelStatusBadge";

type Job = {
  id: string;
  version: number;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  errorMessage: string | null;
  createdAt: string;
};

type LatestAsset = {
  version: number;
  glbUrl: string;
  usdzUrl: string | null;
  arGlbUrl: string | null;
  sizeOutdated: boolean;
} | null;

const POLL_MS = 5000;
const MIN_PHOTOS = 4;

const jobTone = { QUEUED: "neutral", RUNNING: "blue", SUCCEEDED: "green", FAILED: "red" } as const;
const jobLabel = { QUEUED: "Queued", RUNNING: "Running", SUCCEEDED: "Done", FAILED: "Failed" } as const;

export function ItemGenerate3DSection({
  itemId,
  initialStatus,
  initialPhotoCount,
  previewPath,
}: {
  itemId: string;
  initialStatus: string;
  initialPhotoCount: number;
  previewPath: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [photoCount, setPhotoCount] = useState(initialPhotoCount);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [latestAsset, setLatestAsset] = useState<LatestAsset>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  // Server props win after router.refresh() (e.g. photos added on this page).
  const [lastProps, setLastProps] = useState({ initialStatus, initialPhotoCount });
  if (lastProps.initialStatus !== initialStatus || lastProps.initialPhotoCount !== initialPhotoCount) {
    setLastProps({ initialStatus, initialPhotoCount });
    setStatus(initialStatus);
    setPhotoCount(initialPhotoCount);
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/items/${itemId}/jobs`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setLatestAsset(data.latestAsset ?? null);
      setPhotoCount(data.photoCount ?? 0);
      setStatus((prev) => {
        if (prev === "PROCESSING" && data.status !== "PROCESSING") router.refresh();
        return data.status;
      });
    } catch {
      // Transient; the next poll retries.
    }
  }, [itemId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const active = status === "PROCESSING" || jobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING");
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [active, load]);

  async function generate() {
    setError("");
    setStarting(true);
    try {
      const res = await fetch(`/api/admin/items/${itemId}/generate-3d`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to start");
        return;
      }
      setStatus("PROCESSING");
      load();
    } catch {
      setError("Request failed");
    } finally {
      setStarting(false);
    }
  }

  const needsPhotos = photoCount < MIN_PHOTOS;
  const hasModel = !!latestAsset;

  return (
    <Card>
      <CardHeader
        title="3D model"
        action={<ModelStatusBadge status={status} hasModel={hasModel} />}
      />
      <div className="space-y-4 p-5">
        {active ? (
          <div className="flex items-start gap-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
            <Spinner className="mt-0.5 shrink-0" />
            <p>
              Generating the model. This usually takes a few minutes; you can leave this page and come back.
            </p>
          </div>
        ) : hasModel ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-stone-900">Version {latestAsset.version} is live</p>
            <ul className="space-y-1 text-stone-600">
              <Availability ok label="Web 3D viewer and Android Chrome AR" />
              <Availability ok={!!latestAsset.usdzUrl} label="iPhone one-tap AR (Quick Look)" />
              <Availability ok={!!latestAsset.arGlbUrl} label="Android one-tap AR (Scene Viewer)" />
            </ul>
          </div>
        ) : (
          <p className="text-sm text-stone-600">
            Upload four photos (front, left, back, right), then generate a model diners can place on their table.
          </p>
        )}

        {latestAsset?.sizeOutdated && !active && (
          <Alert tone="amber">
            The size changed since this model was made. iPhone and Android AR still show the old size until you
            generate again.
          </Alert>
        )}
        {needsPhotos && !active && (
          <Alert tone="amber">
            Add {MIN_PHOTOS - photoCount} more photo{MIN_PHOTOS - photoCount === 1 ? "" : "s"} to generate a model.
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={starting || active || needsPhotos}
            className={buttonClass("primary", "md", "flex-1")}
          >
            <CubeIcon size={18} />
            {starting ? "Starting…" : hasModel ? "Generate again" : "Generate 3D model"}
          </button>
          {hasModel && (
            <a href={previewPath} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md")}>
              <ExternalIcon size={16} /> Preview
            </a>
          )}
        </div>

        {jobs.length > 0 && (
          <div className="border-t border-stone-100 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">History</h3>
              <button
                type="button"
                onClick={load}
                className="text-stone-400 hover:text-stone-700"
                aria-label="Refresh status"
                title="Refresh status"
              >
                <RefreshIcon size={15} />
              </button>
            </div>
            <ul className="space-y-2">
              {jobs.map((j) => (
                <li key={j.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-stone-500">v{j.version}</span>
                    <Badge tone={jobTone[j.status]}>{jobLabel[j.status]}</Badge>
                    <span className="ml-auto text-xs text-stone-400">{new Date(j.createdAt).toLocaleString()}</span>
                  </div>
                  {j.errorMessage && <p className="mt-1 text-xs text-red-700">{j.errorMessage}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function Availability({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={ok ? "text-emerald-600" : "text-stone-300"}>{ok ? "●" : "○"}</span>
      <span className={ok ? undefined : "text-stone-400"}>{label}</span>
    </li>
  );
}
