"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { hasLoadErrors, parseLoad, validateLoad, type LoadValues } from "@/app/utils/workout-loads";
import { getUserTimezone } from "../dashboard/day-objectives";
import { EXERCISE_SOURCE, isMuscle } from "./exercise-labels";
import { searchExercises, type ExerciseSearchResult } from "./exercise-search";
import { EXERCISE_NAME_MAX_LENGTH, EXERCISE_NOTES_MAX_LENGTH } from "./validation";

export type ExerciseActionResult = { ok: true } | { ok: false; error: string };

export type ExerciseSnapshot = {
  sourceId: string;
  imageUrl: string | null;
  muscles: string[];
  equipment: string | null;
};

const SAVE_ERROR = "Não deu para salvar. Tente de novo.";
const ENDED_ERROR = "Esta ficha está encerrada. Crie uma nova ficha para mudar os exercícios.";

type Client = ReturnType<typeof createClient>;

async function loadContext() {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const timezone = await getUserTimezone(supabase, user.id);
  return { supabase, today: getUserToday(timezone) };
}

/** RN-31: the search runs on the server; the client never talks to the catalog directly. */
export async function searchExerciseCatalog(query: string, muscle: string | null): Promise<ExerciseSearchResult> {
  await requireUser();
  return searchExercises(String(query).slice(0, 80), isMuscle(muscle) ? { muscle } : {});
}

