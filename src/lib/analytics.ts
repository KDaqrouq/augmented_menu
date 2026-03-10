/**
 * Client analytics per TECH_SPECS §9.
 * Events: menu_view, item_view, ar_open, ar_supported, ar_place_success, etc.
 */

export type AnalyticsEventName =
  | "menu_view"
  | "category_view"
  | "item_view"
  | "ar_open"
  | "ar_supported"
  | "ar_permission_result"
  | "ar_asset_load_time_ms"
  | "ar_place_success"
  | "ar_session_duration_ms"
  | "ar_fallback_used";

export type AnalyticsProperties = {
  restaurantId?: string;
  itemId?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  arMode?: "webxr" | "quicklook" | "3dviewer";
  [key: string]: string | number | boolean | undefined;
};

function getDeviceInfo(): { deviceType: string; os: string; browser: string } {
  if (typeof navigator === "undefined")
    return { deviceType: "unknown", os: "unknown", browser: "unknown" };
  const ua = navigator.userAgent;
  let deviceType = "desktop";
  if (/iPhone|iPad|iPod|Android/i.test(ua)) deviceType = "mobile";
  else if (/tablet|ipad/i.test(ua)) deviceType = "tablet";

  let os = "unknown";
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Win/.test(ua)) os = "Windows";
  else if (/Mac/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  let browser = "unknown";
  if (/Chrome/.test(ua) && !/Edge/.test(ua)) browser = "Chrome";
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/Firefox/.test(ua)) browser = "Firefox";
  else if (/Edge/.test(ua)) browser = "Edge";

  return { deviceType, os, browser };
}

export async function trackEvent(
  eventName: AnalyticsEventName,
  properties?: AnalyticsProperties
): Promise<void> {
  const { deviceType, os, browser } = getDeviceInfo();
  const payload = {
    eventName,
    restaurantId: properties?.restaurantId,
    itemId: properties?.itemId,
    properties: {
      ...properties,
      deviceType: properties?.deviceType ?? deviceType,
      os: properties?.os ?? os,
      browser: properties?.browser ?? browser,
    },
  };
  try {
    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[analytics] Failed to track:", eventName, e);
  }
}
