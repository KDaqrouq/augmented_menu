/**
 * Analytics event contract shared by the browser tracker and the ingest endpoint.
 * The endpoint is public, so everything here is validated and size-capped.
 */

export const ANALYTICS_EVENT_NAMES = [
  "menu_view",
  "category_view",
  "item_view",
  "ar_open",
  "ar_supported",
  "ar_permission_result",
  "ar_asset_load_time_ms",
  "ar_place_success",
  "ar_session_duration_ms",
  "ar_fallback_used",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type ArMode = "webxr" | "quicklook" | "sceneviewer" | "3dviewer";

export const MAX_EVENT_BODY_BYTES = 4096;
const MAX_PROPERTIES = 20;
const MAX_STRING_LENGTH = 200;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type ParsedAnalyticsEvent = {
  eventName: AnalyticsEventName;
  restaurantId: string | null;
  itemId: string | null;
  properties: Record<string, string | number | boolean>;
};

function isEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

function parseId(value: unknown): string | null | undefined {
  if (value == null) return null;
  return typeof value === "string" && ID_PATTERN.test(value) ? value : undefined;
}

export function parseAnalyticsEvent(
  body: unknown
): { ok: true; event: ParsedAnalyticsEvent } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be an object" };
  const { eventName, restaurantId, itemId, properties } = body as Record<string, unknown>;

  if (!isEventName(eventName)) return { ok: false, error: "Unknown eventName" };

  const rid = parseId(restaurantId);
  const iid = parseId(itemId);
  if (rid === undefined || iid === undefined) return { ok: false, error: "Invalid restaurantId or itemId" };

  const props: Record<string, string | number | boolean> = {};
  if (properties != null) {
    if (typeof properties !== "object" || Array.isArray(properties)) {
      return { ok: false, error: "properties must be an object" };
    }
    const entries = Object.entries(properties as Record<string, unknown>);
    if (entries.length > MAX_PROPERTIES) return { ok: false, error: "Too many properties" };
    for (const [key, value] of entries) {
      if (key.length > 64) return { ok: false, error: "Property name too long" };
      if (value === undefined || value === null) continue;
      if (typeof value === "string") props[key] = value.slice(0, MAX_STRING_LENGTH);
      else if (typeof value === "number" && Number.isFinite(value)) props[key] = value;
      else if (typeof value === "boolean") props[key] = value;
      else return { ok: false, error: `Unsupported value for property "${key}"` };
    }
  }

  return { ok: true, event: { eventName, restaurantId: rid, itemId: iid, properties: props } };
}
