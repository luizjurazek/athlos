import type { createClient } from "@/app/utils/supabase/server";
import type { Enums } from "@/app/utils/supabase/database.types";
import { getGoalStatus } from "@/app/utils/goals";

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
  title: string;
  targetCount: number;
  dueOn: string;
  windowStart: string;
  checksCount: number;
  completed: boolean;
  completedAt: string | null;
};

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  unitLabel: string | null;
  startsOn: string;
  dueOn: string;
  status: GoalStatus;
  stages: GoalStage[];
  objectives: GoalObjective[];
};

const GOAL_SELECT = `
  id, title, description, unit_label, starts_on, due_on, status,
  goal_stages ( id, position, title, target_count, due_on, completed_at ),
  goal_objectives ( objectives ( id, title, color, icon, weekdays, archived_at ) )
`;

export async function getGoals(supabase: Client, goalId?: string): Promise<Goal[]> {
  let goalsQuery = supabase.from("goals").select(GOAL_SELECT).order("created_at");
  let progressQuery = supabase
    .from("goal_stage_progress")
    .select("stage_id, window_start, checks_count");
  if (goalId) {
    goalsQuery = goalsQuery.eq("id", goalId);
    progressQuery = progressQuery.eq("goal_id", goalId);
  }

  const [goalsResult, progressResult] = await Promise.all([goalsQuery, progressQuery]);
  if (goalsResult.error) throw goalsResult.error;
  if (progressResult.error) throw progressResult.error;

  const progress = new Map(progressResult.data.map((row) => [row.stage_id, row]));

  return goalsResult.data.map((goal) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    unitLabel: goal.unit_label,
    startsOn: goal.starts_on,
    dueOn: goal.due_on,
    status: goal.status,
    stages: goal.goal_stages
      .toSorted((a, b) => a.position - b.position)
      .map((stage) => {
        const stageProgress = progress.get(stage.id);
        const checksCount = stageProgress?.checks_count ?? 0;
        return {
          id: stage.id,
          position: stage.position,
          title: stage.title,
          targetCount: stage.target_count,
          dueOn: stage.due_on,
          windowStart: stageProgress?.window_start ?? goal.starts_on,
          checksCount,
          completed: checksCount >= stage.target_count,
          completedAt: stage.completed_at,
        };
      }),
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

/**
 * Status is derived on read (no cron, task 07). When the derived value differs from what is stored,
 * the goal status and the stages' completed_at are written back so other readers see it too.
 */
export async function syncGoalStatuses(supabase: Client, goals: Goal[], today: string) {
  const writes: PromiseLike<{ error: unknown }>[] = [];
  const synced = goals.map((goal) => {
    const status = getGoalStatus(goal.stages, today, goal.status);
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
