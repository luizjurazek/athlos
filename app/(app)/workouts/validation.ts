import { isDay } from "@/app/utils/dates";

export const PLAN_TITLE_MAX_LENGTH = 60;
export const WORKOUT_LABEL_MAX_LENGTH = 3;
export const WORKOUT_DESCRIPTION_MAX_LENGTH = 60;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type WorkoutDraft = {
  /** Stable React key; never sent to the database. */
  key: string;
  id: string | null;
  label: string;
  description: string;
  copyFromId: string | null;
};

export type PlanDraft = {
  title: string;
  startedOn: string;
  workouts: WorkoutDraft[];
};

export type WorkoutErrors = { label?: string; description?: string };

export type PlanErrors = {
  title?: string;
  startedOn?: string;
  workouts: WorkoutErrors[];
  workoutsList?: string;
};

export function normalizeLabel(label: string) {
  return label.trim().toUpperCase();
}

export function nextWorkoutLabel(labels: string[]) {
  const used = new Set(labels.map(normalizeLabel));
  return [...LETTERS].find((letter) => !used.has(letter)) ?? "";
}

export function validatePlan(draft: PlanDraft): PlanErrors {
  const errors: PlanErrors = { workouts: [] };
  const title = draft.title.trim();
  if (!title) errors.title = "Dê um nome à ficha.";
  else if (title.length > PLAN_TITLE_MAX_LENGTH) {
    errors.title = `O nome pode ter no máximo ${PLAN_TITLE_MAX_LENGTH} caracteres.`;
  }

  if (!isDay(draft.startedOn)) errors.startedOn = "Escolha a data de início.";

  if (draft.workouts.length === 0) errors.workoutsList = "Adicione pelo menos um treino.";

  const seen = new Set<string>();
  errors.workouts = draft.workouts.map((workout) => {
    const workoutErrors: WorkoutErrors = {};
    const label = normalizeLabel(workout.label);
    if (!label) workoutErrors.label = "Dê uma letra ao treino.";
    else if (label.length > WORKOUT_LABEL_MAX_LENGTH) {
      workoutErrors.label = `Use até ${WORKOUT_LABEL_MAX_LENGTH} caracteres.`;
    } else if (seen.has(label)) {
      workoutErrors.label = `Já tem um treino ${label} nesta ficha.`;
    }
    seen.add(label);
    if (workout.description.trim().length > WORKOUT_DESCRIPTION_MAX_LENGTH) {
      workoutErrors.description = `Use até ${WORKOUT_DESCRIPTION_MAX_LENGTH} caracteres.`;
    }
    return workoutErrors;
  });

  return errors;
}

export function countPlanErrors(errors: PlanErrors) {
  const top = [errors.title, errors.startedOn, errors.workoutsList];
  const workoutCount = errors.workouts.reduce(
    (total, workout) => total + Object.values(workout).filter(Boolean).length,
    0,
  );
  return top.filter(Boolean).length + workoutCount;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

/** The form posts the draft as JSON in one hidden field; anything malformed becomes empty. */
export function parsePlanDraft(raw: FormDataEntryValue | null): PlanDraft | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const record = toRecord(parsed);
  if (!record) return null;

  const workouts = (Array.isArray(record.workouts) ? record.workouts : [])
    .map(toRecord)
    .filter((workout) => workout !== null)
    .map((workout, index) => ({
      key: String(index),
      id: readString(workout, "id") || null,
      label: readString(workout, "label"),
      description: readString(workout, "description"),
      copyFromId: readString(workout, "copyFromId") || null,
    }));

  return {
    title: readString(record, "title"),
    startedOn: readString(record, "startedOn"),
    workouts,
  };
}

export const EXERCISE_NAME_MAX_LENGTH = 80;
export const EXERCISE_NOTES_MAX_LENGTH = 280;
