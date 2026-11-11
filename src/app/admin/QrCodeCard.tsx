"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card, CardHeader, buttonClass } from "@/components/ui";
import { QrIcon } from "@/components/icons";

/**
 * Public base URL for printed codes. Falls back to the current origin, which is
 * wrong when you are managing the menu from localhost, so we warn about that below.
 */
function publicOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return configured || window.location.origin;
}

function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".local");
  } catch {
    return false;
  }
}

function download(href: string, fileName: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const QR_OPTIONS = { errorCorrectionLevel: "M", margin: 2, color: { dark: "#1c1917", light: "#ffffff" } } as const;

export function QrCodeCard({
  path,
  fileName,
  title = "QR code",
  description,
}: {
  /** Site-relative path the code should open, e.g. /r/my-restaurant */
  path: string;
  /** File name without extension for the downloads */
  fileName: string;
  title?: string;
  description?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // The origin is only known in the browser, so the URL is built here rather than during render.
    const full = `${publicOrigin()}${path}`;
    let cancelled = false;
    QRCode.toDataURL(full, { ...QR_OPTIONS, width: 320 })
      .then((dataUrl) => {
        if (cancelled) return;
        setUrl(full);
        setPreview(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Could not create the QR code.");
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  async function downloadPng() {
    if (!url) return;
    try {
      download(await QRCode.toDataURL(url, { ...QR_OPTIONS, width: 1200 }), `${fileName}.png`);
    } catch {
      setError("Could not create the PNG.");
    }
  }

  async function downloadSvg() {
    if (!url) return;
    try {
      const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
      const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      download(blobUrl, `${fileName}.svg`);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      setError("Could not create the SVG.");
    }
  }

  const local = url ? isLocalOrigin(new URL(url).origin) : false;

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-4 p-5">
        <div className="mx-auto flex aspect-square w-full max-w-[200px] items-center justify-center rounded-xl border border-stone-200 bg-white p-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing for next/image to optimize
            <img src={preview} alt={`QR code for ${url}`} className="h-full w-full" />
          ) : (
            <QrIcon size={40} className="text-stone-300" />
          )}
        </div>
        {url && <p className="break-all text-center font-mono text-xs text-stone-500">{url}</p>}
        {local && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            This code points to a local address, so phones will not be able to open it. Set NEXT_PUBLIC_SITE_URL to
            your public domain before printing.
          </p>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={downloadPng} disabled={!url} className={buttonClass("secondary", "sm")}>
            Download PNG
          </button>
          <button type="button" onClick={downloadSvg} disabled={!url} className={buttonClass("secondary", "sm")}>
            Download SVG
          </button>
        </div>
      </div>
    </Card>
  );
}
