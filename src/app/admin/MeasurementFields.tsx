"use client";

import {
  MEASUREMENT_CM_MAX,
  MEASUREMENT_CM_MIN,
  MEASUREMENT_LABELS,
  MEASUREMENT_TYPES,
  type MeasurementType,
} from "@/lib/measurement";
import { Field, inputClass } from "@/components/ui";

/** "What to measure" + "how big" pair used by the add and edit dish forms. */
export function MeasurementFields({
  idPrefix,
  type,
  value,
  onTypeChange,
  onValueChange,
}: {
  idPrefix: string;
  type: MeasurementType;
  value: number | "";
  onTypeChange: (type: MeasurementType) => void;
  onValueChange: (value: number | "") => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
      <Field label="Real-world size from" htmlFor={`${idPrefix}-mtype`} hint={MEASUREMENT_LABELS[type].hint}>
        <select
          id={`${idPrefix}-mtype`}
          value={type}
          onChange={(e) => onTypeChange(e.target.value as MeasurementType)}
          className={inputClass}
        >
          {MEASUREMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {MEASUREMENT_LABELS[t].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Size (cm)" htmlFor={`${idPrefix}-mvalue`}>
        <input
          id={`${idPrefix}-mvalue`}
          type="number"
          inputMode="decimal"
          min={MEASUREMENT_CM_MIN}
          max={MEASUREMENT_CM_MAX}
          step={0.1}
          value={value}
          onChange={(e) => onValueChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={inputClass}
          required
        />
      </Field>
    </div>
  );
}
