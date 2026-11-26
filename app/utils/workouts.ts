import { getBackfillStart } from "./checks";
import { addDays, getWeekday } from "./dates";
import { getOccurrence, type DayChanges, type Occurrence } from "./occurrences";

/** RN-28: a day's workout can be swapped from the backfill window up to this many days ahead. */
export const WORKOUT_SWAP_DAYS_AHEAD = 14;

export type ScheduleRow = { weekday: number; workoutId: string };

export type DayWorkoutSource = "chosen" | "moved-schedule" | "schedule";

export type DayWorkout = {
  workoutId: string;
  source: DayWorkoutSource;
  /** Weekday whose schedule decided it (the origin day for a rescheduled occurrence). */
  weekday: number | null;
} | null;

/**
 * RN-28, the single rule for "which workout on this day": the explicit choice of the day
 * (activity_sessions.workout_id) → the schedule of the origin weekday when the occurrence was
 * rescheduled here → the schedule of the day's own weekday → none (Hoje asks).
 */
export function getWorkoutForDay(
  day: string,
  {
    schedule,
    sessionWorkoutId,
    occurrence,
  }: { schedule: ScheduleRow[]; sessionWorkoutId: string | null; occurrence: Pick<Occurrence, "reschedule"> },
): DayWorkout {
  if (sessionWorkoutId) return { workoutId: sessionWorkoutId, source: "chosen", weekday: null };
  if (occurrence.reschedule) {
    const weekday = getWeekday(occurrence.reschedule.fromDay);
    const row = schedule.find((item) => item.weekday === weekday);
    if (row) return { workoutId: row.workoutId, source: "moved-schedule", weekday };
  }
  const weekday = getWeekday(day);
  const row = schedule.find((item) => item.weekday === weekday);
  return row ? { workoutId: row.workoutId, source: "schedule", weekday } : null;
}

export function getWorkoutSwapWindow(today: string) {
  return { from: getBackfillStart(today), to: addDays(today, WORKOUT_SWAP_DAYS_AHEAD) };
}

export function isWithinWorkoutSwapWindow(day: string, today: string) {
  const { from, to } = getWorkoutSwapWindow(today);
  return day >= from && day <= to;
}

type ActivityObjective = {
  id: string;
  title: string;
  weekdays: number[];
  activity_type: string | null;
  createdDay?: string;
};

/**
 * RN-33: another objective of the same activity type that already occurs on the day; null when the
 * objective has no type or the day is free. `ignoreId` is the objective leaving the day in a swap.
 */
export function findSameActivityOnDay(
  objective: Pick<ActivityObjective, "id" | "activity_type">,
  day: string,
  objectives: ActivityObjective[],
  changes: DayChanges,
  ignoreId: string | null = null,
): ActivityObjective | null {
  if (!objective.activity_type) return null;
  return (
    objectives.find(
      (other) =>
        other.id !== objective.id &&
        other.id !== ignoreId &&
        other.activity_type === objective.activity_type &&
        getOccurrence(other, day, changes).due,
    ) ?? null
  );
}
