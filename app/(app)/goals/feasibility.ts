import { addDays, diffDays, getWeekday, isDay } from "@/app/utils/dates";
import { formatWeekdays } from "@/app/utils/weekdays";

type ScheduledObjective = { title: string; weekdays: number[] };

export function countScheduledDays(objectives: ScheduledObjective[], from: string, to: string) {
  const days = diffDays(from, to) + 1;
  if (days <= 0) return 0;
  const perWeek = objectives.reduce((total, objective) => total + objective.weekdays.length, 0);
  const fullWeeks = Math.floor(days / 7);
  let total = fullWeeks * perWeek;
  for (let day = addDays(from, fullWeeks * 7); day <= to; day = addDays(day, 1)) {
    const weekday = getWeekday(day);
    total += objectives.filter((objective) => objective.weekdays.includes(weekday)).length;
  }
  return total;
}

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
