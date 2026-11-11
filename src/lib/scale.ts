/**
 * Real-world scale math.
 * All rendering uses meters; scaleFactor = targetMeters / modelDimensionMeters.
 */

import type { MeasurementType } from "./measurement";

export type { MeasurementType };

export function getModelDimensionMeters(
  measurementType: MeasurementType,
  bboxX: number,
  bboxY: number,
  bboxZ: number
): number {
  switch (measurementType) {
    case "PLATE_DIAMETER_CM":
    case "BOWL_DIAMETER_CM":
    case "MAX_WIDTH_CM":
      return Math.max(bboxX, bboxZ);
    case "CUP_HEIGHT_CM":
      return bboxY;
    default:
      return Math.max(bboxX, bboxZ);
  }
}

/**
 * Compute uniform scale factor so the model's measured dimension equals the real-world size.
 * targetMeters = measurementValueCm / 100; scaleFactor = targetMeters / modelDimensionMeters.
 */
export function computeScaleFactor(
  measurementType: MeasurementType,
  measurementValueCm: number,
  bboxX: number,
  bboxY: number,
  bboxZ: number
): number {
  const targetMeters = measurementValueCm / 100;
  const modelDim = getModelDimensionMeters(measurementType, bboxX, bboxY, bboxZ);
  if (!(modelDim > 0) || !Number.isFinite(modelDim)) return 1;
  return targetMeters / modelDim;
}

/** Relative difference above which a baked-in scale (USDZ, Scene Viewer GLB) counts as out of date. */
const BAKED_SCALE_TOLERANCE = 0.01;

/**
 * The USDZ and the Android GLB have the item's size baked in when they are generated.
 * If the measurement was edited afterwards, those files show the old size until regenerated.
 */
export function isBakedScaleStale(bakedScaleFactor: number, currentScaleFactor: number): boolean {
  if (!(bakedScaleFactor > 0) || !(currentScaleFactor > 0)) return false;
  return Math.abs(currentScaleFactor - bakedScaleFactor) / bakedScaleFactor > BAKED_SCALE_TOLERANCE;
}
