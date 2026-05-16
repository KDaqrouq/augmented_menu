"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

type QuickLookARAnchorProps = {
  usdzUrl: string;
  restaurantId: string;
  itemId: string;
  className?: string;
  children: ReactNode;
};

/** Apple AR Quick Look — must be a direct user tap on rel="ar". */
export function QuickLookARAnchor({
  usdzUrl,
  restaurantId,
  itemId,
  className,
  children,
}: QuickLookARAnchorProps) {
  return (
    <a
      href={usdzUrl}
      rel="ar"
      className={className}
      onClick={() => {
        trackEvent("ar_open", {
          restaurantId,
          itemId,
          arMode: "quicklook",
        });
      }}
    >
      {children}
    </a>
  );
}
