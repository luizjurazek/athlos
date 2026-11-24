import { getBackfillStart } from "@/app/utils/checks";
import { addDays, DEFAULT_TIMEZONE, getUserToday, getWeekday } from "@/app/utils/dates";
import { getOccurrence, RESCHEDULE_DAYS_AHEAD, type Reschedule } from "@/app/utils/occurrences";
import type { createClient } from "@/app/utils/supabase/server";
import type { Objective } from "../objectives/options";

type Client = ReturnType<typeof createClient>;

export const STRIP_DAYS_AHEAD = 7;

export type DayObjective = Pick<
  Objective,
  "id" | "title" | "color" | "icon" | "weekdays" | "reschedulable"
> & {
  checked: boolean;
  reschedule: Reschedule | null;
};

/** Days the objective cannot receive a reschedule on (RN-14), within the picker range. */
export type BlockedDays = { occurrence: string[]; checked: string[] };

export type PendingItem = { objective: DayObjective; day: string };

export type StripDay = { day: string; scheduled: number; done: number };

export type DayData = {
  active: Objective[];
  scheduled: DayObjective[];
  movedAway: { title: string; toDay: string }[];
  strip: StripDay[];
  pending: PendingItem[];
  blocked: Record<string, BlockedDays>;
  pickerRange: { from: string; to: string };
};

export async function getUserTimezone(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

export function isScheduledOn(objective: Pick<Objective, "weekdays">, day: string) {
  return objective.weekdays.includes(getWeekday(day));
}

export async function getReschedules(
  supabase: Client,
  from: string,
  to: string,
  objectiveId?: string,
): Promise<Reschedule[]> {
  let query = supabase
    .from("objective_reschedules")
    .select("id, objective_id, from_day, to_day")
    .or(`and(from_day.gte.${from},from_day.lte.${to}),and(to_day.gte.${from},to_day.lte.${to})`);
  if (objectiveId) query = query.eq("objective_id", objectiveId);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    objectiveId: row.objective_id,
    fromDay: row.from_day,
    toDay: row.to_day,
  }));
}

/** Picker weeks start on the Sunday before the backfill window and end on the Saturday after the look-ahead. */
export function getPickerRange(today: string) {
  const start = getBackfillStart(today);
  const end = addDays(today, RESCHEDULE_DAYS_AHEAD);
  return { from: addDays(start, -getWeekday(start)), to: addDays(end, 6 - getWeekday(end)) };
}

export async function getDayData(
  supabase: Client,
  { day, today, timezone }: { day: string; today: string; timezone: string },
): Promise<DayData> {
  const pickerRange = getPickerRange(today);
  const from = pickerRange.from < day ? pickerRange.from : day;
  const to = pickerRange.to > day ? pickerRange.to : day;

  const [objectivesResult, checksResult, reschedules] = await Promise.all([
    supabase
      .from("objectives")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("objective_checks").select("objective_id, day").gte("day", from).lte("day", to),
    getReschedules(supabase, from, to),
  ]);
  if (objectivesResult.error) throw objectivesResult.error;
  if (checksResult.error) throw checksResult.error;

  const active = objectivesResult.data;
  const checked = new Set(checksResult.data.map((check) => `${check.objective_id}:${check.day}`));
  const withCreated = active.map((objective) => ({
    ...objective,
    createdDay: getUserToday(timezone, new Date(objective.created_at)),
  }));

  const itemsFor = (target: string): DayObjective[] =>
    withCreated.flatMap((objective) => {
      const occurrence = getOccurrence(objective, target, reschedules);
      if (!occurrence.due) return [];
      return [
        {
          id: objective.id,
          title: objective.title,
          color: objective.color,
          icon: objective.icon,
          weekdays: objective.weekdays,
          reschedulable: objective.reschedulable,
          checked: checked.has(`${objective.id}:${target}`),
          reschedule: occurrence.reschedule,
        },
      ];
    });

  const strip: StripDay[] = [];
  for (let current = getBackfillStart(today); current <= addDays(today, STRIP_DAYS_AHEAD); current = addDays(current, 1)) {
    const items = itemsFor(current);
    strip.push({
      day: current,
      scheduled: items.length,
      done: items.filter((item) => item.checked).length,
    });
  }

  const pending: PendingItem[] = [];
  for (let current = addDays(today, -1); current >= getBackfillStart(today); current = addDays(current, -1)) {
    for (const item of itemsFor(current)) {
      if (item.reschedulable && !item.checked && !item.reschedule) {
        pending.push({ objective: item, day: current });
      }
    }
  }

  const blocked: Record<string, BlockedDays> = {};
  for (const objective of withCreated.filter((item) => item.reschedulable)) {
    const days: BlockedDays = { occurrence: [], checked: [] };
    for (let current = pickerRange.from; current <= pickerRange.to; current = addDays(current, 1)) {
      if (getOccurrence(objective, current, reschedules).due) days.occurrence.push(current);
      else if (checked.has(`${objective.id}:${current}`)) days.checked.push(current);
    }
    blocked[objective.id] = days;
  }

  const movedAway = reschedules.flatMap((item) => {
    const objective = active.find((candidate) => candidate.id === item.objectiveId);
    return item.fromDay === day && objective ? [{ title: objective.title, toDay: item.toDay }] : [];
  });

  return { active, scheduled: itemsFor(day), movedAway, strip, pending, blocked, pickerRange };
}
