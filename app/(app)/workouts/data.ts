import type { createClient } from "@/app/utils/supabase/server";
import { toLoadVersion, type LoadVersion } from "@/app/utils/workout-loads";

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

export type WorkoutExercise = {
  id: string;
  name: string;
  notes: string | null;
  source: string | null;
  sourceId: string | null;
  imageUrl: string | null;
  muscles: string[] | null;
  equipment: string | null;
  position: number;
  versions: LoadVersion[];
};

export type WorkoutDetail = {
  id: string;
  label: string;
  description: string | null;
  plan: { id: string; title: string; startedOn: string; endedOn: string | null };
  exercises: WorkoutExercise[];
};

export async function getWorkoutDetail(
  supabase: Client,
  planId: string,
  workoutId: string,
): Promise<WorkoutDetail | null> {
  const { data, error } = await supabase
    .from("workouts")
    .select(
      "id, label, description, workout_plans ( id, title, started_on, ended_on ), workout_exercises ( id, name, notes, source, source_id, image_url, muscles, equipment, position, created_at, archived_at, workout_exercise_loads ( effective_from, sets, reps, load_kg ) )",
    )
    .eq("id", workoutId)
    .eq("plan_id", planId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.workout_plans) return null;
  return {
    id: data.id,
    label: data.label,
    description: data.description,
    plan: {
      id: data.workout_plans.id,
      title: data.workout_plans.title,
      startedOn: data.workout_plans.started_on,
      endedOn: data.workout_plans.ended_on,
    },
    exercises: data.workout_exercises
      .filter((exercise) => !exercise.archived_at)
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      .map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        notes: exercise.notes,
        source: exercise.source,
        sourceId: exercise.source_id,
        imageUrl: exercise.image_url,
        muscles: exercise.muscles,
        equipment: exercise.equipment,
        position: exercise.position,
        versions: exercise.workout_exercise_loads.map(toLoadVersion),
      })),
  };
}

export type EvolutionVersion = LoadVersion & {
  exerciseId: string;
  planId: string;
  planTitle: string;
  /** First version of a later plan in the chain: the chart marks the plan change here. */
  planStart: boolean;
};

export type ExerciseEvolution = {
  id: string;
  name: string;
  imageUrl: string | null;
  archived: boolean;
  plan: { id: string; title: string; endedOn: string | null };
  workout: { id: string; label: string; description: string | null };
  versions: EvolutionVersion[];
};

type LineageRow = {
  id: string;
  name: string;
  image_url: string | null;
  archived_at: string | null;
  copied_from_id: string | null;
  workouts: {
    id: string;
    label: string;
    description: string | null;
    workout_plans: { id: string; title: string; started_on: string; ended_on: string | null } | null;
  } | null;
  workout_exercise_loads: { effective_from: string; sets: number; reps: number; load_kg: number | null }[];
};

const LINEAGE_COLUMNS =
  "id, name, image_url, archived_at, copied_from_id, workouts ( id, label, description, workout_plans ( id, title, started_on, ended_on ) ), workout_exercise_loads ( effective_from, sets, reps, load_kg )";
const MAX_LINEAGE = 24;

/**
 * RN-30: the evolution follows an exercise through the plans it was copied into (copied_from_id),
 * both back to its origin and forward to its copies. Exercises written again by hand stay separate.
 */
export async function getExerciseEvolution(supabase: Client, exerciseId: string): Promise<ExerciseEvolution | null> {
  const byId = new Map<string, LineageRow>();
  const { data: start, error } = await supabase
    .from("workout_exercises")
    .select(LINEAGE_COLUMNS)
    .eq("id", exerciseId)
    .maybeSingle()
    .returns<LineageRow | null>();
  if (error) throw error;
  if (!start?.workouts?.workout_plans) return null;
  byId.set(start.id, start);

  let back = start.copied_from_id;
  while (back && !byId.has(back) && byId.size < MAX_LINEAGE) {
    const { data, error: backError } = await supabase
      .from("workout_exercises")
      .select(LINEAGE_COLUMNS)
      .eq("id", back)
      .maybeSingle()
      .returns<LineageRow | null>();
    if (backError) throw backError;
    if (!data) break;
    byId.set(data.id, data);
    back = data.copied_from_id;
  }

  let frontier = [start.id];
  while (frontier.length > 0 && byId.size < MAX_LINEAGE) {
    const { data, error: forwardError } = await supabase
      .from("workout_exercises")
      .select(LINEAGE_COLUMNS)
      .in("copied_from_id", frontier)
      .returns<LineageRow[]>();
    if (forwardError) throw forwardError;
    frontier = data.filter((row) => !byId.has(row.id)).map((row) => row.id);
    for (const row of data) byId.set(row.id, row);
  }

  const chain = [...byId.values()]
    .filter((row) => row.workouts?.workout_plans)
    .sort((a, b) =>
      (a.workouts?.workout_plans?.started_on ?? "").localeCompare(b.workouts?.workout_plans?.started_on ?? ""),
    );

  const versions: EvolutionVersion[] = [];
  chain.forEach((row, index) => {
    const plan = row.workouts?.workout_plans;
    if (!plan) return;
    const own = row.workout_exercise_loads
      .map(toLoadVersion)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    own.forEach((version, versionIndex) => {
      // A copy's first version repeats the load in force; it stays as the plan-change marker.
      const planStart = index > 0 && versionIndex === 0;
      versions.push({ ...version, exerciseId: row.id, planId: plan.id, planTitle: plan.title, planStart });
    });
  });

  const plan = start.workouts.workout_plans;
  return {
    id: start.id,
    name: start.name,
    imageUrl: start.image_url,
    archived: Boolean(start.archived_at),
    plan: { id: plan.id, title: plan.title, endedOn: plan.ended_on },
    workout: { id: start.workouts.id, label: start.workouts.label, description: start.workouts.description },
    versions,
  };
}

export type PlanExercise = {
  id: string;
  workoutId: string;
  name: string;
  imageUrl: string | null;
  archived: boolean;
  versions: LoadVersion[];
};

/** Every exercise of the plan, archived ones included, for the read-only ended plan (RN-30). */
export async function getPlanExercises(supabase: Client, workoutIds: string[]): Promise<PlanExercise[]> {
  if (workoutIds.length === 0) return [];
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("id, workout_id, name, image_url, archived_at, position, workout_exercise_loads ( effective_from, sets, reps, load_kg )")
    .in("workout_id", workoutIds)
    .order("position");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    workoutId: row.workout_id,
    name: row.name,
    imageUrl: row.image_url,
    archived: Boolean(row.archived_at),
    versions: row.workout_exercise_loads.map(toLoadVersion),
  }));
}
