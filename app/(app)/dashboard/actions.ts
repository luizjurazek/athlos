"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CHECK_BACKFILL_DAYS, getBackfillStart, isWithinBackfill } from "@/app/utils/checks";
import { getUserToday, isDay } from "@/app/utils/dates";
import { getOccurrence, isDueOn } from "@/app/utils/occurrences";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { findSameActivityOnDay, isWithinWorkoutSwapWindow } from "@/app/utils/workouts";
import { getDayChanges, getDayConflict, getUserTimezone } from "./day-objectives";
import { getGymDays } from "./gym-day";
import { hasLoadErrors, parseLoad, validateLoad } from "@/app/utils/workout-loads";
import type { Reschedule } from "@/app/utils/occurrences";

export type CheckFailure = "out-of-window" | "not-scheduled" | "failed";
export type SetCheckResult = { ok: true } | { ok: false; reason: CheckFailure };
export type RescheduleResult = { ok: true } | { ok: false; error: string };
export type AdditionResult = RescheduleResult;
export type DayWorkoutFailure = "out-of-window" | "not-scheduled" | "invalid-workout" | "failed";
export type SetDayWorkoutResult = { ok: true } | { ok: false; reason: DayWorkoutFailure };

const UNIQUE_VIOLATION = "23505";

async function loadContext(objectiveId: string) {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [timezone, objectiveResult] = await Promise.all([
    getUserTimezone(supabase, user.id),
    supabase
      .from("objectives")
      .select("id, title, weekdays, archived_at, reschedulable, created_at, activity_type")
      .eq("id", objectiveId)
      .maybeSingle(),
  ]);
  const objective = objectiveResult.data;
  return {
    supabase,
    timezone,
    today: getUserToday(timezone),
    objective: objective && {
      ...objective,
      createdDay: getUserToday(timezone, new Date(objective.created_at)),
    },
  };
}

