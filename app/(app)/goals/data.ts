import type { createClient } from "@/app/utils/supabase/server";
import type { Enums } from "@/app/utils/supabase/database.types";
import {
  getEffectiveCount,
  getGoalStatus,
  isStageCompleted,
  type ObjectiveTarget,
  type ProgressSource,
} from "@/app/utils/goals";

type Client = ReturnType<typeof createClient>;

export type GoalStatus = Enums<"goal_status">;

export type GoalObjective = {
  id: string;
  title: string;
  color: string | null;
  icon: string | null;
  weekdays: number[];
  archived: boolean;
};

export type GoalStage = {
  id: string;
  position: number;
  title: string | null;
  targetCount: number;
  baseCount: number;
  dueOn: string;
  windowStart: string;
  windowEnd: string;
  checksCount: number;
  objectiveTargets?: ObjectiveTarget[];
  completed: boolean;
  completedAt: string | null;
  completedManuallyOn: string | null;
};

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  unitLabel: string | null;
  startsOn: string;
  dueOn: string;
  status: GoalStatus;
  progressSource: ProgressSource;
  completedManuallyOn: string | null;
  stages: GoalStage[];
  objectives: GoalObjective[];
};

const GOAL_SELECT = `
  id, title, description, unit_label, starts_on, due_on, status, completed_manually_on,
  progress_source,
  goal_stages ( id, position, title, target_count, due_on, completed_at, completed_manually_on ),
  goal_objectives ( objectives ( id, title, color, icon, weekdays, archived_at ) )
`;

export async function getGoals(supabase: Client, goalId?: string): Promise<Goal[]> {
  let goalsQuery = supabase.from("goals").select(GOAL_SELECT).order("created_at");
  let progressQuery = supabase
    .from("goal_stage_progress")
    .select("stage_id, window_start, window_end, checks_count");
  let targetsQuery = supabase
    .from("goal_stage_objective_progress")
    .select("stage_id, objective_id, target_count, checks_count");
  if (goalId) {
    goalsQuery = goalsQuery.eq("id", goalId);
    progressQuery = progressQuery.eq("goal_id", goalId);
    targetsQuery = targetsQuery.eq("goal_id", goalId);
  }

  const [goalsResult, progressResult, targetsResult] = await Promise.all([
    goalsQuery,
    progressQuery,
    targetsQuery,
  ]);
  if (goalsResult.error) throw goalsResult.error;
  if (progressResult.error) throw progressResult.error;
  if (targetsResult.error) throw targetsResult.error;

  const progress = new Map(progressResult.data.map((row) => [row.stage_id, row]));
  const targetsByStage = new Map<string, ObjectiveTarget[]>();
  for (const row of targetsResult.data) {
    if (!row.stage_id || !row.objective_id) continue;
    const list = targetsByStage.get(row.stage_id) ?? [];
    list.push({
      objectiveId: row.objective_id,
      targetCount: row.target_count ?? 0,
      checksCount: row.checks_count ?? 0,
    });
    targetsByStage.set(row.stage_id, list);
  }

  // Each stage's plan starts where the previous one ends, per objective too (an objective keeps
  // the target of the latest earlier stage that had one).
  function withBaseCounts<T extends { id: string; target_count: number }>(stages: T[]) {
    const objectiveBases = new Map<string, number>();
    return stages.map((stage, index) => {
      const item = {
        stage,
        baseCount: index === 0 ? 0 : stages[index - 1].target_count,
        objectiveBases: new Map(objectiveBases),
      };
      for (const target of targetsByStage.get(stage.id) ?? []) {
        objectiveBases.set(target.objectiveId, target.targetCount);
      }
      return item;
    });
  }

  return goalsResult.data.map((goal) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    unitLabel: goal.unit_label,
    startsOn: goal.starts_on,
    dueOn: goal.due_on,
    status: goal.status,
    progressSource: goal.progress_source,
    completedManuallyOn: goal.completed_manually_on,
    stages: withBaseCounts(goal.goal_stages.toSorted((a, b) => a.position - b.position)).map(
      ({ stage, baseCount, objectiveBases }) => {
        const stageProgress = progress.get(stage.id);
        const objectiveTargets = targetsByStage
          .get(stage.id)
          ?.map((target) => ({ ...target, baseCount: objectiveBases.get(target.objectiveId) ?? 0 }));
        const base = {
          windowStart: stageProgress?.window_start ?? goal.starts_on,
          dueOn: stage.due_on,
          targetCount: stage.target_count,
          baseCount,
          checksCount: objectiveTargets
            ? getEffectiveCount(objectiveTargets)
            : (stageProgress?.checks_count ?? 0),
          objectiveTargets,
          completedManuallyOn: stage.completed_manually_on,
        };
        return {
          ...base,
          id: stage.id,
          position: stage.position,
          title: stage.title || null,
          windowEnd: stageProgress?.window_end ?? stage.due_on,
          completed: isStageCompleted(base),
          completedAt: stage.completed_at,
        };
      },
    ),
    objectives: goal.goal_objectives
      .flatMap(({ objectives }) => (objectives ? [objectives] : []))
      .map((objective) => ({
        id: objective.id,
        title: objective.title,
        color: objective.color,
        icon: objective.icon,
        weekdays: objective.weekdays,
        archived: Boolean(objective.archived_at),
      })),
  }));
}

