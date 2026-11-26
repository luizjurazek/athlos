import type { createClient } from "@/app/utils/supabase/server";

type Client = ReturnType<typeof createClient>;

export type AlternativeOption = { id: string; title: string };

/** Other active objectives plus any already linked as an alternative, whatever their status (RN-21). */
export async function getAlternativeOptions(supabase: Client, objectiveId?: string) {
  const [objectivesResult, linksResult] = await Promise.all([
    supabase.from("objectives").select("id, title, archived_at").order("created_at"),
    objectiveId
      ? supabase
          .from("objective_alternatives")
          .select("alternative_id")
          .eq("objective_id", objectiveId)
      : null,
  ]);
  if (objectivesResult.error) throw objectivesResult.error;
  if (linksResult?.error) throw linksResult.error;

  const linkedIds = linksResult?.data.map((link) => link.alternative_id) ?? [];
  const options: AlternativeOption[] = objectivesResult.data
    .filter(
      (objective) =>
        objective.id !== objectiveId &&
        (!objective.archived_at || linkedIds.includes(objective.id)),
    )
    .map(({ id, title }) => ({ id, title }));
  return { options, linkedIds };
}

export type GymFormWorkout = { id: string; label: string; description: string | null };

export type GymFormContext = {
  /** Weekdays already used by another active gym objective (RN-33). */
  takenDays: { weekday: number; title: string }[];
  /** Free active plans plus the one linked to this objective, if any, with their workouts. */
  plans: { id: string; title: string; workouts: GymFormWorkout[] }[];
  linkedPlan: { id: string; title: string; startedOn: string } | null;
  /** The linked plan's workout per weekday. */
  schedule: { weekday: number; workoutId: string }[];
  today: string;
};

export async function getGymFormContext(
  supabase: Client,
  today: string,
  objectiveId?: string,
): Promise<GymFormContext> {
  const [objectives, plans] = await Promise.all([
    supabase
      .from("objectives")
      .select("id, title, weekdays")
      .eq("activity_type", "gym")
      .is("archived_at", null),
    supabase
      .from("workout_plans")
      .select("id, title, objective_id, started_on, workouts ( id, label, description, position )")
      .is("ended_on", null)
      .order("started_on", { ascending: false }),
  ]);
  if (objectives.error) throw objectives.error;
  if (plans.error) throw plans.error;

  const takenDays = objectives.data
    .filter((objective) => objective.id !== objectiveId)
    .flatMap((objective) => objective.weekdays.map((weekday) => ({ weekday, title: objective.title })));
  const linked = objectiveId ? plans.data.find((plan) => plan.objective_id === objectiveId) : undefined;
  const schedule = linked
    ? await supabase.from("workout_schedule").select("weekday, workout_id").eq("plan_id", linked.id)
    : null;
  if (schedule?.error) throw schedule.error;
  return {
    takenDays,
    plans: plans.data
      .filter((plan) => plan.objective_id === null || plan.id === linked?.id)
      .map(({ id, title, workouts }) => ({
        id,
        title,
        workouts: [...workouts]
          .sort((a, b) => a.position - b.position)
          .map(({ id: workoutId, label, description }) => ({ id: workoutId, label, description })),
      })),
    linkedPlan: linked ? { id: linked.id, title: linked.title, startedOn: linked.started_on } : null,
    schedule: (schedule?.data ?? []).map((row) => ({ weekday: row.weekday, workoutId: row.workout_id })),
    today,
  };
}
