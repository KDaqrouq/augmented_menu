"use client";

import type { ReactNode } from "react";
import { trackEvent, type ArMode } from "@/lib/analytics";

type TrackedARLinkProps = {
  href: string;
  /** "quicklook" adds rel="ar" so iOS opens AR Quick Look directly. */
  arMode: Extract<ArMode, "quicklook" | "sceneviewer">;
  restaurantId: string;
  itemId: string;
  className?: string;
  children: ReactNode;
};

/**
 * Native AR launch link (one tap). Must be a plain <a> the user taps directly:
 * iOS needs rel="ar" on a user-activated anchor, Android needs the intent:// URL.
 */
export function TrackedARLink({ href, arMode, restaurantId, itemId, className, children }: TrackedARLinkProps) {
  return (
    <a
      href={href}
      rel={arMode === "quicklook" ? "ar" : undefined}
      className={className}
      onClick={() => trackEvent("ar_open", { restaurantId, itemId, arMode })}
    >
      {children}
    </a>
  );
}
