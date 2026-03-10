"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Job = {
  id: string;
  version: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export function ItemGenerate3DSection({
  itemId,
  initialStatus,
}: {
  itemId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function loadJobs() {
    fetch(`/api/admin/items/${itemId}/jobs`)
      .then((r) => r.json())
      .then((data) => data.jobs && setJobs(data.jobs))
      .catch(() => {});
  }

  useEffect(() => {
    loadJobs();
  }, [itemId]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  async function handleGenerate() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/items/${itemId}/generate-3d`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to start");
        return;
      }
      setStatus("PROCESSING");
      loadJobs();
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="text-lg font-semibold">3D asset</h2>
      <p className="mt-1 text-sm text-gray-500">
        Status: <span className="font-medium">{status}</span>
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || status === "PROCESSING"}
          className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Starting…" : status === "PROCESSING" ? "Processing…" : "Generate 3D"}
        </button>
        <button
          type="button"
          onClick={() => { loadJobs(); router.refresh(); }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
        >
          Refresh status
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {jobs.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="flex gap-2">
              <span className="text-gray-500">v{j.version}</span>
              <span className="font-medium">{j.status}</span>
              {j.errorMessage && (
                <span className="text-red-600">{j.errorMessage}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
