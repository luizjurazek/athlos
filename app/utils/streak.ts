import { addDays, getWeekday } from "./dates";

type StreakInput = {
  weekdays: number[];
  checkedDays: ReadonlySet<string>;
  firstDay: string;
  today: string;
  /** Scheduled days that left the routine: reschedule origins and replaced days (`getRoutineChanges`). */
  removedDays?: string[];
  /** Days outside the routine: reschedule destinations and additions (`getRoutineChanges`). */
  addedDays?: string[];
};

// RN-16/RN-22: moved or replaced days are not misses; destinations and additions count like any scheduled day.
function getOccurrences({ weekdays, firstDay, today, removedDays = [], addedDays = [] }: StreakInput) {
  const removed = new Set(removedDays);
  const days = new Set<string>();
  for (let day = firstDay; day <= today; day = addDays(day, 1)) {
    if (weekdays.includes(getWeekday(day)) && !removed.has(day)) days.add(day);
  }
  for (const day of addedDays) {
    if (day >= firstDay && day <= today) days.add(day);
  }
  return [...days].sort();
}

/** RN-11: consecutive scheduled days with a check, counting back from today; an unchecked today does not break it. */
export function getCurrentStreak(input: StreakInput) {
  const occurrences = getOccurrences(input);
  let streak = 0;
  for (let i = occurrences.length - 1; i >= 0; i--) {
    const day = occurrences[i];
    if (input.checkedDays.has(day)) streak += 1;
    else if (day === input.today) continue;
    else break;
  }
  return streak;
}

export function getLongestStreak(input: StreakInput) {
  let longest = 0;
  let run = 0;
  for (const day of getOccurrences(input)) {
    if (input.checkedDays.has(day)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (day !== input.today) {
      run = 0;
    }
  }
  return longest;
}
