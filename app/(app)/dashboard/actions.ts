"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CHECK_BACKFILL_DAYS, getBackfillStart, isWithinBackfill } from "@/app/utils/checks";
import { getUserToday, isDay } from "@/app/utils/dates";
import { getOccurrence, isDueOn } from "@/app/utils/occurrences";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getReschedules, getUserTimezone } from "./day-objectives";

export type CheckFailure = "out-of-window" | "not-scheduled" | "failed";
export type SetCheckResult = { ok: true } | { ok: false; reason: CheckFailure };
export type RescheduleResult = { ok: true } | { ok: false; error: string };

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

  const reschedules = await getReschedules(supabase, day, day, objectiveId);
  if (!isDueOn(objective, day, reschedules)) return { ok: false, reason: "not-scheduled" };

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
  const [reschedules, checksResult] = await Promise.all([
    getReschedules(supabase, first, last, objectiveId),
    supabase
      .from("objective_checks")
      .select("day")
      .eq("objective_id", objectiveId)
      .in("day", [fromDay, toDay]),
  ]);
  if (checksResult.error) return { ok: false, error: "Não deu para mudar o dia. Tente de novo." };
  const checkedDays = new Set(checksResult.data.map((check) => check.day));

  const origin = getOccurrence(objective, fromDay, reschedules);
  if (!origin.due || origin.reschedule) {
    return { ok: false, error: `${objective.title} não está programado nesse dia.` };
  }
  if (checkedDays.has(fromDay)) {
    return { ok: false, error: "Esse dia já tem check. Desmarque antes de mudar." };
  }
  if (isDueOn(objective, toDay, reschedules)) {
    return { ok: false, error: `Já tem ${objective.title} neste dia.` };
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