export async function getGoal(supabase: Client, goalId: string) {
  const [goal] = await getGoals(supabase, goalId);
  return goal ?? null;
}

type ProgressEvent = { day: string; amount: number; objectiveId?: string };

function firstDayReaching(events: ProgressEvent[], target: number, objectiveId?: string) {
  let total = 0;
  for (const event of events) {
    if (objectiveId && event.objectiveId !== objectiveId) continue;
    total += event.amount;
    if (total >= target) return event.day;
  }
  return null;
}

/** With per-objective targets the stage is reached when the last objective reaches its own. */
function getReachDay(stage: GoalStage, events: ProgressEvent[]) {
  if (!stage.objectiveTargets?.length) return firstDayReaching(events, stage.targetCount);
  let latest = "";
  for (const target of stage.objectiveTargets) {
    const day = firstDayReaching(events, target.targetCount, target.objectiveId);
    if (!day) return null;
    if (day > latest) latest = day;
  }
  return latest;
}

/**
 * A stage only completes by reaching its target, and it closes on that day so the next stage
 * starts right after instead of waiting for the original deadline. Adding, editing or removing an
 * entry or a check can move that day or undo it, so whenever a stage's count disagrees with its
 * stored closing day, every stage of the goal is recomputed from the raw entries/checks. A goal
 * completed by hand keeps its stages frozen. Returns whether anything was written.
 */
async function syncStageClosures(supabase: Client, goal: Goal) {
  if (goal.completedManuallyOn || goal.status === "abandoned") return false;
  const outOfSync = goal.stages.some((stage) => stage.completed !== Boolean(stage.completedManuallyOn));
  if (!outOfSync) return false;

  const events: ProgressEvent[] =
    goal.progressSource === "entries"
      ? (await getGoalEntries(supabase, goal.id, goal.startsOn, goal.dueOn)).map((entry) => ({
          day: entry.day,
          amount: entry.amount,
        }))
      : (
          await getObjectiveChecks(
            supabase,
            goal.objectives.map((objective) => objective.id),
            goal.startsOn,
            goal.dueOn,
          )
        ).map((check) => ({ day: check.day, amount: 1, objectiveId: check.objectiveId }));
  events.sort((a, b) => a.day.localeCompare(b.day));

  const writes = goal.stages.flatMap((stage) => {
    const reached = getReachDay(stage, events);
    const closeOn = reached && reached <= stage.dueOn ? reached : null;
    if (closeOn === stage.completedManuallyOn) return [];
    return [
      supabase
        .from("goal_stages")
        .update({
          completed_manually_on: closeOn,
          completed_at: closeOn ? new Date().toISOString() : null,
        })
        .eq("id", stage.id),
    ];
  });
  const results = await Promise.all(writes);
  for (const { error } of results) {
    if (error) console.error("Failed to sync stage closure", error);
  }
  return writes.length > 0;
}

