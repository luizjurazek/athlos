import { getBackfillStart } from "@/app/utils/checks";
import { addDays, DEFAULT_TIMEZONE, getUserToday, getWeekday } from "@/app/utils/dates";
import {
  getOccurrence,
  RESCHEDULE_DAYS_AHEAD,
  type Addition,
  type DayChanges,
  type Reschedule,
} from "@/app/utils/occurrences";
import type { createClient } from "@/app/utils/supabase/server";
import { findSameActivityOnDay } from "@/app/utils/workouts";
import type { Objective } from "../objectives/options";

type Client = ReturnType<typeof createClient>;

export const STRIP_DAYS_AHEAD = 7;

export type DayObjective = Pick<
  Objective,
  "id" | "title" | "color" | "icon" | "weekdays" | "reschedulable" | "activity_type"
> & {
  checked: boolean;
  reschedule: Reschedule | null;
  addition: Addition | null;
  /** Title of the objective this addition took the place of (RN-22). */
  replacedTitle: string | null;
  alternatives: string[];
};

/** Days the objective cannot receive a reschedule on (RN-14, RN-24), within the picker range. */
export type BlockedDays = {
  occurrence: string[];
  checked: string[];
  replaced: string[];
  /** RN-33: days another objective of the same activity type already occurs on. */
  sameActivity: { day: string; title: string }[];
};

export type PendingItem = { objective: DayObjective; day: string };

export type StripDay = { day: string; scheduled: number; done: number };

/** Why an objective cannot be added to a day (RN-23, RN-24); null when it can. */
export type DayConflict = "due" | "checked" | "moved" | "replaced" | "same-activity" | null;

export type DayOption = Pick<Objective, "id" | "title" | "color" | "icon" | "activity_type"> & {
  conflict: DayConflict;
  /** RN-33: objectives of the same activity type already on the day. */
  sameActivity: { id: string; title: string }[];
};

/** The option's conflict in a sheet; in a swap the objective leaving the day does not count (RN-33). */
export function getOptionConflict(option: DayOption, replacedId: string | null): DayConflict {
  if (option.conflict) return option.conflict;
  return option.sameActivity.some((other) => other.id !== replacedId) ? "same-activity" : null;
}

export type LeftRoutine =
  | { kind: "moved"; title: string; toDay: string }
  | { kind: "replaced"; title: string; byTitle: string | null };

