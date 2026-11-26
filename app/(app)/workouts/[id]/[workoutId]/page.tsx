import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/components/BackLink";
import { LoadingStatus, Skeleton, SkeletonList } from "@/app/components/Skeleton";
import { getUserToday } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { getUserTimezone } from "../../../dashboard/day-objectives";
import ui from "../../../objectives/objectives.module.css";
import { getWorkoutDetail } from "../../data";
import { WorkoutExercises } from "../../workout-exercises";
import { WorkoutLetter } from "../../workout-letter";
import styles from "../../workouts.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function WorkoutPage({ params }: PageProps<"/workouts/[id]/[workoutId]">) {
  return (
    <main className={ui.content}>
      <Suspense
        fallback={
          <>
            <LoadingStatus />
            <div className={ui.skeletonStack} aria-hidden="true">
              <Skeleton width="55%" height="var(--space-6)" />
              <Skeleton width="35%" height="var(--space-3)" />
            </div>
            <SkeletonList rows={4} />
          </>
        }
      >
        <WorkoutDetailView params={params} />
      </Suspense>
    </main>
  );
}

async function WorkoutDetailView({ params }: Pick<PageProps<"/workouts/[id]/[workoutId]">, "params">) {
  const { id, workoutId } = await params;
  if (!UUID.test(id) || !UUID.test(workoutId)) notFound();
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [workout, timezone] = await Promise.all([
    getWorkoutDetail(supabase, id, workoutId),
    getUserTimezone(supabase, user.id),
  ]);
  if (!workout) notFound();
  const today = getUserToday(timezone);
  const count = workout.exercises.length;

  return (
    <>
      <BackLink href={`/workouts/${id}`} label={workout.plan.title} />
      <div className={styles.workoutHeader}>
        <WorkoutLetter label={workout.label} />
        <div>
          <h1 className={ui.title}>{workout.description ?? `Treino ${workout.label}`}</h1>
          <p className={styles.subtitle}>
            Treino {workout.label} · {count === 1 ? "1 exercício" : `${count} exercícios`}
            {workout.plan.endedOn && " · ficha encerrada"}
          </p>
        </div>
      </div>
      <WorkoutExercises
        workout={{ id: workout.id, label: workout.label, description: workout.description }}
        exercises={workout.exercises}
        today={today}
        loadDay={workout.plan.startedOn > today ? workout.plan.startedOn : today}
        readOnly={Boolean(workout.plan.endedOn)}
      />
    </>
  );
}
