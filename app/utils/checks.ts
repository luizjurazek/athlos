import { addDays } from "./dates";

// RN-03: how many past days a check can still be marked or unmarked.
export const CHECK_BACKFILL_DAYS = 7;

export function getBackfillStart(today: string) {
  return addDays(today, -CHECK_BACKFILL_DAYS);
}

export function isWithinBackfill(day: string, today: string) {
  return day <= today && day >= getBackfillStart(today);
}
