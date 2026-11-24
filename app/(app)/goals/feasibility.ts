import { isDay } from "@/app/utils/dates";
import { countScheduledDays } from "@/app/utils/goals";

type ScheduledObjective = { weekdays: number[] };

/**
 * RN-19 preview for the form: checks already counted in the window plus every scheduled
 * occurrence from today (or the window start, if later) through the stage deadline.
 */
export function getStageCapacity({
  objectives,
  windowStart,
  dueOn,
  today,
  doneInWindow,
}: {
  objectives: ScheduledObjective[];
  windowStart: string;
  dueOn: string;
  today: string;
  doneInWindow: number;
}) {
  if (!isDay(windowStart) || !isDay(dueOn) || dueOn < today) return null;
  const from = windowStart > today ? windowStart : today;
  return doneInWindow + countScheduledDays(objectives, from, dueOn);
}

/**
 * Per-objective version of getStageCapacity: `doneByObjective` holds checks already counted in the
 * window for each objective (only known when the stage was saved with per-objective targets).
 */
export function getObjectiveCapacities({
  objectives,
  windowStart,
  dueOn,
  today,
  doneByObjective,
}: {
  objectives: (ScheduledObjective & { id: string })[];
  windowStart: string;
  dueOn: string;
  today: string;
  doneByObjective: Map<string, number>;
}) {
  if (!isDay(windowStart) || !isDay(dueOn) || dueOn < today) return null;
  const from = windowStart > today ? windowStart : today;
  return objectives.map((objective) => ({
    objectiveId: objective.id,
    capacity: (doneByObjective.get(objective.id) ?? 0) + countScheduledDays([objective], from, dueOn),
  }));
}
