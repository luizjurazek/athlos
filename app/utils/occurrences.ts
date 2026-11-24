import { getWeekday } from "./dates";

// Only for the destination picker's usability; the server accepts any future destination (RN-13).
export const RESCHEDULE_DAYS_AHEAD = 14;

export type Reschedule = {
  id: string;
  objectiveId: string;
  fromDay: string;
  toDay: string;
};

type OccurrenceObjective = { id: string; weekdays: number[]; createdDay?: string };

/**
 * The single rule for "is this objective due on this day" (RN-01, RN-15): a scheduled weekday whose
 * occurrence was not moved away, or the destination of a reschedule.
 */
export function getOccurrence(objective: OccurrenceObjective, day: string, reschedules: Reschedule[]) {
  const arriving = reschedules.find(
    (item) => item.objectiveId === objective.id && item.toDay === day,
  );
  if (arriving) return { due: true, reschedule: arriving };
  if (objective.createdDay && day < objective.createdDay) return { due: false, reschedule: null };
  const movedAway = reschedules.some(
    (item) => item.objectiveId === objective.id && item.fromDay === day,
  );
  return {
    due: !movedAway && objective.weekdays.includes(getWeekday(day)),
    reschedule: null,
  };
}

export function isDueOn(objective: OccurrenceObjective, day: string, reschedules: Reschedule[]) {
  return getOccurrence(objective, day, reschedules).due;
}
