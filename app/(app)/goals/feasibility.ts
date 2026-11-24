import { isDay } from "@/app/utils/dates";
import { countScheduledDays } from "@/app/utils/goals";
import { formatWeekdays } from "@/app/utils/weekdays";

type ScheduledObjective = { title: string; weekdays: number[] };

export function describeObjectives(objectives: ScheduledObjective[]) {
  const parts = objectives.map(
    (objective) => `${objective.title} (${formatWeekdays(objective.weekdays).toLowerCase()})`,
  );
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

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
