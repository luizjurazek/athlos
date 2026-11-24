import { CHECK_BACKFILL_DAYS } from "./checks";
import { addDays, diffDays, getWeekday } from "./dates";

export type ObjectiveTarget = { objectiveId: string; targetCount: number; checksCount: number };

/**
 * With `objectiveTargets`, `targetCount` is their sum and `checksCount` the effective count
 * (see getEffectiveCount), so bars and pace work the same in both modes.
 */
export type StageProgress = {
  windowStart: string;
  dueOn: string;
  targetCount: number;
  checksCount: number;
  objectiveTargets?: ObjectiveTarget[];
  completedManuallyOn?: string | null;
};

export type ScheduledObjective = { id?: string; weekdays: number[] };

export type StageStatus = "completed" | "expired" | "current" | "upcoming";

export type GoalStatus = "active" | "completed" | "expired" | "abandoned";

export type Pace = "ahead" | "on-track" | "slightly-behind" | "behind";

const maxDay = (a: string, b: string) => (a > b ? a : b);
const minDay = (a: string, b: string) => (a < b ? a : b);

export function hasObjectiveTargets(
  stage: StageProgress,
): stage is StageProgress & { objectiveTargets: ObjectiveTarget[] } {
  return Boolean(stage.objectiveTargets?.length);
}

/** Extra checks of one objective never cover what another one is missing. */
export function getEffectiveCount(targets: ObjectiveTarget[]) {
  return targets.reduce((total, target) => total + Math.min(target.checksCount, target.targetCount), 0);
}

export function isStageCompleted(stage: StageProgress) {
  if (stage.completedManuallyOn) return true;
  if (hasObjectiveTargets(stage)) {
    return stage.objectiveTargets.every((target) => target.checksCount >= target.targetCount);
  }
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
  completedManuallyOn: string | null = null,
): GoalStatus {
  if (stored === "abandoned") return stored;
  if (completedManuallyOn) return "completed";
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

type ObjectiveFeasibility = {
  objectiveId: string;
  missing: number;
  available: number;
  feasible: boolean;
};

/**
 * RN-19 for a stage that already started: scheduled occurrences still markable (unchecked days
 * inside the backfill window plus every day from tomorrow on) against what is left of the target.
 * With per-objective targets each objective is checked on its own and all of them must fit.
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
  const checked = new Set(checks.map((check) => `${check.objectiveId}:${check.day}`));
  const backfillStart = maxDay(stage.windowStart, addDays(today, -CHECK_BACKFILL_DAYS));
  const lastMarkable = minDay(today, stage.dueOn);
  const tomorrow = maxDay(addDays(today, 1), stage.windowStart);

  function countAvailable(scheduled: Required<ScheduledObjective>[]) {
    let available = 0;
    for (let day = backfillStart; day <= lastMarkable; day = addDays(day, 1)) {
      const weekday = getWeekday(day);
      for (const objective of scheduled) {
        if (objective.weekdays.includes(weekday) && !checked.has(`${objective.id}:${day}`)) {
          available += 1;
        }
      }
    }
    return available + countScheduledDays(scheduled, tomorrow, stage.dueOn);
  }

  const weeks = Math.max(1, diffDays(maxDay(today, stage.windowStart), stage.dueOn) + 1) / 7;

  if (!hasObjectiveTargets(stage)) {
    const missing = Math.max(0, stage.targetCount - stage.checksCount);
    const available = countAvailable(objectives);
    return { missing, available, feasible: missing <= available, perWeek: missing / weeks, perObjective: [] };
  }

  const perObjective: ObjectiveFeasibility[] = stage.objectiveTargets.map((target) => {
    const objective = objectives.find((item) => item.id === target.objectiveId);
    const missing = Math.max(0, target.targetCount - target.checksCount);
    const available = objective ? countAvailable([objective]) : 0;
    return { objectiveId: target.objectiveId, missing, available, feasible: missing <= available };
  });
  const missing = perObjective.reduce((total, item) => total + item.missing, 0);
  return {
    missing,
    available: perObjective.reduce((total, item) => total + item.available, 0),
    feasible: perObjective.every((item) => item.feasible),
    perWeek: missing / weeks,
    perObjective,
  };
}

/** RN-19 for a stage that has not started: every occurrence in its window against the target. */
export function getUpcomingCapacity(stage: StageProgress, objectives: Required<ScheduledObjective>[]) {
  if (!hasObjectiveTargets(stage)) {
    const capacity = countScheduledDays(objectives, stage.windowStart, stage.dueOn);
    return { capacity, feasible: capacity >= stage.targetCount, perObjective: [] };
  }
  const perObjective = stage.objectiveTargets.map((target) => {
    const objective = objectives.find((item) => item.id === target.objectiveId);
    const capacity = objective ? countScheduledDays([objective], stage.windowStart, stage.dueOn) : 0;
    return { objectiveId: target.objectiveId, capacity, feasible: capacity >= target.targetCount };
  });
  return {
    capacity: perObjective.reduce((total, item) => total + item.capacity, 0),
    feasible: perObjective.every((item) => item.feasible),
    perObjective,
  };
}
