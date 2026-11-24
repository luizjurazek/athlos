"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CHECK_BACKFILL_DAYS, getBackfillStart, isWithinBackfill } from "@/app/utils/checks";
import { getUserToday, isDay } from "@/app/utils/dates";
import { getOccurrence, isDueOn } from "@/app/utils/occurrences";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getDayChanges, getDayConflict, getUserTimezone } from "./day-objectives";

export type CheckFailure = "out-of-window" | "not-scheduled" | "failed";
export type SetCheckResult = { ok: true } | { ok: false; reason: CheckFailure };
export type RescheduleResult = { ok: true } | { ok: false; error: string };
export type AdditionResult = RescheduleResult;

const UNIQUE_VIOLATION = "23505";

async function loadContext(objectiveId: string) {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [timezone, objectiveResult] = await Promise.all([
    getUserTimezone(supabase, user.id),
    supabase
      .from("objectives")
      .select("id, title, weekdays, archived_at, reschedulable, created_at")
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
  const { supabase, today, objective } = await loadContext(objectiveId);
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
