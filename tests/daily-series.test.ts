import { test } from "node:test";
import assert from "node:assert/strict";
import { fillDailySeries } from "@/lib/daily-series";

const row = (day: string, menuViews = 1) => ({ day, menuViews, itemViews: 0, arOpens: 0 });

test("daily series fills every day in a fixed range", () => {
  const out = fillDailySeries([row("2026-11-09", 5)], new Date("2026-11-11T15:00:00Z"), new Date("2026-11-05T15:00:00Z"));
  assert.deepEqual(
    out.map((d) => d.day),
    ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"]
  );
  assert.equal(out[4].menuViews, 5);
  assert.equal(out[0].menuViews, 0);
});

test("all-time series starts at the first day with data", () => {
  const out = fillDailySeries([row("2026-11-11"), row("2026-11-08")], new Date("2026-11-11T01:00:00Z"));
  assert.equal(out.length, 4);
  assert.equal(out[0].day, "2026-11-08");
});

test("all-time series with no data is empty", () => {
  assert.deepEqual(fillDailySeries([], new Date()), []);
});
