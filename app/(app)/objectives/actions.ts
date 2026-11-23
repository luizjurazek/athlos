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
  const { error } = await supabase.from("objectives").insert(parsed.input);
  if (error) return { error: "Não foi possível salvar o objetivo. Tente de novo." };

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

  // Changing weekdays never touches past checks: they stay tied to their own day.
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("objectives")
    .update(parsed.input)
    .eq("id", id)
    .select("id");
  if (error) return { error: "Não foi possível salvar o objetivo. Tente de novo." };
  // RLS hides other users' rows, so an empty result means "not yours" or "gone".
  if (data.length === 0) return { error: "Objetivo não encontrado." };

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

  const { error } = await supabase.from("objectives").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o objetivo. Tente de novo." };

  redirect("/objectives");
}