export type DayData = {
  active: Objective[];
  scheduled: DayObjective[];
  leftRoutine: LeftRoutine[];
  dayOptions: DayOption[];
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

/** Reschedules and additions touching [from, to]; with `objectiveId`, only those that affect it. */
export async function getDayChanges(
  supabase: Client,
  from: string,
  to: string,
  objectiveId?: string,
): Promise<DayChanges> {
  let reschedulesQuery = supabase
    .from("objective_reschedules")
    .select("id, objective_id, from_day, to_day")
    .or(`and(from_day.gte.${from},from_day.lte.${to}),and(to_day.gte.${from},to_day.lte.${to})`);
  let additionsQuery = supabase
    .from("objective_additions")
    .select("id, objective_id, day, replaced_objective_id")
    .gte("day", from)
    .lte("day", to);
  if (objectiveId) {
    reschedulesQuery = reschedulesQuery.eq("objective_id", objectiveId);
    additionsQuery = additionsQuery.or(
      `objective_id.eq.${objectiveId},replaced_objective_id.eq.${objectiveId}`,
    );
  }
  const [reschedules, additions] = await Promise.all([reschedulesQuery, additionsQuery]);
  if (reschedules.error) throw reschedules.error;
  if (additions.error) throw additions.error;
  return {
    reschedules: reschedules.data.map((row) => ({
      id: row.id,
      objectiveId: row.objective_id,
      fromDay: row.from_day,
      toDay: row.to_day,
    })),
    additions: additions.data.map((row) => ({
      id: row.id,
      objectiveId: row.objective_id,
      day: row.day,
      replacedObjectiveId: row.replaced_objective_id,
    })),
  };
}

/** RN-23/RN-24: the same objective never shows up twice on a day, nor comes back on a day it left. */
export function getDayConflict(
  objective: { id: string; weekdays: number[]; createdDay?: string },
  day: string,
  changes: DayChanges,
  checked: boolean,
): DayConflict {
  const occurrence = getOccurrence(objective, day, changes);
  if (occurrence.due) return "due";
  if (occurrence.movedTo) return "moved";
  if (occurrence.replacedBy) return "replaced";
  return checked ? "checked" : null;
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

  const [objectivesResult, checksResult, alternativesResult, changes] = await Promise.all([
    supabase
      .from("objectives")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("objective_checks").select("objective_id, day").gte("day", from).lte("day", to),
    supabase.from("objective_alternatives").select("objective_id, alternative_id"),
    getDayChanges(supabase, from, to),
  ]);
  if (objectivesResult.error) throw objectivesResult.error;
  if (checksResult.error) throw checksResult.error;
  if (alternativesResult.error) throw alternativesResult.error;

  const active = objectivesResult.data;
  const titleOf = (id: string | null) => active.find((objective) => objective.id === id)?.title ?? null;
  const checked = new Set(checksResult.data.map((check) => `${check.objective_id}:${check.day}`));
  const withCreated = active.map((objective) => ({
    ...objective,
    createdDay: getUserToday(timezone, new Date(objective.created_at)),
    alternatives: alternativesResult.data
      .filter((link) => link.objective_id === objective.id && titleOf(link.alternative_id))
      .map((link) => link.alternative_id),
  }));

  const itemsFor = (target: string): DayObjective[] =>
    withCreated.flatMap((objective) => {
      const occurrence = getOccurrence(objective, target, changes);
      if (!occurrence.due) return [];
      return [
        {
          id: objective.id,
          title: objective.title,
          color: objective.color,
          icon: objective.icon,
          weekdays: objective.weekdays,
          reschedulable: objective.reschedulable,
          activity_type: objective.activity_type,
          checked: checked.has(`${objective.id}:${target}`),
          reschedule: occurrence.reschedule,
          addition: occurrence.addition,
          replacedTitle: titleOf(occurrence.addition?.replacedObjectiveId ?? null),
          alternatives: objective.alternatives,
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
      if (item.reschedulable && !item.checked && !item.reschedule && !item.addition) {
        pending.push({ objective: item, day: current });
      }
    }
  }

  const blocked: Record<string, BlockedDays> = {};
  for (const objective of withCreated.filter((item) => item.reschedulable)) {
    const days: BlockedDays = { occurrence: [], checked: [], replaced: [], sameActivity: [] };
    for (let current = pickerRange.from; current <= pickerRange.to; current = addDays(current, 1)) {
      const occurrence = getOccurrence(objective, current, changes);
      if (occurrence.due) days.occurrence.push(current);
      else if (occurrence.replacedBy) days.replaced.push(current);
      else if (checked.has(`${objective.id}:${current}`)) days.checked.push(current);
      else {
        const other = findSameActivityOnDay(objective, current, withCreated, changes);
        if (other) days.sameActivity.push({ day: current, title: other.title });
      }
    }
    blocked[objective.id] = days;
  }

  const leftRoutine = withCreated.flatMap((objective): LeftRoutine[] => {
    const occurrence = getOccurrence(objective, day, changes);
    if (occurrence.movedTo) {
      return [{ kind: "moved", title: objective.title, toDay: occurrence.movedTo.toDay }];
    }
    if (occurrence.replacedBy) {
      return [
        { kind: "replaced", title: objective.title, byTitle: titleOf(occurrence.replacedBy.objectiveId) },
      ];
    }
    return [];
  });

  const dayOptions = withCreated.map((objective) => ({
    id: objective.id,
    title: objective.title,
    color: objective.color,
    icon: objective.icon,
    activity_type: objective.activity_type,
    conflict: getDayConflict(objective, day, changes, checked.has(`${objective.id}:${day}`)),
    sameActivity: objective.activity_type
      ? withCreated
          .filter(
            (other) =>
              other.id !== objective.id &&
              other.activity_type === objective.activity_type &&
              getOccurrence(other, day, changes).due,
          )
          .map((other) => ({ id: other.id, title: other.title }))
      : [],
  }));

  return {
    active,
    scheduled: itemsFor(day),
    leftRoutine,
    dayOptions,
    strip,
    pending,
    blocked,
    pickerRange,
  };
}
