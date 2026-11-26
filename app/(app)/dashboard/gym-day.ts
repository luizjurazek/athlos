import { getLoadOn, toLoadVersion, type LoadVersion } from "@/app/utils/workout-loads";
import type { Reschedule } from "@/app/utils/occurrences";
import type { createClient } from "@/app/utils/supabase/server";
import { getWorkoutForDay, type DayWorkout } from "@/app/utils/workouts";

type Client = ReturnType<typeof createClient>;

export type GymWorkout = { id: string; label: string; description: string | null };

export type GymExercise = {
  id: string;
  workoutId: string;
  name: string;
  imageUrl: string | null;
  current: LoadVersion | null;
  previous: LoadVersion | null;
};

export type GymDay = {
  planId: string | null;
  planTitle: string | null;
  workouts: GymWorkout[];
  workout: DayWorkout;
  /** What the schedule alone gives for the day (RN-28 without the explicit choice). */
  scheduled: DayWorkout;
  /** A session already exists for the day (chosen, extra or checked). */
  hasSession: boolean;
  exercises: GymExercise[];
};

type PlanRow = {
  id: string;
  title: string;
  objective_id: string | null;
  started_on: string;
  workouts: {
    id: string;
    label: string;
    description: string | null;
    position: number;
    workout_exercises: {
      id: string;
      name: string;
      image_url: string | null;
      position: number;
      created_at: string;
      archived_at: string | null;
      workout_exercise_loads: { effective_from: string; sets: number; reps: number; load_kg: number | null }[];
    }[];
  }[];
};

/** Plans linked to these objectives that cover the day (RN-25: at most one each). */
async function getPlansCovering(supabase: Client, objectiveIds: string[], day: string, withExercises: boolean) {
  if (objectiveIds.length === 0) return new Map<string, PlanRow>();
  const exercises = withExercises
    ? ", workout_exercises ( id, name, image_url, position, created_at, archived_at, workout_exercise_loads ( effective_from, sets, reps, load_kg ) )"
    : "";
  const { data, error } = await supabase
    .from("workout_plans")
    .select(`id, title, objective_id, started_on, workouts ( id, label, description, position${exercises} )`)
    .in("objective_id", objectiveIds)
    .lte("started_on", day)
    .or(`ended_on.is.null,ended_on.gte.${day}`)
    .returns<PlanRow[]>();
  if (error) throw error;
  const byObjective = new Map<string, PlanRow>();
  for (const plan of data) {
    const current = plan.objective_id ? byObjective.get(plan.objective_id) : undefined;
    if (plan.objective_id && (!current || plan.started_on > current.started_on)) {
      byObjective.set(plan.objective_id, plan);
    }
  }
  return byObjective;
}

function toWorkouts(plan: PlanRow): GymWorkout[] {
  return [...plan.workouts]
    .sort((a, b) => a.position - b.position)
    .map(({ id, label, description }) => ({ id, label, description }));
}

/** Everything Hoje shows for the gym objectives of a day (task 17), loaded only for gym objectives. */
export async function getGymDays(
  supabase: Client,
  objectives: { id: string; reschedule: Reschedule | null }[],
  day: string,
): Promise<Record<string, GymDay>> {
  if (objectives.length === 0) return {};
  const ids = objectives.map((objective) => objective.id);
  const [plans, sessions] = await Promise.all([
    getPlansCovering(supabase, ids, day, true),
    supabase.from("activity_sessions").select("objective_id, workout_id").eq("day", day).in("objective_id", ids),
  ]);
  if (sessions.error) throw sessions.error;
  const planIds = [...plans.values()].map((plan) => plan.id);
  const schedule = planIds.length
    ? await supabase.from("workout_schedule").select("plan_id, weekday, workout_id").in("plan_id", planIds)
    : null;
  if (schedule?.error) throw schedule.error;

  const result: Record<string, GymDay> = {};
  for (const objective of objectives) {
    const plan = plans.get(objective.id);
    const session = sessions.data.find((item) => item.objective_id === objective.id);
    if (!plan) {
      result[objective.id] = {
        planId: null,
        planTitle: null,
        workouts: [],
        workout: null,
        scheduled: null,
        hasSession: Boolean(session),
        exercises: [],
      };
      continue;
    }
    const workoutIds = new Set(plan.workouts.map((workout) => workout.id));
    const planSchedule = (schedule?.data ?? [])
      .filter((row) => row.plan_id === plan.id)
      .map((row) => ({ weekday: row.weekday, workoutId: row.workout_id }));
    const workout = getWorkoutForDay(day, {
      schedule: planSchedule,
      // A session pointing to another plan's workout (older plan) is ignored for this one.
      sessionWorkoutId: session?.workout_id && workoutIds.has(session.workout_id) ? session.workout_id : null,
      occurrence: objective,
    });
    const scheduled = getWorkoutForDay(day, { schedule: planSchedule, sessionWorkoutId: null, occurrence: objective });
    result[objective.id] = {
      planId: plan.id,
      planTitle: plan.title,
      workouts: toWorkouts(plan),
      workout,
      scheduled,
      hasSession: Boolean(session),
      exercises: plan.workouts.flatMap((item) =>
        [...item.workout_exercises]
          .filter((exercise) => !exercise.archived_at)
          .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
          .map((exercise) => {
            const { current, previous } = getLoadOn(exercise.workout_exercise_loads.map(toLoadVersion), day);
            return {
              id: exercise.id,
              workoutId: item.id,
              name: exercise.name,
              imageUrl: exercise.image_url,
              current,
              previous,
            };
          }),
      ),
    };
  }
  return result;
}

/** RN-35: workouts each gym option can bring to a day; null = no plan covers the day. */
export async function getGymOptionWorkouts(
  supabase: Client,
  objectiveIds: string[],
  day: string,
): Promise<Record<string, GymWorkout[] | null>> {
  const plans = await getPlansCovering(supabase, objectiveIds, day, false);
  return Object.fromEntries(
    objectiveIds.map((id) => {
      const plan = plans.get(id);
      return [id, plan ? toWorkouts(plan) : null];
    }),
  );
}
