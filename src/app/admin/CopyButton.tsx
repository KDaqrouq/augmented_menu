"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { CheckIcon, CopyIcon } from "@/components/icons";

/** Copies a path made absolute with the current origin (so it works on any deployment). */
export function CopyLinkButton({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", `${window.location.origin}${path}`);
    }
  }

  return (
    <button type="button" onClick={copy} className={buttonClass("secondary", "sm")}>
      {copied ? <CheckIcon size={16} className="text-emerald-600" /> : <CopyIcon size={16} />}
      {copied ? "Copied" : label}
    </button>
  );
}
