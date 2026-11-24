"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { normalizeWeekdays } from "@/app/utils/weekdays";
import {
  isObjectiveColor,
  isObjectiveIcon,
  TITLE_MAX_LENGTH,
} from "./options";

export type FormState = { error?: string } | undefined;

type Client = ReturnType<typeof createClient>;

function parseGoalIds(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll("goal_ids")
        .filter((value): value is string => typeof value === "string" && value !== ""),
    ),
  ];
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

// RN-18: a goal can never lose its last objective.
async function findGoalsOnlyFedBy(supabase: Client, objectiveId: string, goalIds: string[]) {
  if (goalIds.length === 0) return [];
  const { data, error } = await supabase
    .from("goal_objectives")
    .select("goal_id, objective_id, goals ( title )")
    .in("goal_id", goalIds);
  if (error) throw error;
  return goalIds.flatMap((goalId) => {
    const links = data.filter((link) => link.goal_id === goalId);
    const onlyThis = links.every((link) => link.objective_id === objectiveId);
    const title = links[0]?.goals?.title;
    return onlyThis && title ? [title] : [];
  });
}

type ObjectiveInput = {
  title: string;
  color: string | null;
  icon: string | null;
  weekdays: number[];
  reschedulable: boolean;
};

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
    },
  };
}

export async function createObjective(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = parseObjective(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("objectives")
    .insert(parsed.input)
    .select("id")
    .single();
  if (error) return { error: "Não foi possível salvar o objetivo. Tente de novo." };

  const goalIds = parseGoalIds(formData);
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

  redirect("/objectives");
}

export async function updateObjective(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = parseObjective(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = createClient(await cookies());
  const goalIds = parseGoalIds(formData);
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

  redirect("/objectives");
}

async function setArchived(id: string, archived: boolean) {
  await requireUser();
  const supabase = createClient(await cookies());
  await supabase
    .from("objectives")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  redirect("/objectives");
}

export async function archiveObjective(id: string) {
  await setArchived(id, true);
}

export async function unarchiveObjective(id: string) {
  await setArchived(id, false);
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
