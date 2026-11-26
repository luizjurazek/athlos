"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBackfillStart } from "@/app/utils/checks";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays, normalizeWeekdays } from "@/app/utils/weekdays";
import { getUserTimezone } from "../dashboard/day-objectives";
import {
  isObjectiveColor,
  isObjectiveIcon,
  TITLE_MAX_LENGTH,
} from "./options";

export type ObjectiveFieldErrors = {
  weekdays?: string;
  activityType?: string;
  plan?: string;
  schedule?: string;
};
export type FormState = { error?: string; errors?: ObjectiveFieldErrors } | undefined;


type Client = ReturnType<typeof createClient>;

/** Reschedules still open: destination inside the window (or ahead) and without a check yet. */
async function countPendingReschedules(supabase: Client, objectiveId: string, userId: string) {
  const today = getUserToday(await getUserTimezone(supabase, userId));
  const [reschedules, checks] = await Promise.all([
    supabase
      .from("objective_reschedules")
      .select("to_day")
      .eq("objective_id", objectiveId)
      .gte("to_day", getBackfillStart(today)),
    supabase
      .from("objective_checks")
      .select("day")
      .eq("objective_id", objectiveId)
      .gte("day", getBackfillStart(today)),
  ]);
  if (reschedules.error) throw reschedules.error;
  if (checks.error) throw checks.error;
  const checkedDays = new Set(checks.data.map((check) => check.day));
  return reschedules.data.filter((item) => !checkedDays.has(item.to_day)).length;
}

function parseIds(formData: FormData, name: "goal_ids" | "alternative_ids") {
  return [
    ...new Set(
      formData
        .getAll(name)
        .filter((value): value is string => typeof value === "string" && value !== ""),
    ),
  ];
}

/** RN-21: replaces the objective's alternatives with `alternativeIds` (the composite FK keeps them owned). */
async function syncAlternatives(supabase: Client, objectiveId: string, alternativeIds: string[]) {
  const { data, error } = await supabase
    .from("objective_alternatives")
    .select("alternative_id")
    .eq("objective_id", objectiveId);
  if (error) return error;
  const linked = data.map((link) => link.alternative_id);
  const removed = linked.filter((id) => !alternativeIds.includes(id));
  const added = alternativeIds.filter((id) => id !== objectiveId && !linked.includes(id));
  const [removeResult, addResult] = await Promise.all([
    removed.length > 0
      ? supabase
          .from("objective_alternatives")
          .delete()
          .eq("objective_id", objectiveId)
          .in("alternative_id", removed)
      : null,
    added.length > 0
      ? supabase
          .from("objective_alternatives")
          .insert(added.map((alternativeId) => ({ objective_id: objectiveId, alternative_id: alternativeId })))
      : null,
  ]);
  return removeResult?.error ?? addResult?.error ?? null;
}

function joinTitles(titles: string[]) {
  return titles.length === 1
    ? `da meta ${titles[0]}`
    : `das metas ${titles.slice(0, -1).join(", ")} e ${titles.at(-1)}`;
}

async function getLinkedGoalIds(supabase: Client, objectiveId: string) {
  const { data, error } = await supabase
    .from("goal_objectives")
    .select("goal_id")
    .eq("objective_id", objectiveId);
  if (error) throw error;
  return data.map((link) => link.goal_id);
}

// RN-18: a goal measured by checks can never lose its last objective (entry goals may have none).
async function findGoalsOnlyFedBy(supabase: Client, objectiveId: string, goalIds: string[]) {
  if (goalIds.length === 0) return [];
  const { data, error } = await supabase
    .from("goal_objectives")
    .select("goal_id, objective_id, goals ( title, progress_source )")
    .in("goal_id", goalIds);
  if (error) throw error;
  return goalIds.flatMap((goalId) => {
    const links = data.filter((link) => link.goal_id === goalId);
    const onlyThis = links.every((link) => link.objective_id === objectiveId);
    const goal = links[0]?.goals;
    const title = goal?.progress_source === "checks" ? goal.title : null;
    return onlyThis && title ? [title] : [];
  });
}

type ObjectiveInput = {
  title: string;
  color: string | null;
  icon: string | null;
  weekdays: number[];
  reschedulable: boolean;
  activity_type: "gym" | null;
};

const ACTIVITY_OVERLAP = "objectives_activity_weekdays_overlap";

/** RN-33: another active gym objective already on one of these weekdays. */
async function findActivityConflict(
  supabase: Client,
  input: Pick<ObjectiveInput, "activity_type" | "weekdays">,
  objectiveId?: string,
): Promise<string | null> {
  if (!input.activity_type) return null;
  let query = supabase
    .from("objectives")
    .select("title, weekdays")
    .eq("activity_type", input.activity_type)
    .is("archived_at", null)
    .overlaps("weekdays", input.weekdays);
  if (objectiveId) query = query.neq("id", objectiveId);
  const { data, error } = await query;
  if (error) throw error;
  const other = data[0];
  if (!other) return null;
  const shared = other.weekdays.filter((day) => input.weekdays.includes(day));
  return `${formatWeekdays(shared)} já ${shared.length === 1 ? "é" : "são"} da ${other.title}. Dois objetivos de academia não podem cair no mesmo dia.`;
}

