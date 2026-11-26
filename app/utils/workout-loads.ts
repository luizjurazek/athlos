import { formatDayMonth } from "./dates";

export const MAX_SETS = 20;
export const MAX_REPS = 100;
export const MAX_LOAD_KG = 999;

export type LoadValues = { sets: number; reps: number; loadKg: number | null };
export type LoadVersion = LoadValues & { effectiveFrom: string };

const kgFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function formatKg(kg: number) {
  return `${kgFormat.format(kg)} kg`;
}

export function formatLoad(load: LoadValues) {
  return `${load.sets} × ${load.reps} · ${load.loadKg == null ? "peso corporal" : formatKg(load.loadKg)}`;
}

/** Short form for tight lists: "3×10 · 8 kg". */
export function formatLoadCompact(load: LoadValues) {
  return `${load.sets}×${load.reps} · ${load.loadKg == null ? "peso corp." : formatKg(load.loadKg)}`;
}

export function sameLoad(a: LoadValues, b: LoadValues) {
  return a.sets === b.sets && a.reps === b.reps && a.loadKg === b.loadKg;
}

export function toLoadVersion(row: {
  effective_from: string;
  sets: number;
  reps: number;
  load_kg: number | null;
}): LoadVersion {
  return {
    effectiveFrom: row.effective_from,
    sets: row.sets,
    reps: row.reps,
    loadKg: row.load_kg == null ? null : Number(row.load_kg),
  };
}

/**
 * RN-27: the version in force on `day` is the latest with effective_from <= day. An exercise whose
 * first version starts later (plan starting in the future) shows that first version.
 */
export function getLoadOn(versions: LoadVersion[], day: string) {
  const sorted = [...versions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const index = sorted.findLastIndex((version) => version.effectiveFrom <= day);
  if (index < 0) return { current: sorted[0] ?? null, previous: null };
  return { current: sorted[index], previous: index > 0 ? sorted[index - 1] : null };
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Short history line: "↑ 2 kg em 16/11", "↓ 2 reps em 16/11" or "igual desde 01/11". */
export function describeLoadChange(current: LoadVersion, previous: LoadVersion | null, today: string) {
  if (!previous) {
    return current.effectiveFrom >= today ? "desde hoje" : `igual desde ${formatDayMonth(current.effectiveFrom)}`;
  }
  const when = current.effectiveFrom === today ? "hoje" : `em ${formatDayMonth(current.effectiveFrom)}`;
  const arrow = (diff: number) => (diff > 0 ? "↑" : "↓");
  if (current.loadKg != null && previous.loadKg != null && current.loadKg !== previous.loadKg) {
    const diff = current.loadKg - previous.loadKg;
    return `${arrow(diff)} ${formatKg(Math.abs(diff))} ${when}`;
  }
  if (current.reps !== previous.reps) {
    const diff = current.reps - previous.reps;
    return `${arrow(diff)} ${plural(Math.abs(diff), "rep", "reps")} ${when}`;
  }
  if (current.sets !== previous.sets) {
    const diff = current.sets - previous.sets;
    return `${arrow(diff)} ${plural(Math.abs(diff), "série", "séries")} ${when}`;
  }
  return current.loadKg == null ? `peso corporal ${when}` : `alterado ${when}`;
}

export type LoadErrors = { sets?: string; reps?: string; loadKg?: string };

export function validateLoad(load: LoadValues): LoadErrors {
  const errors: LoadErrors = {};
  if (!Number.isInteger(load.sets) || load.sets < 1 || load.sets > MAX_SETS) {
    errors.sets = `Use um número de 1 a ${MAX_SETS}.`;
  }
  if (!Number.isInteger(load.reps) || load.reps < 1 || load.reps > MAX_REPS) {
    errors.reps = `Use um número de 1 a ${MAX_REPS}.`;
  }
  if (
    load.loadKg != null &&
    (!Number.isFinite(load.loadKg) || load.loadKg < 0 || load.loadKg > MAX_LOAD_KG ||
      Math.round(load.loadKg * 100) !== load.loadKg * 100)
  ) {
    errors.loadKg = `Use um peso de 0 a ${MAX_LOAD_KG} kg.`;
  }
  return errors;
}

export function hasLoadErrors(errors: LoadErrors) {
  return Object.values(errors).some(Boolean);
}

/** Reads a load sent by a client (unknown shape) into numbers; invalid values fail validation. */
export function parseLoad(value: unknown): LoadValues {
  const record: Record<string, unknown> =
    typeof value === "object" && value !== null ? Object.fromEntries(Object.entries(value)) : {};
  const toNumber = (raw: unknown) => (typeof raw === "number" ? raw : Number.NaN);
  return {
    sets: toNumber(record.sets),
    reps: toNumber(record.reps),
    loadKg: record.loadKg === null ? null : toNumber(record.loadKg),
  };
}
