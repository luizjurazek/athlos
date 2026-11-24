import { CHECK_BACKFILL_DAYS } from "./checks";
import { addDays, diffDays, getWeekday } from "./dates";

export type StageProgress = {
  windowStart: string;
  dueOn: string;
  targetCount: number;
  checksCount: number;
};

export type ScheduledObjective = { id?: string; weekdays: number[] };

export type StageStatus = "completed" | "expired" | "current" | "upcoming";

export type GoalStatus = "active" | "completed" | "expired" | "abandoned";

export type Pace = "ahead" | "on-track" | "slightly-behind" | "behind";

const maxDay = (a: string, b: string) => (a > b ? a : b);
const minDay = (a: string, b: string) => (a < b ? a : b);

export function isStageCompleted(stage: StageProgress) {
  return stage.checksCount >= stage.targetCount;
}

/** RN-10 plus acceptance 1 of task 07: the current stage is the first one neither completed nor expired. */
export function getStageStatuses(stages: StageProgress[], today: string): StageStatus[] {
  let currentFound = false;
  return stages.map((stage) => {
    if (isStageCompleted(stage)) return "completed";
    if (stage.dueOn < today) return "expired";
    if (currentFound) return "upcoming";
    currentFound = true;
    return "current";
  });
}

export function getGoalStatus(
  stages: StageProgress[],
  today: string,
  stored: GoalStatus,
): GoalStatus {
  if (stored === "abandoned") return stored;
  const last = stages.at(-1);
  if (!last) return "active";
  if (isStageCompleted(last)) return "completed";
  if (last.dueOn < today) return "expired";
  return "active";
}

export function hasStarted(stage: StageProgress, today: string) {
  return stage.windowStart <= today;
}

export function getDaysLeft(stage: StageProgress, today: string) {
  return Math.max(0, diffDays(today, stage.dueOn) + 1);
}

/** Expected progress = time elapsed in the window / window length (acceptance 2). */
export function getExpectedProgress(stage: StageProgress, today: string) {
  const length = diffDays(stage.windowStart, stage.dueOn) + 1;
  const elapsed = Math.min(Math.max(diffDays(stage.windowStart, today), 0), length);
  const fraction = length > 0 ? elapsed / length : 1;
  return { fraction, count: stage.targetCount * fraction };
}

export function getPace(stage: StageProgress, today: string): Pace {
  const expected = getExpectedProgress(stage, today);
  const gap = (stage.checksCount - expected.count) / stage.targetCount;
  if (gap > 0.05) return "ahead";
  if (gap >= -0.02) return "on-track";
  if (gap >= -0.15) return "slightly-behind";
  return "behind";
}

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

/**
 * RN-19 for a stage that already started: scheduled occurrences still markable (unchecked days
 * inside the backfill window plus every day from tomorrow on) against what is left of the target.
 * `checks` must hold the linked objectives' checks from the backfill start through today.
 */
export function getStageFeasibility({
  stage,
  objectives,
  checks,
  today,
}: {
  stage: StageProgress;
  objectives: Required<ScheduledObjective>[];
  checks: { objectiveId: string; day: string }[];
  today: string;
}) {
  const missing = Math.max(0, stage.targetCount - stage.checksCount);
  const checked = new Set(checks.map((check) => `${check.objectiveId}:${check.day}`));

  let available = 0;
  const backfillStart = maxDay(stage.windowStart, addDays(today, -CHECK_BACKFILL_DAYS));
  const lastMarkable = minDay(today, stage.dueOn);
  for (let day = backfillStart; day <= lastMarkable; day = addDays(day, 1)) {
    const weekday = getWeekday(day);
    for (const objective of objectives) {
      if (objective.weekdays.includes(weekday) && !checked.has(`${objective.id}:${day}`)) {
        available += 1;
      }
    }
  }
  const tomorrow = maxDay(addDays(today, 1), stage.windowStart);
  available += countScheduledDays(objectives, tomorrow, stage.dueOn);

  const weeks = Math.max(1, diffDays(maxDay(today, stage.windowStart), stage.dueOn) + 1) / 7;
  return {
    missing,
    available,
    feasible: missing <= available,
    perWeek: missing / weeks,
  };
}

/** RN-19 for a stage that has not started: every occurrence in its window against the target. */
export function getUpcomingCapacity(stage: StageProgress, objectives: ScheduledObjective[]) {
  return countScheduledDays(objectives, stage.windowStart, stage.dueOn);
}
