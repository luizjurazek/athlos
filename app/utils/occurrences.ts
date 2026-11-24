import { getWeekday } from "./dates";

// Only for the destination picker's usability; the server accepts any future destination (RN-13).
export const RESCHEDULE_DAYS_AHEAD = 14;

export type Reschedule = {
  id: string;
  objectiveId: string;
  fromDay: string;
  toDay: string;
};

/** RN-22/RN-23: an extra occurrence on `day`; with `replacedObjectiveId` it takes that objective's place. */
export type Addition = {
  id: string;
  objectiveId: string;
  day: string;
  replacedObjectiveId: string | null;
};

export type DayChanges = { reschedules: Reschedule[]; additions: Addition[] };

export const NO_CHANGES: DayChanges = { reschedules: [], additions: [] };

type OccurrenceObjective = { id: string; weekdays: number[]; createdDay?: string };

export type Occurrence = {
  due: boolean;
  reschedule: Reschedule | null;
  addition: Addition | null;
  movedTo: Reschedule | null;
  replacedBy: Addition | null;
};

const NOT_DUE: Occurrence = {
  due: false,
  reschedule: null,
  addition: null,
  movedTo: null,
  replacedBy: null,
};

/**
 * The single rule for "is this objective due on this day" (RN-01, RN-15, RN-22, RN-23): a scheduled
 * weekday whose occurrence was not moved away nor replaced, the destination of a reschedule, or an addition.
 */
export function getOccurrence(
  objective: OccurrenceObjective,
  day: string,
  { reschedules, additions }: DayChanges,
): Occurrence {
  const addition = additions.find((item) => item.objectiveId === objective.id && item.day === day);
  if (addition) return { ...NOT_DUE, due: true, addition };
  const arriving = reschedules.find(
    (item) => item.objectiveId === objective.id && item.toDay === day,
  );
  if (arriving) return { ...NOT_DUE, due: true, reschedule: arriving };
  if (objective.createdDay && day < objective.createdDay) return NOT_DUE;
  if (!objective.weekdays.includes(getWeekday(day))) return NOT_DUE;
  const movedTo = reschedules.find(
    (item) => item.objectiveId === objective.id && item.fromDay === day,
  );
  if (movedTo) return { ...NOT_DUE, movedTo };
  const replacedBy = additions.find(
    (item) => item.replacedObjectiveId === objective.id && item.day === day,
  );
  if (replacedBy) return { ...NOT_DUE, replacedBy };
  return { ...NOT_DUE, due: true };
}

export function isDueOn(objective: OccurrenceObjective, day: string, changes: DayChanges) {
  return getOccurrence(objective, day, changes).due;
}

/** Days this objective left its routine (moved away or replaced) and days it was added outside of it. */
export function getRoutineChanges(objectiveId: string, { reschedules, additions }: DayChanges) {
  const own = reschedules.filter((item) => item.objectiveId === objectiveId);
  return {
    removedDays: [
      ...own.map((item) => item.fromDay),
      ...additions.filter((item) => item.replacedObjectiveId === objectiveId).map((item) => item.day),
    ],
    addedDays: [
      ...own.map((item) => item.toDay),
      ...additions.filter((item) => item.objectiveId === objectiveId).map((item) => item.day),
    ],
  };
}
