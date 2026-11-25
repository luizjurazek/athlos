import { isDay } from "@/app/utils/dates";
import { countScheduledDays } from "@/app/utils/goals";

type ScheduledObjective = { id: string; weekdays: number[] };

/**
 * RN-19 preview for the form. Targets are cumulative, so a stage is feasible when what each
 * objective already did since the goal start plus every occurrence still scheduled from today (or
 * the goal start, if later) through the stage deadline reaches its target.
 */
export function getObjectiveCapacities({
  objectives,
  startsOn,
  dueOn,
  today,
  doneByObjective,
}: {
  objectives: ScheduledObjective[];
  startsOn: string;
  dueOn: string;
  today: string;
  doneByObjective: Record<string, number>;
}) {
  if (!isDay(startsOn) || !isDay(dueOn) || dueOn < today) return null;
  const from = startsOn > today ? startsOn : today;
  return objectives.map((objective) => ({
    objectiveId: objective.id,
    capacity: (doneByObjective[objective.id] ?? 0) + countScheduledDays([objective], from, dueOn),
  }));
}
