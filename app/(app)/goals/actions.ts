"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserToday, isDay } from "@/app/utils/dates";
import { getStageStatuses, hasStarted } from "@/app/utils/goals";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../dashboard/day-objectives";
import {
  getGoal,
  type Goal,
  type GoalStage,
} from "./data";
import {
  countErrors,
  ENTRY_AMOUNT_MAX,
  ENTRY_NOTE_MAX_LENGTH,
  getObjectiveTargets,
  parseTarget,
  validateGoal,
  type GoalDraft,
  type GoalErrors,
  type StageDraft,
} from "./validation";

export type GoalFormState = { error?: string; errors?: GoalErrors } | undefined;

function readStrings(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => (typeof value === "string" ? value : ""));
}

function readDraft(formData: FormData): GoalDraft {
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const titles = readStrings(formData, "stage_title");
  const targets = readStrings(formData, "stage_target");
  const dueDates = readStrings(formData, "stage_due");
  const objectiveIds = [...new Set(readStrings(formData, "objective_ids").filter(Boolean))];
  return {
    title: read("title"),
    description: read("description"),
    unitLabel: read("unit_label"),
    startsOn: read("starts_on"),
    progressSource: read("progress_source") === "entries" ? "entries" : "checks",
    stages: titles.map((title, index) => ({
      title,
      target: targets[index] ?? "",
      dueOn: dueDates[index] ?? "",
      mode: read(`stage_${index}_mode`) === "per-objective" ? "per-objective" : "total",
      targets: Object.fromEntries(
        objectiveIds.map((id) => [id, read(`stage_${index}_target_${id}`)]),
      ),
    })),
    objectiveIds,
  };
}

const SAVE_ERROR = "Não foi possível salvar a meta. Tente de novo.";

export async function saveGoal(
  goalId: string | null,
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  await requireUser();
  const draft = readDraft(formData);
  const errors = validateGoal(draft);
  if (countErrors(errors) > 0) return { errors };

  const supabase = createClient(await cookies());

  if (goalId) {
    const current = await getGoal(supabase, goalId).catch(() => null);
    if (!current) return { error: "Meta não encontrada." };
    const lockedError = checkCompletedStages(current, draft);
    if (lockedError) return { error: lockedError };
    if (
      current.progressSource !== draft.progressSource &&
      current.stages.some((stage) => stage.completed)
    ) {
      return { error: "A forma de medir não pode mudar depois que uma etapa foi concluída." };
    }
  }

  const { data: savedId, error } = await supabase.rpc("save_goal", {
    goal: {
      ...(goalId ? { id: goalId } : {}),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      unit_label: draft.unitLabel.trim() || null,
      starts_on: draft.startsOn,
      progress_source: draft.progressSource,
    },
    stages: draft.stages.map((stage) => {
      const targets =
        draft.progressSource === "checks" ? stageTargets(stage, draft.objectiveIds) : null;
      return {
        title: stage.title.trim() || null,
        target_count: targets
          ? targets.reduce((total, target) => total + target.targetCount, 0)
          : parseTarget(stage.target),
        due_on: stage.dueOn,
        targets: (targets ?? []).map((target) => ({
          objective_id: target.objectiveId,
          target_count: target.targetCount,
        })),
      };
    }),
    objective_ids: draft.objectiveIds,
  });

  if (error) {
    console.error("Failed to save goal", error);
    if (error.code === "23503") {
      return { error: "Um dos objetivos escolhidos não está mais disponível. Atualize a página." };
    }
    if (error.code === "P0002") return { error: "Meta não encontrada." };
    return { error: SAVE_ERROR };
  }

  redirect(`/goals/${savedId}`);
}

function stageTargets(stage: StageDraft, objectiveIds: string[]) {
  return stage.mode === "per-objective" ? getObjectiveTargets(stage, objectiveIds) : null;
}

function sameTargets(goal: Goal, stage: GoalStage, submitted: StageDraft, objectiveIds: string[]) {
  const targets = goal.progressSource === "checks" ? stageTargets(submitted, objectiveIds) : null;
  if (!stage.objectiveTargets) return !targets && parseTarget(submitted.target) === stage.targetCount;
  if (!targets || targets.length !== stage.objectiveTargets.length) return false;
  return stage.objectiveTargets.every((saved) =>
    targets.some(
      (target) =>
        target.objectiveId === saved.objectiveId && target.targetCount === saved.targetCount,
    ),
  );
}

// Stages that already reached their target are frozen (doubt 2.1): same position, title, target
// and deadline, and the goal start cannot move while the first stage is one of them.
function checkCompletedStages(current: Goal, draft: GoalDraft) {
  for (const stage of current.stages) {
    if (!stage.completed) continue;
    const submitted = draft.stages[stage.position - 1];
    const unchanged =
      submitted &&
      (submitted.title.trim() || null) === stage.title &&
      sameTargets(current, stage, submitted, draft.objectiveIds) &&
      submitted.dueOn === stage.dueOn;
    if (!unchanged) {
      return `A etapa ${stage.position} já foi concluída e não pode ser alterada.`;
    }
    if (stage.position === 1 && draft.startsOn !== current.startsOn) {
      return "A primeira etapa já foi concluída, então o início da meta não pode mudar.";
    }
  }
  return null;
}

export async function abandonGoal(goalId: string): Promise<GoalFormState> {
  await requireUser();
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("goals")
    .update({ status: "abandoned" })
    .eq("id", goalId)
    .eq("status", "active");
  if (error) {
    console.error("Failed to abandon goal", error);
    return { error: "Não foi possível abandonar a meta. Tente de novo." };
  }
  redirect("/goals");
}

