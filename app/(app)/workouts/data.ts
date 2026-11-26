import type { createClient } from "@/app/utils/supabase/server";

type Client = ReturnType<typeof createClient>;

export type PlanWorkout = { id: string; label: string; description: string | null; position: number };

export type PlanSummary = {
  id: string;
  title: string;
  objectiveId: string | null;
  objectiveTitle: string | null;
  startedOn: string;
  endedOn: string | null;
  workouts: PlanWorkout[];
};

export type ScheduleEntry = { weekday: number; workoutId: string };

export type PlanDetail = PlanSummary & {
  objectiveWeekdays: number[] | null;
  schedule: ScheduleEntry[];
  exerciseCounts: Record<string, number>;
};

export type CopySource = {
  id: string;
  title: string;
  startedOn: string;
  workouts: PlanWorkout[];
  schedule: ScheduleEntry[];
};

export type GymObjective = {
  id: string;
  title: string;
  weekdays: number[];
  activePlan: { id: string; title: string; startedOn: string } | null;
};

const PLAN_COLUMNS =
  "id, title, objective_id, started_on, ended_on, objectives ( title, weekdays ), workouts ( id, label, description, position )";

type PlanRow = {
  id: string;
  title: string;
  objective_id: string | null;
  started_on: string;
  ended_on: string | null;
  objectives: { title: string; weekdays: number[] } | null;
  workouts: PlanWorkout[];
};

function toSummary(row: PlanRow): PlanSummary {
  return {
    id: row.id,
    title: row.title,
    objectiveId: row.objective_id,
    objectiveTitle: row.objectives?.title ?? null,
    startedOn: row.started_on,
    endedOn: row.ended_on,
    workouts: [...row.workouts].sort((a, b) => a.position - b.position),
  };
}

export async function getPlans(supabase: Client): Promise<PlanSummary[]> {
  const { data, error } = await supabase
    .from("workout_plans")
    .select(PLAN_COLUMNS)
    .order("started_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toSummary);
}

export async function getPlan(supabase: Client, id: string): Promise<PlanDetail | null> {
  const { data, error } = await supabase
    .from("workout_plans")
    .select(PLAN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const summary = toSummary(data);
  const workoutIds = summary.workouts.map((workout) => workout.id);
  const [schedule, exercises] = await Promise.all([
    supabase.from("workout_schedule").select("weekday, workout_id").eq("plan_id", id).order("weekday"),
    workoutIds.length > 0
      ? supabase
          .from("workout_exercises")
          .select("workout_id")
          .in("workout_id", workoutIds)
          .is("archived_at", null)
      : null,
  ]);
  if (schedule.error) throw schedule.error;
  if (exercises?.error) throw exercises.error;

  const exerciseCounts: Record<string, number> = {};
  for (const exercise of exercises?.data ?? []) {
    exerciseCounts[exercise.workout_id] = (exerciseCounts[exercise.workout_id] ?? 0) + 1;
  }
  return {
    ...summary,
    objectiveWeekdays: data.objectives?.weekdays ?? null,
    schedule: schedule.data.map((entry) => ({ weekday: entry.weekday, workoutId: entry.workout_id })),
    exerciseCounts,
  };
}

/** Active gym objectives with their active plan (RN-25: at most one). */
export async function getGymObjectives(supabase: Client): Promise<GymObjective[]> {
  const [objectives, plans] = await Promise.all([
    supabase
      .from("objectives")
      .select("id, title, weekdays")
      .eq("activity_type", "gym")
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("workout_plans")
      .select("id, title, started_on, objective_id")
      .is("ended_on", null)
      .not("objective_id", "is", null),
  ]);
  if (objectives.error) throw objectives.error;
  if (plans.error) throw plans.error;
  return objectives.data.map((objective) => {
    const plan = plans.data.find((item) => item.objective_id === objective.id);
    return {
      ...objective,
      activePlan: plan ? { id: plan.id, title: plan.title, startedOn: plan.started_on } : null,
    };
  });
}

export function toCopySource(plan: PlanDetail): CopySource {
  return {
    id: plan.id,
    title: plan.title,
    startedOn: plan.startedOn,
    workouts: plan.workouts,
    schedule: plan.schedule,
  };
}

/** RN-26: a workout with a session or a load version before today cannot be deleted. */
export async function getWorkoutsWithHistory(
  supabase: Client,
  workoutIds: string[],
  today: string,
): Promise<Set<string>> {
  if (workoutIds.length === 0) return new Set();
  const [sessions, loads] = await Promise.all([
    supabase.from("activity_sessions").select("workout_id").in("workout_id", workoutIds),
    supabase
      .from("workout_exercise_loads")
      .select("effective_from, workout_exercises!inner ( workout_id )")
      .in("workout_exercises.workout_id", workoutIds)
      .lt("effective_from", today),
  ]);
  if (sessions.error) throw sessions.error;
  if (loads.error) throw loads.error;
  return new Set([
    ...sessions.data.flatMap((session) => (session.workout_id ? [session.workout_id] : [])),
    ...loads.data.map((load) => load.workout_exercises.workout_id),
  ]);
}