async function getActivePlanId(supabase: Client, objectiveId: string) {
  const { data, error } = await supabase
    .from("workout_plans")
    .select("id")
    .eq("objective_id", objectiveId)
    .is("ended_on", null)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * RN-25/RN-34: the objective owns the link to its plan and each weekday's workout. The RPC links the
 * chosen free plan (ending the previous one) or unlinks it, and replaces the schedule.
 */
async function savePlanChoice(
  supabase: Client,
  objectiveId: string,
  formData: FormData,
  input: ObjectiveInput,
  userId: string,
) {
  const value = formData.get("plan_id");
  const planId = typeof value === "string" && value ? value : null;
  const schedule = planId
    ? input.weekdays.flatMap((weekday) => {
        const workoutId = formData.get(`schedule_${weekday}`);
        return typeof workoutId === "string" && workoutId ? [{ weekday, workout_id: workoutId }] : [];
      })
    : [];
  const today = getUserToday(await getUserTimezone(supabase, userId));
  const { error } = await supabase.rpc("set_objective_plan", {
    objective_id: objectiveId,
    today,
    plan_id: planId ?? undefined,
    schedule,
  });
  return error;
}

function parseObjective(
  formData: FormData,
): { input: ObjectiveInput } | { error: string } {
  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  if (!title) return { error: "Dê um nome ao objetivo." };
  if (title.length > TITLE_MAX_LENGTH) {
    return { error: `O nome pode ter no máximo ${TITLE_MAX_LENGTH} caracteres.` };
  }

  const weekdays = normalizeWeekdays(
    formData.getAll("weekdays").map((value) => Number(value)),
  );
  if (weekdays.length === 0) {
    return { error: "Escolha pelo menos um dia da semana." };
  }

  const color = formData.get("color");
  const icon = formData.get("icon");

  return {
    input: {
      title,
      color: isObjectiveColor(color) ? color : null,
      icon: isObjectiveIcon(icon) ? icon : null,
      weekdays,
      reschedulable: formData.get("reschedulable") === "on",
      activity_type: formData.get("activity_type") === "gym" ? "gym" : null,
    },
  };
}

export async function createObjective(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseObjective(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createClient(await cookies());
  const conflict = await findActivityConflict(supabase, parsed.input).catch(() => null);
  if (conflict) return { errors: { weekdays: conflict } };
  const { data, error } = await supabase
    .from("objectives")
    .insert(parsed.input)
    .select("id")
    .single();
  if (error?.message.includes(ACTIVITY_OVERLAP) || error?.details?.includes(ACTIVITY_OVERLAP)) {
    return { errors: { weekdays: "Outro objetivo de academia já está nesses dias." } };
  }
  if (error) return { error: "Não foi possível salvar o objetivo. Tente de novo." };

  const goalIds = parseIds(formData, "goal_ids");
  if (goalIds.length > 0) {
    const { error: linkError } = await supabase
      .from("goal_objectives")
      .insert(goalIds.map((goalId) => ({ goal_id: goalId, objective_id: data.id })));
    if (linkError) {
      console.error("Failed to link objective to goals", linkError);
      await supabase.from("objectives").delete().eq("id", data.id);
      return { error: "Não foi possível vincular o objetivo às metas. Tente de novo." };
    }
  }

  const alternativesError = await syncAlternatives(
    supabase,
    data.id,
    parseIds(formData, "alternative_ids"),
  );
  if (alternativesError) {
    console.error("Failed to save objective alternatives", alternativesError);
    await supabase.from("objectives").delete().eq("id", data.id);
    return { error: "Não foi possível salvar as trocas do objetivo. Tente de novo." };
  }

  const planError = parsed.input.activity_type
    ? await savePlanChoice(supabase, data.id, formData, parsed.input, user.id)
    : null;
  if (planError) {
    console.error("Failed to link workout plan", planError);
    return { error: "O objetivo foi criado, mas não deu para vincular a ficha. Tente pela edição." };
  }

  redirect("/objectives");
}

export async function updateObjective(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseObjective(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createClient(await cookies());
  try {
    const conflict = await findActivityConflict(supabase, parsed.input, id);
    if (conflict) return { errors: { weekdays: conflict } };
    if (!parsed.input.activity_type && (await getActivePlanId(supabase, id))) {
      return {
        errors: {
          activityType: "Este objetivo tem uma ficha ativa. Encerre ou desvincule a ficha para mudar para Comum.",
        },
      };
    }
  } catch (error) {
    console.error("Failed to validate the objective activity", error);
    return { error: "Não foi possível salvar o objetivo. Tente de novo." };
  }
  if (!parsed.input.reschedulable) {
    const pending = await countPendingReschedules(supabase, id, user.id).catch(() => null);
    if (pending === null) return { error: "Não foi possível salvar o objetivo. Tente de novo." };
    if (pending > 0) {
      return {
        error: `Esse objetivo tem ${pending === 1 ? "1 mudança de dia pendente" : `${pending} mudanças de dia pendentes`}. Desfaça antes de desligar "Pode mudar de dia".`,
      };
    }
  }
  const goalIds = parseIds(formData, "goal_ids");
  let removedGoalIds: string[];
  let addedGoalIds: string[];
  try {
    const linked = await getLinkedGoalIds(supabase, id);
    removedGoalIds = linked.filter((goalId) => !goalIds.includes(goalId));
    addedGoalIds = goalIds.filter((goalId) => !linked.includes(goalId));
    const blocking = await findGoalsOnlyFedBy(supabase, id, removedGoalIds);
    if (blocking.length > 0) {
      return {
        error: `Esse é o único objetivo ${joinTitles(blocking)}. Vincule outro antes de remover.`,
      };
    }
  } catch (error) {
    console.error("Failed to load objective goals", error);
    return { error: "Não foi possível salvar o objetivo. Tente de novo." };
  }

  // Changing weekdays never touches past checks: they stay tied to their own day.
  const { data, error } = await supabase
    .from("objectives")
    .update(parsed.input)
    .eq("id", id)
    .select("id");
  if (error) return { error: "Não foi possível salvar o objetivo. Tente de novo." };
  // RLS hides other users' rows, so an empty result means "not yours" or "gone".
  if (data.length === 0) return { error: "Objetivo não encontrado." };

  const [removed, added] = await Promise.all([
    removedGoalIds.length > 0
      ? supabase
          .from("goal_objectives")
          .delete()
          .eq("objective_id", id)
          .in("goal_id", removedGoalIds)
      : null,
    addedGoalIds.length > 0
      ? supabase
          .from("goal_objectives")
          .insert(addedGoalIds.map((goalId) => ({ goal_id: goalId, objective_id: id })))
      : null,
  ]);
  if (removed?.error || added?.error) {
    console.error("Failed to sync objective goals", removed?.error ?? added?.error);
    return { error: "O objetivo foi salvo, mas não deu para atualizar as metas. Tente de novo." };
  }

  const alternativesError = await syncAlternatives(supabase, id, parseIds(formData, "alternative_ids"));
  if (alternativesError) {
    console.error("Failed to sync objective alternatives", alternativesError);
    return { error: "O objetivo foi salvo, mas não deu para atualizar as trocas. Tente de novo." };
  }

  if (parsed.input.activity_type) {
    const planError = await savePlanChoice(supabase, id, formData, parsed.input, user.id);
    if (planError) {
      console.error("Failed to save the objective plan", planError);
      return {
        errors:
          planError.code === "23503"
            ? { plan: "Essa ficha não está mais livre ou um treino mudou. Atualize a página." }
            : { schedule: "Não deu para salvar a ficha e os treinos de cada dia. Tente de novo." },
      };
    }
  }

  redirect(`/objectives/${id}`);
}

async function setArchived(id: string, archived: boolean): Promise<FormState> {
  await requireUser();
  const supabase = createClient(await cookies());
  if (!archived) {
    const { data: objective } = await supabase
      .from("objectives")
      .select("activity_type, weekdays")
      .eq("id", id)
      .maybeSingle();
    const conflict = objective && (await findActivityConflict(supabase, objective, id).catch(() => null));
    if (conflict) return { error: `Não dá para desarquivar: ${conflict} Mude os dias antes.` };
  }
  const { error } = await supabase
    .from("objectives")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar o objetivo. Tente de novo." };
  redirect(`/objectives/${id}`);
}

export async function archiveObjective(id: string): Promise<FormState> {
  return setArchived(id, true);
}

export async function unarchiveObjective(id: string): Promise<FormState> {
  return setArchived(id, false);
}

export async function deleteObjective(id: string): Promise<FormState> {
  await requireUser();
  const supabase = createClient(await cookies());

  // RN-05: objectives with history are archived, never deleted (the FK would cascade the checks).
  const { count, error: countError } = await supabase
    .from("objective_checks")
    .select("id", { count: "exact", head: true })
    .eq("objective_id", id);
  if (countError) return { error: "Não foi possível excluir o objetivo. Tente de novo." };
  if (count) {
    return { error: "Esse objetivo já tem histórico. Arquive em vez de excluir." };
  }

  try {
    const blocking = await findGoalsOnlyFedBy(
      supabase,
      id,
      await getLinkedGoalIds(supabase, id),
    );
    if (blocking.length > 0) {
      return {
        error: `Esse é o único objetivo ${joinTitles(blocking)}. Vincule outro antes de excluir.`,
      };
    }
  } catch (error) {
    console.error("Failed to load objective goals", error);
    return { error: "Não foi possível excluir o objetivo. Tente de novo." };
  }

  const { error } = await supabase.from("objectives").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o objetivo. Tente de novo." };

  redirect("/objectives");
}