async function getWorkoutContext(supabase: Client, workoutId: string) {
  const { data, error } = await supabase
    .from("workouts")
    .select("id, plan_id, workout_plans ( started_on, ended_on )")
    .eq("id", workoutId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getExerciseContext(supabase: Client, exerciseId: string) {
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("id, workout_id, position, archived_at, workouts ( plan_id, workout_plans ( started_on, ended_on ) )")
    .eq("id", exerciseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function revalidateWorkout(planId: string, workoutId: string) {
  revalidatePath(`/workouts/${planId}`);
  revalidatePath(`/workouts/${planId}/${workoutId}`);
  revalidatePath("/dashboard");
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseSnapshot(value: unknown): ExerciseSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  if (typeof record.sourceId !== "string" || !record.sourceId) return null;
  const imageUrl =
    typeof record.imageUrl === "string" &&
    record.imageUrl.startsWith("https://raw.githubusercontent.com/yuhonas/free-exercise-db/")
      ? record.imageUrl
      : null;
  return {
    sourceId: record.sourceId.slice(0, 120),
    imageUrl,
    muscles: Array.isArray(record.muscles)
      ? record.muscles.filter((muscle): muscle is string => typeof muscle === "string").slice(0, 10)
      : [],
    equipment: typeof record.equipment === "string" ? record.equipment.slice(0, 40) : null,
  };
}

/** The initial load version starts today, or on the plan start when the plan begins later (task 15). */
function firstLoadDay(today: string, startedOn: string) {
  return startedOn > today ? startedOn : today;
}

export async function addExercise(
  workoutId: string,
  input: { name: unknown; notes: unknown; load: unknown; snapshot: unknown },
): Promise<ExerciseActionResult> {
  const { supabase, today } = await loadContext();
  const name = cleanText(input.name, EXERCISE_NAME_MAX_LENGTH + 1);
  if (!name) return { ok: false, error: "Dê um nome ao exercício." };
  if (name.length > EXERCISE_NAME_MAX_LENGTH) {
    return { ok: false, error: `O nome pode ter no máximo ${EXERCISE_NAME_MAX_LENGTH} caracteres.` };
  }
  const load = parseLoad(input.load);
  if (hasLoadErrors(validateLoad(load))) return { ok: false, error: "Confira séries, repetições e carga." };
  const snapshot = input.snapshot ? parseSnapshot(input.snapshot) : null;

  const workout = await getWorkoutContext(supabase, workoutId).catch(() => null);
  if (!workout?.workout_plans) return { ok: false, error: "Treino não encontrado." };
  if (workout.workout_plans.ended_on) return { ok: false, error: ENDED_ERROR };

  const { data: last } = await supabase
    .from("workout_exercises")
    .select("position")
    .eq("workout_id", workoutId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: exercise, error } = await supabase
    .from("workout_exercises")
    .insert({
      workout_id: workoutId,
      position: (last?.position ?? 0) + 1,
      name,
      notes: cleanText(input.notes, EXERCISE_NOTES_MAX_LENGTH) || null,
      source: snapshot ? EXERCISE_SOURCE : null,
      source_id: snapshot?.sourceId ?? null,
      image_url: snapshot?.imageUrl ?? null,
      muscles: snapshot?.muscles.length ? snapshot.muscles : null,
      equipment: snapshot?.equipment ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Failed to add exercise", error);
    return { ok: false, error: SAVE_ERROR };
  }

  const { error: loadError } = await insertLoad(supabase, exercise.id, firstLoadDay(today, workout.workout_plans.started_on), load);
  if (loadError) {
    console.error("Failed to save the initial load", loadError);
    await supabase.from("workout_exercises").delete().eq("id", exercise.id);
    return { ok: false, error: SAVE_ERROR };
  }

  revalidateWorkout(workout.plan_id, workoutId);
  return { ok: true };
}

function insertLoad(supabase: Client, exerciseId: string, day: string, load: LoadValues) {
  return supabase.from("workout_exercise_loads").insert({
    workout_exercise_id: exerciseId,
    effective_from: day,
    sets: load.sets,
    reps: load.reps,
    load_kg: load.loadKg,
  });
}

export async function updateExercise(
  exerciseId: string,
  input: { name: unknown; notes: unknown; load: unknown },
): Promise<ExerciseActionResult> {
  const { supabase, today } = await loadContext();
  const name = cleanText(input.name, EXERCISE_NAME_MAX_LENGTH + 1);
  if (!name) return { ok: false, error: "Dê um nome ao exercício." };
  if (name.length > EXERCISE_NAME_MAX_LENGTH) {
    return { ok: false, error: `O nome pode ter no máximo ${EXERCISE_NAME_MAX_LENGTH} caracteres.` };
  }
  const load = input.load == null ? null : parseLoad(input.load);
  if (load && hasLoadErrors(validateLoad(load))) {
    return { ok: false, error: "Confira séries, repetições e carga." };
  }

  const exercise = await getExerciseContext(supabase, exerciseId).catch(() => null);
  const plan = exercise?.workouts?.workout_plans;
  if (!exercise || !plan || exercise.archived_at) return { ok: false, error: "Exercício não encontrado." };
  if (plan.ended_on) return { ok: false, error: ENDED_ERROR };

  // Renaming never touches the source: the snapshot keeps where it came from (RN-26).
  const { error } = await supabase
    .from("workout_exercises")
    .update({ name, notes: cleanText(input.notes, EXERCISE_NOTES_MAX_LENGTH) || null })
    .eq("id", exerciseId);
  if (error) {
    console.error("Failed to update exercise", error);
    return { ok: false, error: SAVE_ERROR };
  }

  if (load) {
    // RN-27: outside Hoje (e.g. a free plan) an adjustment is valid from today on.
    const { error: loadError } = await supabase.rpc("save_workout_load", {
      workout_exercise_id: exerciseId,
      day: firstLoadDay(today, plan.started_on),
      sets: load.sets,
      reps: load.reps,
      load_kg: load.loadKg ?? undefined,
    });
    if (loadError) {
      console.error("Failed to save exercise load", loadError);
      return { ok: false, error: "O nome foi salvo, mas não deu para salvar a carga. Tente de novo." };
    }
  }

  if (exercise.workouts) revalidateWorkout(exercise.workouts.plan_id, exercise.workout_id);
  return { ok: true };
}

export async function moveExercise(exerciseId: string, offset: -1 | 1): Promise<ExerciseActionResult> {
  const { supabase } = await loadContext();
  const exercise = await getExerciseContext(supabase, exerciseId).catch(() => null);
  if (!exercise?.workouts?.workout_plans) return { ok: false, error: "Exercício não encontrado." };
  if (exercise.workouts.workout_plans.ended_on) return { ok: false, error: ENDED_ERROR };

  const { data: siblings, error } = await supabase
    .from("workout_exercises")
    .select("id, position")
    .eq("workout_id", exercise.workout_id)
    .is("archived_at", null)
    .order("position")
    .order("created_at");
  if (error) return { ok: false, error: SAVE_ERROR };
  const index = siblings.findIndex((item) => item.id === exerciseId);
  const target = siblings[index + offset];
  if (index < 0 || !target) return { ok: true };

  const reordered = [...siblings];
  [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]];
  const results = await Promise.all(
    reordered.map((item, position) =>
      item.position === position + 1
        ? null
        : supabase.from("workout_exercises").update({ position: position + 1 }).eq("id", item.id),
    ),
  );
  if (results.some((result) => result?.error)) return { ok: false, error: SAVE_ERROR };

  revalidateWorkout(exercise.workouts.plan_id, exercise.workout_id);
  return { ok: true };
}

/** RN-26: an exercise with load history before today is archived; otherwise it is deleted. */
export async function removeExercise(exerciseId: string): Promise<ExerciseActionResult & { archived?: boolean }> {
  const { supabase, today } = await loadContext();
  const exercise = await getExerciseContext(supabase, exerciseId).catch(() => null);
  if (!exercise?.workouts?.workout_plans) return { ok: false, error: "Exercício não encontrado." };
  if (exercise.workouts.workout_plans.ended_on) return { ok: false, error: ENDED_ERROR };

  const { count, error: countError } = await supabase
    .from("workout_exercise_loads")
    .select("id", { count: "exact", head: true })
    .eq("workout_exercise_id", exerciseId)
    .lt("effective_from", today);
  if (countError) return { ok: false, error: SAVE_ERROR };

  const archived = Boolean(count);
  const { error } = archived
    ? await supabase
        .from("workout_exercises")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", exerciseId)
    : await supabase.from("workout_exercises").delete().eq("id", exerciseId);
  if (error) {
    console.error("Failed to remove exercise", error);
    return { ok: false, error: "Não deu para remover. Tente de novo." };
  }

  revalidateWorkout(exercise.workouts.plan_id, exercise.workout_id);
  return { ok: true, archived };
}
