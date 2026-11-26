"use client";

import { useId } from "react";
import { MAX_LOAD_KG, MAX_REPS, MAX_SETS, type LoadErrors, type LoadValues } from "@/app/utils/workout-loads";
import g from "../goals/goals.module.css";
import styles from "./workouts.module.css";

export type LoadDraft = { sets: string; reps: string; kg: string; bodyweight: boolean };

export function toLoadDraft(load: LoadValues | null | undefined): LoadDraft {
  return {
    sets: String(load?.sets ?? 3),
    reps: String(load?.reps ?? 10),
    kg: load?.loadKg == null ? "" : String(load.loadKg).replace(".", ","),
    bodyweight: Boolean(load) && load?.loadKg == null,
  };
}

function toNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  return normalized === "" ? Number.NaN : Number(normalized);
}

export function toLoadValues(draft: LoadDraft): LoadValues {
  return {
    sets: toNumber(draft.sets),
    reps: toNumber(draft.reps),
    loadKg: draft.bodyweight ? null : toNumber(draft.kg || "0"),
  };
}

export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  decimal = false,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  decimal?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const id = useId();
  const current = toNumber(value);
  const step = (delta: number) => {
    const base = Number.isFinite(current) ? current : min;
    const next = Math.min(max, Math.max(min, Math.round((base + delta) * 100) / 100));
    onChange(String(next).replace(".", ","));
  };
  return (
    <div className={styles.stepperRow}>
      <label className={styles.stepperLabel} htmlFor={id}>
        {label}
      </label>
      <div className={styles.stepper}>
        <button
          type="button"
          className={styles.stepperButton}
          aria-label={`Diminuir ${label.toLowerCase()}`}
          disabled={disabled || (Number.isFinite(current) && current <= min)}
          onClick={() => step(-1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <input
          id={id}
          className={styles.stepperInput}
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          value={disabled ? "—" : value}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ""))}
        />
        <button
          type="button"
          className={styles.stepperButton}
          aria-label={`Aumentar ${label.toLowerCase()}`}
          disabled={disabled || (Number.isFinite(current) && current >= max)}
          onClick={() => step(1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      {error && <p className={`${g.fieldError} ${styles.stepperError}`}>{error}</p>}
    </div>
  );
}

export function LoadFields({
  value,
  onChange,
  errors,
  readOnly = false,
}: {
  value: LoadDraft;
  onChange: (value: LoadDraft) => void;
  errors?: LoadErrors;
  readOnly?: boolean;
}) {
  return (
    <div className={styles.loadFields}>
      <div className={styles.steppers}>
        <NumberStepper
          label="Carga (kg)"
          value={value.kg || "0"}
          decimal
          min={0}
          max={MAX_LOAD_KG}
          disabled={value.bodyweight || readOnly}
          error={errors?.loadKg}
          onChange={(kg) => onChange({ ...value, kg })}
        />
        <NumberStepper
          label="Séries"
          value={value.sets}
          min={1}
          max={MAX_SETS}
          disabled={readOnly}
          error={errors?.sets}
          onChange={(sets) => onChange({ ...value, sets })}
        />
        <NumberStepper
          label="Repetições"
          value={value.reps}
          min={1}
          max={MAX_REPS}
          disabled={readOnly}
          error={errors?.reps}
          onChange={(reps) => onChange({ ...value, reps })}
        />
      </div>
      {!readOnly && (
        <label className={styles.checkRow}>
          <input
            className={g.checkbox}
            type="checkbox"
            checked={value.bodyweight}
            onChange={(event) => onChange({ ...value, bodyweight: event.target.checked })}
          />
          <span>Peso corporal (sem carga)</span>
        </label>
      )}
    </div>
  );
}
