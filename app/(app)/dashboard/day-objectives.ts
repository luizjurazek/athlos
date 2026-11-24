import { getBackfillStart } from "@/app/utils/checks";
import { addDays, DEFAULT_TIMEZONE, getUserToday, getWeekday } from "@/app/utils/dates";
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

function existedOn(objective: Pick<Objective, "created_at">, day: string, timezone: string) {
  return getUserToday(timezone, new Date(objective.created_at)) <= day;
}

export async function getObjectivesForDay(
  supabase: Client,
  day: string,
  timezone: string,
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
    .filter((objective) => isScheduledOn(objective, day) && existedOn(objective, day, timezone))
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

export type StripDay = { day: string; scheduled: number; done: number };

export async function getDayStrip(
  supabase: Client,
  today: string,
  timezone: string,
  active: Pick<Objective, "id" | "weekdays" | "created_at">[],
): Promise<StripDay[]> {
  const from = getBackfillStart(today);
  const { data, error } = await supabase
    .from("objective_checks")
    .select("objective_id, day")
    .gte("day", from)
    .lte("day", today);
  if (error) throw error;

  const days: StripDay[] = [];
  for (let day = from; day <= today; day = addDays(day, 1)) {
    const scheduled = active.filter(
      (objective) => isScheduledOn(objective, day) && existedOn(objective, day, timezone),
    );
    const ids = new Set(scheduled.map((objective) => objective.id));
    const done = data.filter((check) => check.day === day && ids.has(check.objective_id)).length;
    days.push({ day, scheduled: scheduled.length, done });
  }
  return days;
}
