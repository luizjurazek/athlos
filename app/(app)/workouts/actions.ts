"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { addDays, formatNumericDate, getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../dashboard/day-objectives";
import { getGymObjectives, getPlan, getWorkoutsWithHistory, type GymObjective } from "./data";
import {
  countPlanErrors,
  normalizeLabel,
  parsePlanDraft,
  validatePlan,
  type PlanDraft,
  type PlanErrors,
} from "./validation";

export type PlanFormState = { error?: string; errors?: PlanErrors } | undefined;

type Client = ReturnType<typeof createClient>;

const SAVE_ERROR = "Não foi possível salvar a ficha. Tente de novo.";

async function loadContext() {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const timezone = await getUserTimezone(supabase, user.id);
  return { supabase, today: getUserToday(timezone) };
}

function revalidateWorkouts(planId?: string) {
  revalidatePath("/workouts");
  if (planId) revalidatePath(`/workouts/${planId}`);
  revalidatePath("/dashboard");
}

/** The new plan must start after the plan it ends, so the old one can close the day before. */
function minStartAfter(plan: { title: string; startedOn: string } | null | undefined) {
  return plan
    ? {
        day: plan.startedOn,
        message: `A ${plan.title} começou em ${formatNumericDate(plan.startedOn)}. A nova precisa começar depois.`,
      }
    : undefined;
}

function checkObjective(
  draft: PlanDraft,
  objectives: GymObjective[],
): { objective: GymObjective | null } | { error: string } {
  if (!draft.objectiveId) return { objective: null };
  const objective = objectives.find((item) => item.id === draft.objectiveId);
  if (!objective) return { error: "Esse objetivo de academia não está mais disponível. Atualize a página." };
  return { objective };
}

function toSchedule(draft: PlanDraft, objective: GymObjective | null) {
  if (!objective) return [];
  return Object.entries(draft.schedule).flatMap(([weekday, index]) =>
    index != null && objective.weekdays.includes(Number(weekday))
      ? [{ weekday: Number(weekday), workout_index: index }]
      : [],
  );
}

export async function createPlan(
  sourcePlanId: string | null,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const { supabase } = await loadContext();
  const draft = parsePlanDraft(formData.get("plan"));
  if (!draft) return { error: SAVE_ERROR };

  let objectives: GymObjective[];
  try {
    objectives = await getGymObjectives(supabase);
  } catch (error) {
    console.error("Failed to load gym objectives", error);
    return { error: SAVE_ERROR };
  }
  const checked = checkObjective(draft, objectives);
  if ("error" in checked) return { errors: { workouts: [], objective: checked.error } };
  const { objective } = checked;

  const source = sourcePlanId ? await getPlan(supabase, sourcePlanId).catch(() => null) : null;
  const copying = draft.workouts.some((workout) => workout.copyFromId);
  const freeSource =
    copying && !objective && source && !source.objectiveId && !source.endedOn ? source : null;
  const errors = validatePlan(draft, {
    minStartedOn: minStartAfter(objective?.activePlan ?? freeSource),
  });
  if (countPlanErrors(errors) > 0) return { errors };

  const { data: planId, error } = await supabase.rpc("start_workout_plan", {
    objective_id: objective?.id,
    title: draft.title.trim(),
    started_on: draft.startedOn,
    workouts: draft.workouts.map((workout) => ({
      label: normalizeLabel(workout.label),
      description: workout.description.trim(),
      copy_from_workout_id: workout.copyFromId,
    })),
    schedule: toSchedule(draft, objective),
  });
  if (error) {
    console.error("Failed to create workout plan", error);
    return { error: SAVE_ERROR };
  }

  // "Nova ficha" from a free plan: the RPC only ends the objective's plan, so end the source here.
  if (freeSource) {
    const { error: endError } = await supabase
      .from("workout_plans")
      .update({ ended_on: addDays(draft.startedOn, -1) })
      .eq("id", freeSource.id);
    if (endError) console.error("Failed to end the copied free plan", endError);
  }

  revalidateWorkouts();
  redirect(`/workouts/${planId}`);
}

