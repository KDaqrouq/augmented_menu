/**
 * Browser analytics tracker. Events and validation live in ./analytics-events.
 */

import type { AnalyticsEventName, ArMode } from "./analytics-events";

export type { AnalyticsEventName, ArMode };

export type AnalyticsProperties = {
  restaurantId?: string;
  itemId?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  arMode?: ArMode;
  [key: string]: string | number | boolean | undefined;
};

function getDeviceInfo(): { deviceType: string; os: string; browser: string } {
  if (typeof navigator === "undefined") return { deviceType: "unknown", os: "unknown", browser: "unknown" };
  const ua = navigator.userAgent;

  let deviceType = "desktop";
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) deviceType = "tablet";
  else if (/iPhone|iPod|Android/i.test(ua)) deviceType = "mobile";

  let os = "unknown";
  if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Win/.test(ua)) os = "Windows";
  else if (/Mac/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  let browser = "unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/CriOS|Chrome/.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox/.test(ua)) browser = "Firefox";
  else if (/Safari/.test(ua)) browser = "Safari";

  return { deviceType, os, browser };
}

export function trackEvent(eventName: AnalyticsEventName, properties?: AnalyticsProperties): void {
  const { deviceType, os, browser } = getDeviceInfo();
  const { restaurantId, itemId, ...rest } = properties ?? {};
  const payload = {
    eventName,
    restaurantId,
    itemId,
    properties: {
      ...rest,
      deviceType: rest.deviceType ?? deviceType,
      os: rest.os ?? os,
      browser: rest.browser ?? browser,
    },
  };
  // keepalive lets the request finish when the tap navigates away (Quick Look, Scene Viewer).
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((e) => console.warn("[analytics] Failed to track:", eventName, e));
}