async function loadGoalForUpdate(goalId: string) {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [goal, timezone] = await Promise.all([
    getGoal(supabase, goalId).catch(() => null),
    getUserTimezone(supabase, user.id),
  ]);
  return { supabase, goal, today: getUserToday(timezone) };
}

function getStartedCurrentStage(goal: Goal, today: string) {
  const statuses = getStageStatuses(goal.stages, today);
  const current = goal.stages[statuses.indexOf("current")];
  return current && hasStarted(current, today) ? current : null;
}

const UPDATE_ERROR = "Não foi possível atualizar a meta. Tente de novo.";

/** Closes the whole goal by hand; the stage in progress is closed with it. */
export async function completeGoal(goalId: string): Promise<GoalFormState> {
  const { supabase, goal, today } = await loadGoalForUpdate(goalId);
  if (!goal || goal.status !== "active") return { error: "Esta meta não está ativa." };

  const stage = getStartedCurrentStage(goal, today);
  if (stage) {
    const { error } = await supabase
      .from("goal_stages")
      .update({ completed_manually_on: today, completed_at: new Date().toISOString() })
      .eq("id", stage.id);
    if (error) {
      console.error("Failed to complete stage", error);
      return { error: UPDATE_ERROR };
    }
  }
  const { error } = await supabase
    .from("goals")
    .update({ completed_manually_on: today, status: "completed" })
    .eq("id", goalId);
  if (error) {
    console.error("Failed to complete goal", error);
    return { error: UPDATE_ERROR };
  }
  redirect(`/goals/${goalId}`);
}

export async function reopenGoal(goalId: string): Promise<GoalFormState> {
  const { supabase, goal, today } = await loadGoalForUpdate(goalId);
  if (!goal?.completedManuallyOn || goal.dueOn < today) {
    return { error: "Esta meta não pode mais ser reaberta." };
  }
  // The stored status is recomputed from the stages on the next read.
  const { error } = await supabase
    .from("goals")
    .update({ completed_manually_on: null, status: "active" })
    .eq("id", goalId);
  if (error) {
    console.error("Failed to reopen goal", error);
    return { error: UPDATE_ERROR };
  }
  redirect(`/goals/${goalId}`);
}

type EntryInput = { day: string; amount: number; note: string | null };

function readEntry(formData: FormData): EntryInput | { error: string } {
  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const amount = Number(read("amount") || "1");
  if (!Number.isInteger(amount) || amount < 1 || amount > ENTRY_AMOUNT_MAX) {
    return { error: `A quantidade precisa ser um número inteiro de 1 a ${ENTRY_AMOUNT_MAX}.` };
  }
  const note = read("note");
  if (note.length > ENTRY_NOTE_MAX_LENGTH) {
    return { error: `A nota pode ter no máximo ${ENTRY_NOTE_MAX_LENGTH} caracteres.` };
  }
  return { day: read("day"), amount, note: note || null };
}

function checkEntry(goal: Goal | null, entry: EntryInput, today: string) {
  if (!goal || goal.progressSource !== "entries" || goal.status !== "active") {
    return { error: "Esta meta não aceita registros agora." };
  }
  if (!isDay(entry.day) || entry.day > today) return { error: "Escolha um dia até hoje." };
  if (entry.day < goal.startsOn) return { error: "O dia precisa ser depois do início da meta." };
  return null;
}

async function insertEntry(goalId: string, input: Omit<EntryInput, "day"> & { day?: string }) {
  const { supabase, goal, today } = await loadGoalForUpdate(goalId);
  const entry = { ...input, day: input.day || today };
  const invalid = checkEntry(goal, entry, today);
  if (invalid) return invalid;

  const { error } = await supabase.from("goal_entries").insert({ goal_id: goalId, ...entry });
  if (error) {
    console.error("Failed to add goal entry", error);
    return { error: "Não foi possível registrar. Tente de novo." };
  }
  return null;
}

export async function addGoalEntry(
  goalId: string,
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const entry = readEntry(formData);
  if ("error" in entry) return entry;
  const failure = await insertEntry(goalId, entry);
  if (failure) return failure;
  redirect(`/goals/${goalId}`);
}

/** +1 for today, from the goals summary on Hoje. */
export async function quickAddGoalEntry(goalId: string): Promise<GoalFormState> {
  const failure = await insertEntry(goalId, { amount: 1, note: null });
  if (failure) return failure;
  revalidatePath("/dashboard");
  return undefined;
}

export async function updateGoalEntry(
  goalId: string,
  entryId: string,
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const entry = readEntry(formData);
  if ("error" in entry) return entry;
  const { supabase, goal, today } = await loadGoalForUpdate(goalId);
  const invalid = checkEntry(goal, entry, today);
  if (invalid) return invalid;

  const { error } = await supabase
    .from("goal_entries")
    .update(entry)
    .eq("id", entryId)
    .eq("goal_id", goalId);
  if (error) {
    console.error("Failed to update goal entry", error);
    return { error: "Não foi possível salvar o registro. Tente de novo." };
  }
  redirect(`/goals/${goalId}`);
}

export async function deleteGoalEntry(goalId: string, entryId: string): Promise<GoalFormState> {
  const { supabase } = await loadGoalForUpdate(goalId);
  const { error } = await supabase
    .from("goal_entries")
    .delete()
    .eq("id", entryId)
    .eq("goal_id", goalId);
  if (error) {
    console.error("Failed to delete goal entry", error);
    return { error: "Não foi possível remover o registro. Tente de novo." };
  }
  redirect(`/goals/${goalId}`);
}
