"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function ItemViewTracker({
  restaurantId,
  itemId,
}: {
  restaurantId: string;
  itemId: string;
}) {
  useEffect(() => {
    trackEvent("item_view", { restaurantId, itemId });
  }, [restaurantId, itemId]);
  return null;
}
