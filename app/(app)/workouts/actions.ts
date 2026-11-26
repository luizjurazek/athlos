"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../dashboard/day-objectives";
import { getPlan, getWorkoutsWithHistory } from "./data";
import { countPlanErrors, normalizeLabel, parsePlanDraft, validatePlan, type PlanErrors } from "./validation";

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

export async function createPlan(
  sourcePlanId: string | null,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const { supabase } = await loadContext();
  const draft = parsePlanDraft(formData.get("plan"));
  if (!draft) return { error: SAVE_ERROR };
  const errors = validatePlan(draft);
  if (countPlanErrors(errors) > 0) return { errors };

  // The plan is created free; the gym objective picks it and sets each weekday's workout.
  const { data: planId, error } = await supabase.rpc("start_workout_plan", {
    title: draft.title.trim(),
    started_on: draft.startedOn,
    workouts: draft.workouts.map((workout) => ({
      label: normalizeLabel(workout.label),
      description: workout.description.trim(),
      copy_from_workout_id: workout.copyFromId,
    })),
  });
  if (error) {
    console.error("Failed to create workout plan", error);
    return { error: SAVE_ERROR };
  }

  revalidateWorkouts();
  const source = sourcePlanId ? await getPlan(supabase, sourcePlanId).catch(() => null) : null;
  // "Nova ficha" of a plan in use: confirm the switch and each day's workout in its objective.
  if (source?.objectiveId && !source.endedOn) {
    redirect(`/objectives/${source.objectiveId}/edit?plan=${planId}`);
  }
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

  const plan = await getPlan(supabase, planId).catch((error: unknown) => {
    console.error("Failed to load workout plan", error);
    return undefined;
  });
  if (plan === undefined) return { error: SAVE_ERROR };
  if (!plan) return { error: "Ficha não encontrada." };
  if (plan.endedOn) return { error: "Fichas encerradas não podem ser editadas." };

  const errors = validatePlan(draft);
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

  const { error: planError } = await supabase
    .from("workout_plans")
    .update({ title: draft.title.trim(), started_on: draft.startedOn })
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
