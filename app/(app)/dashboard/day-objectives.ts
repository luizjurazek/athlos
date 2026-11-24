import { DEFAULT_TIMEZONE, getWeekday } from "@/app/utils/dates";
import type { createClient } from "@/app/utils/supabase/server";
import type { Objective } from "../objectives/options";

type Client = ReturnType<typeof createClient>;

export type DayObjective = Pick<
  Objective,
  "id" | "title" | "color" | "icon" | "weekdays"
> & {
  checked: boolean;
};

export type ObjectivesForDay = {
  scheduled: DayObjective[];
  active: Objective[];
};

export async function getUserTimezone(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

export function isScheduledOn(
  objective: Pick<Objective, "weekdays">,
  day: string,
) {
  return objective.weekdays.includes(getWeekday(day));
}

export async function getObjectivesForDay(
  supabase: Client,
  day: string,
): Promise<ObjectivesForDay> {
  const [objectivesResult, checksResult] = await Promise.all([
    supabase
      .from("objectives")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("objective_checks").select("objective_id").eq("day", day),
  ]);

  if (objectivesResult.error) throw objectivesResult.error;
  if (checksResult.error) throw checksResult.error;

  const checkedIds = new Set(
    checksResult.data.map((check) => check.objective_id),
  );
  const active = objectivesResult.data;
  const scheduled = active
    .filter((objective) => isScheduledOn(objective, day))
    .map(({ id, title, color, icon, weekdays }) => ({
      id,
      title,
      color,
      icon,
      weekdays,
      checked: checkedIds.has(id),
    }));

  return { scheduled, active };
}