/**
 * Status is derived on read (no cron, task 07). Stage closures are synced first (they move the
 * stage windows, so those goals are read again); then, when the derived status differs from what
 * is stored, the goal status and the stages' completed_at are written back so other readers see it.
 */
export async function syncGoalStatuses(supabase: Client, loaded: Goal[], today: string) {
  const changed = await Promise.all(loaded.map((goal) => syncStageClosures(supabase, goal)));
  const goals = await Promise.all(
    loaded.map(async (goal, index) =>
      changed[index] ? ((await getGoal(supabase, goal.id)) ?? goal) : goal,
    ),
  );

  const writes: PromiseLike<{ error: unknown }>[] = [];
  const synced = goals.map((goal) => {
    const status = getGoalStatus(goal.stages, today, goal.status, goal.completedManuallyOn);
    if (status !== goal.status) {
      writes.push(supabase.from("goals").update({ status }).eq("id", goal.id));
    }
    for (const stage of goal.stages) {
      if (stage.completed === Boolean(stage.completedAt)) continue;
      const completedAt = stage.completed ? new Date().toISOString() : null;
      writes.push(
        supabase.from("goal_stages").update({ completed_at: completedAt }).eq("id", stage.id),
      );
    }
    return { ...goal, status };
  });

  const results = await Promise.all(writes);
  for (const { error } of results) {
    if (error) console.error("Failed to sync goal status", error);
  }
  return synced;
}

export async function getObjectiveChecks(
  supabase: Client,
  objectiveIds: string[],
  from: string,
  to: string,
) {
  if (objectiveIds.length === 0 || from > to) return [];
  const { data, error } = await supabase
    .from("objective_checks")
    .select("objective_id, day")
    .in("objective_id", objectiveIds)
    .gte("day", from)
    .lte("day", to);
  if (error) throw error;
  return data.map((check) => ({ objectiveId: check.objective_id, day: check.day }));
}

export type GoalEntry = { id: string; day: string; amount: number; note: string | null };

export async function getGoalEntries(supabase: Client, goalId: string, from: string, to: string) {
  if (from > to) return [];
  const { data, error } = await supabase
    .from("goal_entries")
    .select("id, day, amount, note")
    .eq("goal_id", goalId)
    .gte("day", from)
    .lte("day", to)
    .order("day", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data satisfies GoalEntry[];
}

export async function getSelectableObjectives(supabase: Client, linkedIds: string[] = []) {
  const { data, error } = await supabase
    .from("objectives")
    .select("id, title, color, icon, weekdays, archived_at")
    .order("created_at");
  if (error) throw error;
  return data
    .filter((objective) => !objective.archived_at || linkedIds.includes(objective.id))
    .map(
      (objective): GoalObjective => ({
        id: objective.id,
        title: objective.title,
        color: objective.color,
        icon: objective.icon,
        weekdays: objective.weekdays,
        archived: Boolean(objective.archived_at),
      }),
    );
}

export type LinkableGoal = { id: string; title: string };

/** Active goals plus any goal already linked to the objective, whatever its status. */
export async function getLinkableGoals(supabase: Client, objectiveId?: string) {
  const [goalsResult, linksResult] = await Promise.all([
    supabase.from("goals").select("id, title, status").order("created_at"),
    objectiveId
      ? supabase.from("goal_objectives").select("goal_id").eq("objective_id", objectiveId)
      : null,
  ]);
  if (goalsResult.error) throw goalsResult.error;
  if (linksResult?.error) throw linksResult.error;

  const linkedIds = linksResult?.data.map((link) => link.goal_id) ?? [];
  const goals: LinkableGoal[] = goalsResult.data
    .filter((goal) => goal.status === "active" || linkedIds.includes(goal.id))
    .map(({ id, title }) => ({ id, title }));
  return { goals, linkedIds };
}
