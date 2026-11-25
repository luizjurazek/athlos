import { addDays, addMonths, diffDays, isDay } from "@/app/utils/dates";

export const SPLIT_MAX_STAGES = 12;

export type SplitResult =
  | { stages: { target: number; dueOn: string }[] }
  | { error: string };

/**
 * Splits a goal total into `count` stages with whole cumulative targets: every stage adds the same
 * amount and the last one also takes the remainder (12 in 5 → 2, 4, 6, 8, 12).
 */
function splitTargets(total: number, count: number) {
  const step = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) => (index === count - 1 ? total : step * (index + 1)));
}

/**
 * Deadlines spread evenly between the start and the final deadline. When the span is a whole number
 * of months that divides by the stage count (e.g. "em 12 meses" in 4 stages), stages end on month
 * boundaries; otherwise the days are split.
 */
function splitDeadlines(startsOn: string, dueOn: string, count: number) {
  const months = monthsBetween(startsOn, dueOn);
  if (months && months.count % count === 0) {
    const perStage = months.count / count;
    return Array.from({ length: count }, (_, index) =>
      addDays(addMonths(startsOn, perStage * (index + 1)), months.offset),
    );
  }
  const days = diffDays(startsOn, dueOn);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? dueOn : addDays(startsOn, Math.round((days * (index + 1)) / count)),
  );
}

/** Whole months from start to due, accepting both "same day" and "day before" month ends. */
function monthsBetween(startsOn: string, dueOn: string) {
  const [startYear, startMonth] = startsOn.split("-").map(Number);
  const [dueYear, dueMonth] = dueOn.split("-").map(Number);
  const guess = (dueYear - startYear) * 12 + (dueMonth - startMonth);
  for (const count of [guess, guess + 1]) {
    if (count <= 0) continue;
    const end = addMonths(startsOn, count);
    if (end === dueOn) return { count, offset: 0 };
    if (addDays(end, -1) === dueOn) return { count, offset: -1 };
  }
  return null;
}

export function splitGoal({
  total,
  count,
  startsOn,
  dueOn,
}: {
  total: number | null;
  count: number | null;
  startsOn: string;
  dueOn: string;
}): SplitResult {
  if (total === null) return { error: "Informe o total da meta." };
  if (count === null || count < 1 || count > SPLIT_MAX_STAGES) {
    return { error: `Escolha de 1 a ${SPLIT_MAX_STAGES} etapas.` };
  }
  if (!isDay(startsOn)) return { error: "Escolha a data de início da meta." };
  if (!isDay(dueOn)) return { error: "Escolha o prazo final." };
  if (total < count) return { error: `Com ${count} etapas, o total precisa ser pelo menos ${count}.` };
  if (diffDays(startsOn, dueOn) < count) {
    return { error: `O prazo final precisa ter pelo menos ${count} dias depois do início.` };
  }
  const targets = splitTargets(total, count);
  const deadlines = splitDeadlines(startsOn, dueOn, count);
  return { stages: targets.map((target, index) => ({ target, dueOn: deadlines[index] })) };
}
