"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserToday } from "@/app/utils/dates";
import { getStageStatuses, hasStarted } from "@/app/utils/goals";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../dashboard/day-objectives";
import { getGoal, getReopenableStage, type Goal, type GoalStage } from "./data";
import {
  countErrors,
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
  }

  const { data: savedId, error } = await supabase.rpc("save_goal", {
    goal: {
      ...(goalId ? { id: goalId } : {}),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      unit_label: draft.unitLabel.trim() || null,
      starts_on: draft.startsOn,
    },
    stages: draft.stages.map((stage) => {
      const targets = stageTargets(stage, draft.objectiveIds);
      return {
        title: stage.title.trim(),
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

function sameTargets(stage: GoalStage, submitted: StageDraft, objectiveIds: string[]) {
  const targets = stageTargets(submitted, objectiveIds);
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
      submitted.title.trim() === stage.title &&
      sameTargets(stage, submitted, draft.objectiveIds) &&
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

/** Closes the current stage by hand, even short of its target (the next one starts tomorrow). */
export async function completeStage(goalId: string): Promise<GoalFormState> {
  const { supabase, goal, today } = await loadGoalForUpdate(goalId);
  if (!goal || goal.status !== "active") return { error: "Esta meta não está ativa." };
  const stage = getStartedCurrentStage(goal, today);
  if (!stage) return { error: "Nenhuma etapa em andamento para concluir." };

  const { error } = await supabase
    .from("goal_stages")
    .update({ completed_manually_on: today, completed_at: new Date().toISOString() })
    .eq("id", stage.id);
  if (error) {
    console.error("Failed to complete stage", error);
    return { error: UPDATE_ERROR };
  }
  redirect(`/goals/${goalId}`);
}

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

export async function reopenStage(goalId: string): Promise<GoalFormState> {
  const { supabase, goal, today } = await loadGoalForUpdate(goalId);
  const stage = goal ? getReopenableStage(goal, today) : null;
  if (!stage) return { error: "Esta etapa não pode mais ser reaberta." };

  const { error } = await supabase
    .from("goal_stages")
    .update({ completed_manually_on: null, completed_at: null })
    .eq("id", stage.id);
  if (error) {
    console.error("Failed to reopen stage", error);
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
