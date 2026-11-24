"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getGoal } from "./data";
import { countErrors, parseTarget, validateGoal, type GoalDraft, type GoalErrors } from "./validation";

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
  return {
    title: read("title"),
    description: read("description"),
    unitLabel: read("unit_label"),
    startsOn: read("starts_on"),
    stages: titles.map((title, index) => ({
      title,
      target: targets[index] ?? "",
      dueOn: dueDates[index] ?? "",
    })),
    objectiveIds: [...new Set(readStrings(formData, "objective_ids").filter(Boolean))],
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

  const { error } = await supabase.rpc("save_goal", {
    goal: {
      ...(goalId ? { id: goalId } : {}),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      unit_label: draft.unitLabel.trim() || null,
      starts_on: draft.startsOn,
    },
    stages: draft.stages.map((stage) => ({
      title: stage.title.trim(),
      target_count: parseTarget(stage.target),
      due_on: stage.dueOn,
    })),
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

  redirect("/goals");
}

// Stages that already reached their target are frozen (doubt 2.1): same position, title, target
// and deadline, and the goal start cannot move while the first stage is one of them.
function checkCompletedStages(
  current: NonNullable<Awaited<ReturnType<typeof getGoal>>>,
  draft: GoalDraft,
) {
  for (const stage of current.stages) {
    if (!stage.completed) continue;
    const submitted = draft.stages[stage.position - 1];
    const unchanged =
      submitted &&
      submitted.title.trim() === stage.title &&
      parseTarget(submitted.target) === stage.targetCount &&
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