function revalidate(objectiveId: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/objectives/${objectiveId}`);
}

// Takes the target state instead of flipping, so a retry or double tap never undoes the user's intent.
export async function setCheck(
  objectiveId: string,
  day: string,
  checked: boolean,
): Promise<SetCheckResult> {
  const { supabase, today, objective } = await loadContext(objectiveId);
  if (!isDay(day) || !isWithinBackfill(day, today)) {
    return { ok: false, reason: "out-of-window" };
  }
  if (!objective || objective.archived_at) return { ok: false, reason: "not-scheduled" };

  const changes = await getDayChanges(supabase, day, day, objectiveId);
  if (!isDueOn(objective, day, changes)) return { ok: false, reason: "not-scheduled" };

  if (checked) {
    const { error } = await supabase
      .from("objective_checks")
      .insert({ objective_id: objectiveId, day });
    if (error && error.code !== UNIQUE_VIOLATION) {
      console.error("Failed to insert check", error);
      return { ok: false, reason: "failed" };
    }
    if (objective.activity_type === "gym") {
      // RN-29: the session keeps which workout was done even if the schedule changes later.
      await ensureSession(supabase, objectiveId, day, getOccurrence(objective, day, changes).reschedule).catch(
        (sessionError: unknown) => console.error("Failed to record the session", sessionError),
      );
    }
  } else {
    const { error } = await supabase
      .from("objective_checks")
      .delete()
      .eq("objective_id", objectiveId)
      .eq("day", day);
    if (error) {
      console.error("Failed to delete check", error);
      return { ok: false, reason: "failed" };
    }
  }

  revalidate(objectiveId);
  return { ok: true };
}

/** RN-13/RN-14 are validated here; the RPC writes the reschedule and the optional check atomically. */
export async function rescheduleObjective(
  objectiveId: string,
  fromDay: string,
  toDay: string,
  markDone: boolean,
): Promise<RescheduleResult> {
  const { supabase, timezone, today, objective } = await loadContext(objectiveId);
  if (!objective || objective.archived_at || !objective.reschedulable) {
    return { ok: false, error: "Esse objetivo não pode mudar de dia." };
  }
  if (!isDay(fromDay) || !isDay(toDay) || fromDay === toDay) {
    return { ok: false, error: "Escolha outro dia." };
  }
  const windowStart = getBackfillStart(today);
  if (fromDay < windowStart || toDay < windowStart) {
    return { ok: false, error: `Só dá para mudar dias dos últimos ${CHECK_BACKFILL_DAYS} dias.` };
  }
  if (markDone && toDay > today) {
    return { ok: false, error: "Só dá para marcar feito hoje ou em dias passados." };
  }

  const [first, last] = fromDay < toDay ? [fromDay, toDay] : [toDay, fromDay];
  const [changes, checksResult] = await Promise.all([
    getDayChanges(supabase, first, last, objectiveId),
    supabase
      .from("objective_checks")
      .select("day")
      .eq("objective_id", objectiveId)
      .in("day", [fromDay, toDay]),
  ]);
  if (checksResult.error) return { ok: false, error: "Não deu para mudar o dia. Tente de novo." };
  const checkedDays = new Set(checksResult.data.map((check) => check.day));

  const origin = getOccurrence(objective, fromDay, changes);
  if (!origin.due || origin.reschedule || origin.addition) {
    return { ok: false, error: `${objective.title} não está programado nesse dia.` };
  }
  if (checkedDays.has(fromDay)) {
    return { ok: false, error: "Esse dia já tem check. Desmarque antes de mudar." };
  }
  const destination = getOccurrence(objective, toDay, changes);
  if (destination.due) {
    return { ok: false, error: `Já tem ${objective.title} neste dia.` };
  }
  if (destination.replacedBy) {
    return { ok: false, error: `${objective.title} foi trocado neste dia.` };
  }
  if (checkedDays.has(toDay)) {
    return { ok: false, error: "Esse dia já tem check." };
  }
  const sameActivity = await findSameActivityConflict(supabase, timezone, objective, toDay).catch(() => undefined);
  if (sameActivity === undefined) return { ok: false, error: "Não deu para mudar o dia. Tente de novo." };
  if (sameActivity) return { ok: false, error: `Já tem ${sameActivity} (Academia) neste dia.` };

  const { error } = await supabase.rpc("reschedule_objective", {
    objective_id: objectiveId,
    from_day: fromDay,
    to_day: toDay,
    mark_done: markDone,
  });
  if (error) {
    console.error("Failed to reschedule objective", error);
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "Esse dia já foi mudado. Atualize a página." };
    }
    return { ok: false, error: "Não deu para mudar o dia. Tente de novo." };
  }

  revalidate(objectiveId);
  return { ok: true };
}

export async function undoReschedule(rescheduleId: string): Promise<RescheduleResult> {
  await requireUser();
  const supabase = createClient(await cookies());
  const { data: reschedule } = await supabase
    .from("objective_reschedules")
    .select("objective_id, to_day")
    .eq("id", rescheduleId)
    .maybeSingle();
  if (!reschedule) return { ok: false, error: "Essa mudança já foi desfeita. Atualize a página." };

  const { count, error: countError } = await supabase
    .from("objective_checks")
    .select("id", { count: "exact", head: true })
    .eq("objective_id", reschedule.objective_id)
    .eq("day", reschedule.to_day);
  if (countError) return { ok: false, error: "Não deu para desfazer. Tente de novo." };
  if (count) {
    return { ok: false, error: "O novo dia já tem check. Desmarque antes de desfazer." };
  }

  const { error } = await supabase.from("objective_reschedules").delete().eq("id", rescheduleId);
  if (error) {
    console.error("Failed to undo reschedule", error);
    return { ok: false, error: "Não deu para desfazer. Tente de novo." };
  }

  revalidate(reschedule.objective_id);
  return { ok: true };
}

const CONFLICT_ERRORS = {
  "same-activity": () => "Já tem Academia neste dia.",
  due: (title: string) => `Já tem ${title} neste dia.`,
  checked: (title: string) => `${title} já tem check neste dia.`,
  moved: (title: string) => `${title} mudou de dia. Desfaça a mudança antes.`,
  replaced: (title: string) => `${title} foi trocado neste dia.`,
};

/**
 * RN-22/RN-23: adds an occurrence of the objective to the day, optionally in place of another objective's
 * occurrence. The RPC writes the addition and the optional check atomically.
 */
export async function addObjectiveToDay(
  objectiveId: string,
  day: string,
  replacedObjectiveId: string | null,
  markDone: boolean,
  workoutId: string | null = null,
): Promise<AdditionResult> {
  const { supabase, timezone, today, objective } = await loadContext(objectiveId);
  if (!objective || objective.archived_at) {
    return { ok: false, error: "Esse objetivo não está mais ativo. Atualize a página." };
  }
  if (!isDay(day) || day < getBackfillStart(today)) {
    return { ok: false, error: `Só dá para mudar dias dos últimos ${CHECK_BACKFILL_DAYS} dias.` };
  }
  if (markDone && day > today) {
    return { ok: false, error: "Só dá para marcar feito hoje ou em dias passados." };
  }

  const objectiveIds = replacedObjectiveId ? [objectiveId, replacedObjectiveId] : [objectiveId];
  const [changes, checksResult, replacedResult, alternativeResult] = await Promise.all([
    getDayChanges(supabase, day, day),
    supabase
      .from("objective_checks")
      .select("objective_id")
      .eq("day", day)
      .in("objective_id", objectiveIds),
    replacedObjectiveId
      ? supabase
          .from("objectives")
          .select("id, title, weekdays, archived_at, created_at")
          .eq("id", replacedObjectiveId)
          .maybeSingle()
      : null,
    replacedObjectiveId
      ? supabase
          .from("objective_alternatives")
          .select("alternative_id")
          .eq("objective_id", replacedObjectiveId)
          .eq("alternative_id", objectiveId)
          .maybeSingle()
      : null,
  ]).catch((error: unknown) => {
    console.error("Failed to load the day", error);
    return [null, null, null, null] as const;
  });
  if (
    !changes ||
    !checksResult ||
    checksResult.error ||
    replacedResult?.error ||
    alternativeResult?.error
  ) {
    return { ok: false, error: "Não deu para salvar. Tente de novo." };
  }
  const checkedIds = new Set(checksResult.data.map((check) => check.objective_id));

  const conflict = getDayConflict(objective, day, changes, checkedIds.has(objectiveId));
  if (conflict) return { ok: false, error: CONFLICT_ERRORS[conflict](objective.title) };
  const sameActivity = await findSameActivityConflict(
    supabase,
    timezone,
    objective,
    day,
    replacedObjectiveId,
  ).catch(() => undefined);
  if (sameActivity === undefined) return { ok: false, error: "Não deu para salvar. Tente de novo." };
  if (sameActivity) return { ok: false, error: CONFLICT_ERRORS["same-activity"]() };

  // RN-35: a gym extra or swap is only saved with the workout of the day.
  if (objective.activity_type === "gym") {
    const plan = await getPlanCovering(supabase, objectiveId, day).catch(() => undefined);
    if (plan === undefined) return { ok: false, error: "Não deu para salvar. Tente de novo." };
    if (!plan) return { ok: false, error: `${objective.title} não tem ficha ativa.` };
    if (!workoutId || !plan.workoutIds.includes(workoutId)) {
      return { ok: false, error: "Escolha o treino do dia." };
    }
  } else if (workoutId) {
    return { ok: false, error: "Esse objetivo não tem treino." };
  }

  if (replacedObjectiveId) {
    const replaced = replacedResult?.data;
    if (!replaced || replaced.archived_at) {
      return { ok: false, error: "Esse objetivo não está mais ativo. Atualize a página." };
    }
    if (!alternativeResult?.data) {
      return { ok: false, error: `${objective.title} não está nas trocas de ${replaced.title}.` };
    }
    // Only a plain scheduled occurrence can be swapped; moved or added ones are undone first.
    const occurrence = getOccurrence(
      { ...replaced, createdDay: getUserToday(timezone, new Date(replaced.created_at)) },
      day,
      changes,
    );
    if (!occurrence.due || occurrence.reschedule || occurrence.addition) {
      return { ok: false, error: `${replaced.title} não está programado nesse dia.` };
    }
    if (checkedIds.has(replacedObjectiveId)) {
      return { ok: false, error: `${replaced.title} já tem check neste dia. Desmarque antes de trocar.` };
    }
  }

  const { error } = await supabase.rpc("add_objective_to_day", {
    objective_id: objectiveId,
    day,
    replaced_objective_id: replacedObjectiveId ?? undefined,
    mark_done: markDone,
    workout_id: workoutId ?? undefined,
  });
  if (error) {
    console.error("Failed to add objective to day", error);
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "Esse dia já mudou. Atualize a página." };
    }
    return { ok: false, error: "Não deu para salvar. Tente de novo." };
  }

  revalidate(objectiveId);
  if (replacedObjectiveId) revalidatePath(`/objectives/${replacedObjectiveId}`);
  return { ok: true };
}

export async function undoObjectiveAddition(additionId: string): Promise<AdditionResult> {
  await requireUser();
  const supabase = createClient(await cookies());
  const { data: addition } = await supabase
    .from("objective_additions")
    .select("objective_id, day, replaced_objective_id")
    .eq("id", additionId)
    .maybeSingle();
  if (!addition) return { ok: false, error: "Isso já foi desfeito. Atualize a página." };

  const { count, error: countError } = await supabase
    .from("objective_checks")
    .select("id", { count: "exact", head: true })
    .eq("objective_id", addition.objective_id)
    .eq("day", addition.day);
  if (countError) return { ok: false, error: "Não deu para desfazer. Tente de novo." };
  if (count) return { ok: false, error: "Esse dia já tem check. Desmarque antes de desfazer." };

  const { error } = await supabase.from("objective_additions").delete().eq("id", additionId);
  if (error) {
    console.error("Failed to undo objective addition", error);
    return { ok: false, error: "Não deu para desfazer. Tente de novo." };
  }

  revalidate(addition.objective_id);
  if (addition.replaced_objective_id) revalidatePath(`/objectives/${addition.replaced_objective_id}`);
  return { ok: true };
}

type Client = ReturnType<typeof createClient>;

/** RN-33: title of another objective of the same activity type already on the day, or null. */
async function findSameActivityConflict(
  supabase: Client,
  timezone: string,
  objective: { id: string; activity_type: string | null },
  day: string,
  ignoreId: string | null = null,
): Promise<string | null> {
  if (!objective.activity_type) return null;
  const [others, changes] = await Promise.all([
    supabase
      .from("objectives")
      .select("id, title, weekdays, activity_type, created_at")
      .eq("activity_type", "gym")
      .is("archived_at", null)
      .neq("id", objective.id),
    getDayChanges(supabase, day, day),
  ]);
  if (others.error) throw others.error;
  const withCreated = others.data.map((other) => ({
    ...other,
    createdDay: getUserToday(timezone, new Date(other.created_at)),
  }));
  return findSameActivityOnDay(objective, day, withCreated, changes, ignoreId)?.title ?? null;
}

/** The plan linked to the objective that covers the day (the active one, or an older one for past days). */
async function getPlanCovering(supabase: Client, objectiveId: string, day: string) {
  const { data, error } = await supabase
    .from("workout_plans")
    .select("id, started_on, ended_on, workouts ( id )")
    .eq("objective_id", objectiveId)
    .lte("started_on", day)
    .or(`ended_on.is.null,ended_on.gte.${day}`)
    .order("started_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data && { id: data.id, workoutIds: data.workouts.map((workout) => workout.id) };
}

/**
 * RN-28: sets the workout of one day of a gym objective, whatever defined it before (schedule,
 * an earlier choice, an extra or a day already done). The check is left as it is.
 */
export async function setDayWorkout(
  objectiveId: string,
  day: string,
  workoutId: string,
): Promise<SetDayWorkoutResult> {
  const { supabase, today, objective } = await loadContext(objectiveId);
  if (!isDay(day) || !isWithinWorkoutSwapWindow(day, today)) return { ok: false, reason: "out-of-window" };
  if (!objective || objective.archived_at || objective.activity_type !== "gym") {
    return { ok: false, reason: "not-scheduled" };
  }
  const changes = await getDayChanges(supabase, day, day, objectiveId).catch(() => null);
  if (!changes) return { ok: false, reason: "failed" };
  if (!getOccurrence(objective, day, changes).due) return { ok: false, reason: "not-scheduled" };

  const plan = await getPlanCovering(supabase, objectiveId, day).catch(() => undefined);
  if (plan === undefined) return { ok: false, reason: "failed" };
  if (!plan || !plan.workoutIds.includes(workoutId)) return { ok: false, reason: "invalid-workout" };

  const { error } = await supabase
    .from("activity_sessions")
    .upsert(
      { objective_id: objectiveId, day, activity_type: "gym", workout_id: workoutId },
      { onConflict: "objective_id,day" },
    );
  if (error) {
    console.error("Failed to set the day workout", error);
    return { ok: false, reason: "failed" };
  }

  revalidate(objectiveId);
  return { ok: true };
}

async function ensureSession(
  supabase: Client,
  objectiveId: string,
  day: string,
  reschedule: Reschedule | null,
) {
  const { data: existing, error } = await supabase
    .from("activity_sessions")
    .select("id")
    .eq("objective_id", objectiveId)
    .eq("day", day)
    .maybeSingle();
  if (error) throw error;
  if (existing) return;
  const gym = await getGymDays(supabase, [{ id: objectiveId, reschedule }], day);
  const { error: insertError } = await supabase.from("activity_sessions").insert({
    objective_id: objectiveId,
    day,
    activity_type: "gym",
    workout_id: gym[objectiveId]?.workout?.workoutId ?? null,
  });
  if (insertError && insertError.code !== UNIQUE_VIOLATION) throw insertError;
}

export type SaveLoadResult = { ok: true } | { ok: false; reason: "out-of-window" | "invalid" | "failed" };

/** RN-27: adjusting on Hoje writes the version of the selected day (today or the backfill window). */
export async function saveDayLoad(
  exerciseId: string,
  day: string,
  load: unknown,
): Promise<SaveLoadResult> {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const today = getUserToday(await getUserTimezone(supabase, user.id));
  if (!isDay(day) || !isWithinBackfill(day, today)) return { ok: false, reason: "out-of-window" };
  const values = parseLoad(load);
  if (hasLoadErrors(validateLoad(values))) return { ok: false, reason: "invalid" };

  const { error } = await supabase.rpc("save_workout_load", {
    workout_exercise_id: exerciseId,
    day,
    sets: values.sets,
    reps: values.reps,
    load_kg: values.loadKg ?? undefined,
  });
  if (error) {
    console.error("Failed to save the day load", error);
    return { ok: false, reason: "failed" };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}
