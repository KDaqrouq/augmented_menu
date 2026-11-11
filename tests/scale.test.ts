import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScaleFactor, getModelDimensionMeters, isBakedScaleStale } from "@/lib/scale";

test("plate and bowl use the wider of X and Z", () => {
  assert.equal(getModelDimensionMeters("PLATE_DIAMETER_CM", 0.5, 0.1, 0.4), 0.5);
  assert.equal(getModelDimensionMeters("BOWL_DIAMETER_CM", 0.2, 0.3, 0.6), 0.6);
  assert.equal(getModelDimensionMeters("MAX_WIDTH_CM", 0.2, 0.9, 0.3), 0.3);
});

test("cups are measured by height", () => {
  assert.equal(getModelDimensionMeters("CUP_HEIGHT_CM", 0.2, 0.9, 0.3), 0.9);
});

test("a 28 cm plate on a 1 m wide model scales by 0.28", () => {
  assert.ok(Math.abs(computeScaleFactor("PLATE_DIAMETER_CM", 28, 1, 0.2, 0.8) - 0.28) < 1e-9);
});

test("a 12 cm cup on a 0.5 m tall model scales by 0.24", () => {
  assert.ok(Math.abs(computeScaleFactor("CUP_HEIGHT_CM", 12, 2, 0.5, 2) - 0.24) < 1e-9);
});

test("degenerate bounds fall back to 1 instead of Infinity/NaN", () => {
  assert.equal(computeScaleFactor("PLATE_DIAMETER_CM", 28, 0, 0, 0), 1);
  assert.equal(computeScaleFactor("CUP_HEIGHT_CM", 12, 1, Number.NaN, 1), 1);
});

test("baked scale is stale only beyond 1%", () => {
  assert.equal(isBakedScaleStale(0.28, 0.28), false);
  assert.equal(isBakedScaleStale(0.28, 0.2810), false);
  assert.equal(isBakedScaleStale(0.28, 0.32), true);
  assert.equal(isBakedScaleStale(0, 0.32), false);
});
