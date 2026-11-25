import { getUserToday } from "@/app/utils/dates";
import { getRoutineChanges } from "@/app/utils/occurrences";
import { getCurrentStreak } from "@/app/utils/streak";
import type { createClient } from "@/app/utils/supabase/server";
import { getDayChanges } from "../dashboard/day-objectives";

type Client = ReturnType<typeof createClient>;

/** `withoutToday` lets the client add today's check optimistically on top of the stored streak. */
export type ObjectiveStreak = { current: number; withoutToday: number };

// PostgREST caps responses at 1000 rows; a longer streak is shown as 1000, which is fine here.
const CHECKS_LIMIT = 1000;

/**
 * Current streak (RN-11) of each objective, with reschedules and replacements handled like the
 * objective page: a moved or replaced day is not a miss, and its destination counts as scheduled.
 */
export async function getObjectiveStreaks(
  supabase: Client,
  objectives: { id: string; weekdays: number[]; created_at: string }[],
  today: string,
  timezone: string,
): Promise<Record<string, ObjectiveStreak>> {
  if (objectives.length === 0) return {};
  const createdDays = objectives.map((objective) =>
    getUserToday(timezone, new Date(objective.created_at)),
  );
  const checksResults = await Promise.all(
    objectives.map((objective) =>
      supabase
        .from("objective_checks")
        .select("day")
        .eq("objective_id", objective.id)
        .lte("day", today)
        .order("day", { ascending: false })
        .limit(CHECKS_LIMIT),
    ),
  );
  const oldest = [
    ...createdDays,
    ...checksResults.flatMap((result) => result.data?.map((check) => check.day) ?? []),
  ].reduce((min, day) => (day < min ? day : min), today);
  const changes = await getDayChanges(supabase, oldest, today);

  return Object.fromEntries(
    objectives.map((objective, index) => {
      const result = checksResults[index];
      if (result.error) throw result.error;
      const days = result.data.map((check) => check.day);
      const firstCheck = days.at(-1);
      const firstDay = firstCheck && firstCheck < createdDays[index] ? firstCheck : createdDays[index];
      const input = {
        weekdays: objective.weekdays,
        checkedDays: new Set(days),
        firstDay,
        today,
        ...getRoutineChanges(objective.id, changes),
      };
      const withoutTodayDays = new Set(days.filter((day) => day !== today));
      return [
        objective.id,
        {
          current: getCurrentStreak(input),
          withoutToday: getCurrentStreak({ ...input, checkedDays: withoutTodayDays }),
        },
      ];
    }),
  );
}
