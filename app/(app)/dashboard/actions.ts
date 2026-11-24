"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isWithinBackfill } from "@/app/utils/checks";
import { getUserToday, isDay } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone, isScheduledOn } from "./day-objectives";

export type CheckFailure = "out-of-window" | "not-scheduled" | "failed";
export type SetCheckResult = { ok: true } | { ok: false; reason: CheckFailure };

const UNIQUE_VIOLATION = "23505";

// Takes the target state instead of flipping, so a retry or double tap never undoes the user's intent.
export async function setCheck(
  objectiveId: string,
  day: string,
  checked: boolean,
): Promise<SetCheckResult> {
  const user = await requireUser();
  const supabase = createClient(await cookies());

  const today = getUserToday(await getUserTimezone(supabase, user.id));
  if (!isDay(day) || !isWithinBackfill(day, today)) {
    return { ok: false, reason: "out-of-window" };
  }

  const { data: objective } = await supabase
    .from("objectives")
    .select("weekdays, archived_at")
    .eq("id", objectiveId)
    .maybeSingle();
  if (!objective || objective.archived_at || !isScheduledOn(objective, day)) {
    return { ok: false, reason: "not-scheduled" };
  }

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

  revalidatePath("/dashboard");
  revalidatePath(`/objectives/${objectiveId}`);
  return { ok: true };
}