export async function updatePlan(
  planId: string,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const { supabase, today } = await loadContext();
  const draft = parsePlanDraft(formData.get("plan"));
  if (!draft) return { error: SAVE_ERROR };

  let plan;
  let objectives: GymObjective[];
  try {
    [plan, objectives] = await Promise.all([getPlan(supabase, planId), getGymObjectives(supabase)]);
  } catch (error) {
    console.error("Failed to load workout plan", error);
    return { error: SAVE_ERROR };
  }
  if (!plan) return { error: "Ficha não encontrada." };
  if (plan.endedOn) return { error: "Fichas encerradas não podem ser editadas." };

  const checked = checkObjective(draft, objectives);
  if ("error" in checked) return { errors: { workouts: [], objective: checked.error } };
  const { objective } = checked;
  const otherPlan =
    objective?.activePlan && objective.activePlan.id !== planId ? objective.activePlan : null;

  const errors = validatePlan(draft);
  if (otherPlan && !draft.confirmEndOther) {
    errors.objective = `Confirme que a ${otherPlan.title} será encerrada.`;
  }

  const keptIds = new Set(draft.workouts.flatMap((workout) => (workout.id ? [workout.id] : [])));
  if (draft.workouts.some((workout) => workout.id && !plan.workouts.some((item) => item.id === workout.id))) {
    return { error: "A ficha mudou em outro lugar. Atualize a página." };
  }
  const removed = plan.workouts.filter((workout) => !keptIds.has(workout.id));
  try {
    const withHistory = await getWorkoutsWithHistory(supabase, removed.map((workout) => workout.id), today);
    const blocked = removed.filter((workout) => withHistory.has(workout.id));
    if (blocked.length > 0) {
      errors.workoutsList = `O treino ${blocked.map((workout) => workout.label).join(", ")} já tem histórico e não pode ser excluído. Para mudar a estrutura, crie uma nova ficha.`;
    }
  } catch (error) {
    console.error("Failed to load workout history", error);
    return { error: SAVE_ERROR };
  }
  if (countPlanErrors(errors) > 0) return { errors };

  if (otherPlan) {
    const endedOn = addDays(today, -1) < otherPlan.startedOn ? otherPlan.startedOn : addDays(today, -1);
    const { error } = await supabase
      .from("workout_plans")
      .update({ ended_on: endedOn })
      .eq("id", otherPlan.id);
    if (error) {
      console.error("Failed to end the objective's other plan", error);
      return { error: SAVE_ERROR };
    }
  }

  // Changing or removing the objective clears the schedule (trigger in the gym schema migration).
  const { error: planError } = await supabase
    .from("workout_plans")
    .update({
      title: draft.title.trim(),
      started_on: draft.startedOn,
      objective_id: objective?.id,
    })
    .eq("id", planId);
  if (planError) {
    console.error("Failed to update workout plan", planError);
    return { error: SAVE_ERROR };
  }

  const { error: workoutsError } = await supabase.rpc("save_plan_workouts", {
    plan_id: planId,
    workouts: draft.workouts.map((workout) => ({
      id: workout.id,
      label: normalizeLabel(workout.label),
      description: workout.description.trim(),
    })),
  });
  if (workoutsError) {
    console.error("Failed to save plan workouts", workoutsError);
    return { error: "A ficha foi salva, mas não deu para salvar os treinos. Tente de novo." };
  }

  revalidateWorkouts(planId);
  redirect(`/workouts/${planId}`);
}

async function endPlanOn(supabase: Client, planId: string, today: string) {
  const { data: plan, error } = await supabase
    .from("workout_plans")
    .select("started_on, ended_on")
    .eq("id", planId)
    .maybeSingle();
  if (error || !plan) return { error: "Ficha não encontrada." };
  if (plan.ended_on) return { error: "Essa ficha já está encerrada." };
  const { error: updateError } = await supabase
    .from("workout_plans")
    .update({ ended_on: today < plan.started_on ? plan.started_on : today })
    .eq("id", planId);
  return updateError ? { error: "Não foi possível encerrar a ficha. Tente de novo." } : null;
}

export async function endPlan(planId: string): Promise<PlanFormState> {
  const { supabase, today } = await loadContext();
  const failure = await endPlanOn(supabase, planId, today);
  if (failure) return failure;
  revalidateWorkouts(planId);
  redirect(`/workouts/${planId}`);
}

export type ScheduleResult = { ok: true } | { ok: false; error: string };

/** RN-28: replaces the plan's schedule; only the linked objective's weekdays are accepted. */
export async function savePlanSchedule(
  planId: string,
  entries: { weekday: number; workoutId: string | null }[],
): Promise<ScheduleResult> {
  const { supabase } = await loadContext();
  const plan = await getPlan(supabase, planId).catch(() => null);
  if (!plan) return { ok: false, error: "Ficha não encontrada." };
  if (plan.endedOn) return { ok: false, error: "Fichas encerradas não podem ser editadas." };
  if (!plan.objectiveId || !plan.objectiveWeekdays) {
    return { ok: false, error: "Agenda precisa de um objetivo. Vincule a ficha antes." };
  }
  const weekdays = plan.objectiveWeekdays;
  const workoutIds = new Set(plan.workouts.map((workout) => workout.id));
  if (!Array.isArray(entries)) return { ok: false, error: SAVE_ERROR };
  for (const entry of entries) {
    if (!weekdays.includes(entry.weekday)) {
      return { ok: false, error: "Esse dia não está nos dias do objetivo." };
    }
    if (entry.workoutId !== null && !workoutIds.has(entry.workoutId)) {
      return { ok: false, error: "Esse treino não é desta ficha. Atualize a página." };
    }
  }

  const rows = entries.flatMap((entry) =>
    entry.workoutId ? [{ plan_id: planId, weekday: entry.weekday, workout_id: entry.workoutId }] : [],
  );
  const cleared = entries.filter((entry) => !entry.workoutId).map((entry) => entry.weekday);
  const [upserted, deleted] = await Promise.all([
    rows.length > 0 ? supabase.from("workout_schedule").upsert(rows, { onConflict: "plan_id,weekday" }) : null,
    cleared.length > 0
      ? supabase.from("workout_schedule").delete().eq("plan_id", planId).in("weekday", cleared)
      : null,
  ]);
  if (upserted?.error || deleted?.error) {
    console.error("Failed to save the schedule", upserted?.error ?? deleted?.error);
    return { ok: false, error: SAVE_ERROR };
  }

  revalidateWorkouts(planId);
  return { ok: true };
}
