/**
 * Scale calculation per TECH_SPECS §5.
 * All rendering uses meters; scaleFactor = targetMeters / modelDimensionMeters.
 */

export type MeasurementType =
  | "PLATE_DIAMETER_CM"
  | "BOWL_DIAMETER_CM"
  | "CUP_HEIGHT_CM"
  | "MAX_WIDTH_CM";

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
  if (modelDim <= 0) return 1;
  return targetMeters / modelDim;
}
