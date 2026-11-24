import { addDays, getWeekday } from "./dates";

export type Reschedule = { fromDay: string; toDay: string };

type StreakInput = {
  weekdays: number[];
  checkedDays: ReadonlySet<string>;
  firstDay: string;
  today: string;
  reschedules?: Reschedule[];
};

// RN-16: a rescheduled occurrence counts on its destination, and its origin is not a miss.
function getOccurrences({ weekdays, firstDay, today, reschedules = [] }: StreakInput) {
  const origins = new Set(reschedules.map((item) => item.fromDay));
  const days = new Set<string>();
  for (let day = firstDay; day <= today; day = addDays(day, 1)) {
    if (weekdays.includes(getWeekday(day)) && !origins.has(day)) days.add(day);
  }
  for (const { toDay } of reschedules) {
    if (toDay >= firstDay && toDay <= today) days.add(toDay);
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
