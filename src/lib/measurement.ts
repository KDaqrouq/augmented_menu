import type { MeasurementType } from "@prisma/client";

/**
 * Single source of truth for item measurements (admin forms, API validation, scale math).
 * Safe to import from client components: only a type comes from Prisma.
 */
export type { MeasurementType };

export const MEASUREMENT_TYPES = [
  "PLATE_DIAMETER_CM",
  "BOWL_DIAMETER_CM",
  "CUP_HEIGHT_CM",
  "MAX_WIDTH_CM",
] as const satisfies readonly MeasurementType[];

export const MEASUREMENT_CM_MIN = 1;
export const MEASUREMENT_CM_MAX = 200;

export const MEASUREMENT_LABELS: Record<MeasurementType, { label: string; hint: string }> = {
  PLATE_DIAMETER_CM: {
    label: "Plate diameter",
    hint: "Measure straight across the plate, rim to rim.",
  },
  BOWL_DIAMETER_CM: {
    label: "Bowl diameter",
    hint: "Measure across the top of the bowl, rim to rim.",
  },
  CUP_HEIGHT_CM: {
    label: "Cup / glass height",
    hint: "Measure from the table to the top of the cup or glass.",
  },
  MAX_WIDTH_CM: {
    label: "Widest point",
    hint: "For boards and odd shapes: the longest side seen from above.",
  },
};

export function isMeasurementType(value: unknown): value is MeasurementType {
  return typeof value === "string" && (MEASUREMENT_TYPES as readonly string[]).includes(value);
}

export function isValidMeasurementValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MEASUREMENT_CM_MIN &&
    value <= MEASUREMENT_CM_MAX
  );
}

export const MEASUREMENT_RANGE_ERROR = `measurementValue must be between ${MEASUREMENT_CM_MIN} and ${MEASUREMENT_CM_MAX} cm`;
export const MEASUREMENT_TYPE_ERROR = `measurementType must be one of: ${MEASUREMENT_TYPES.join(", ")}`;
