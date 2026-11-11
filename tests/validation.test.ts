import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { parseAnalyticsEvent } from "@/lib/analytics-events";
import { isMeasurementType, isValidMeasurementValue } from "@/lib/measurement";
import { slugify } from "@/lib/slug";
import { sceneViewerIntentUrl } from "@/lib/ar-links";
import { storagePathFromPublicUrl } from "@/lib/supabase";

test("login redirect only allows same-site paths", () => {
  assert.equal(safeRedirectPath("/admin/restaurants/1"), "/admin/restaurants/1");
  assert.equal(safeRedirectPath("https://evil.example"), "/admin");
  assert.equal(safeRedirectPath("//evil.example"), "/admin");
  assert.equal(safeRedirectPath("/\\evil.example"), "/admin");
  assert.equal(safeRedirectPath(null), "/admin");
});

test("analytics accepts known events and caps strings", () => {
  const result = parseAnalyticsEvent({
    eventName: "ar_open",
    restaurantId: "6a1f3c2e-1111-4a5b-9c8d-123456789abc",
    itemId: null,
    properties: { arMode: "webxr", note: "x".repeat(500), ok: true, n: 3, skip: undefined },
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.event.itemId, null);
    assert.equal((result.event.properties.note as string).length, 200);
    assert.equal(result.event.properties.ok, true);
    assert.ok(!("skip" in result.event.properties));
  }
});

test("analytics rejects unknown events, bad ids and nested values", () => {
  assert.equal(parseAnalyticsEvent({ eventName: "drop_table" }).ok, false);
  assert.equal(parseAnalyticsEvent({ eventName: "menu_view", restaurantId: "a b" }).ok, false);
  assert.equal(parseAnalyticsEvent({ eventName: "menu_view", properties: { a: { b: 1 } } }).ok, false);
  assert.equal(parseAnalyticsEvent({ eventName: "menu_view", properties: [1] }).ok, false);
  const tooMany = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
  assert.equal(parseAnalyticsEvent({ eventName: "menu_view", properties: tooMany }).ok, false);
});

test("measurement validation", () => {
  assert.equal(isMeasurementType("PLATE_DIAMETER_CM"), true);
  assert.equal(isMeasurementType("plate"), false);
  assert.equal(isValidMeasurementValue(28), true);
  assert.equal(isValidMeasurementValue(0.5), false);
  assert.equal(isValidMeasurementValue(201), false);
  assert.equal(isValidMeasurementValue(Number.NaN), false);
  assert.equal(isValidMeasurementValue("28"), false);
});

test("slugify", () => {
  assert.equal(slugify("  Café Ünïcode & Co!  "), "cafe-unicode-co");
  assert.equal(slugify("---"), "");
});

test("Scene Viewer link keeps the dish at real size and falls back to the web viewer", () => {
  const url = sceneViewerIntentUrl({
    glbUrl: "https://x.supabase.co/storage/v1/object/public/b/model-ar.glb?v=2",
    title: "Pad Thai",
    fallbackUrl: "https://menu.example/r/demo/item/1/ar",
  });
  assert.ok(url.startsWith("intent://arvr.google.com/scene-viewer/1.0?"));
  assert.ok(url.includes("resizable=false"));
  assert.ok(url.includes("mode=ar_preferred"));
  assert.ok(url.includes(encodeURIComponent("model-ar.glb?v=2")));
  assert.ok(url.includes("title=Pad%20Thai"));
  assert.ok(url.includes(`S.browser_fallback_url=${encodeURIComponent("https://menu.example/r/demo/item/1/ar")}`));
  assert.ok(url.endsWith(";end;"));
});

test("storage paths are recovered from public URLs", () => {
  assert.equal(
    storagePathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/menu-images/items/1/a%20b.jpg", "menu-images"),
    "items/1/a b.jpg"
  );
  assert.equal(storagePathFromPublicUrl("https://elsewhere.example/a.jpg", "menu-images"), null);
});
