import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/components/BackLink";
import { LoadingStatus, Skeleton, SkeletonList } from "@/app/components/Skeleton";
import { formatNumericDate } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import ui from "../../objectives/objectives.module.css";
import { endPlan } from "../actions";
import { getLoadOn, formatLoad } from "@/app/utils/workout-loads";
import { getPlan, getPlanExercises, type PlanDetail } from "../data";
import { ExerciseImage } from "../exercise-image";
import { PlanActionsPanel } from "../end-plan-panel";
import { Chevron, PlanObjectivePill, WorkoutLetter } from "../workout-letter";
import styles from "../workouts.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PlanPage({ params }: PageProps<"/workouts/[id]">) {
  return (
    <main className={ui.content}>
      <Suspense
        fallback={
          <>
            <BackLink href="/workouts" label="Treinos" />
            <LoadingStatus />
            <div className={ui.skeletonStack} aria-hidden="true">
              <Skeleton width="55%" height="var(--space-6)" />
              <Skeleton width="40%" height="var(--space-3)" />
            </div>
            <SkeletonList rows={3} />
          </>
        }
      >
        <PlanDetailView params={params} />
      </Suspense>
    </main>
  );
}

function exerciseCount(count: number) {
  return count === 1 ? "1 exercício" : `${count} exercícios`;
}

async function PlanDetailView({ params }: Pick<PageProps<"/workouts/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  await requireUser();
  const supabase = createClient(await cookies());
  const plan = await getPlan(supabase, id);
  if (!plan) notFound();
  const active = !plan.endedOn;

  return (
    <>
      <BackLink href="/workouts" label="Treinos" />
      <div className={ui.detailTop}>
        <div>
          <h1 className={ui.title}>{plan.title}</h1>
          <p className={styles.planMeta}>
            <PlanObjectivePill objectiveTitle={plan.objectiveTitle} />
            <span>
              {plan.endedOn
                ? `${formatNumericDate(plan.startedOn)} – ${formatNumericDate(plan.endedOn)} · Encerrada`
                : `desde ${formatNumericDate(plan.startedOn)}`}
            </span>
          </p>
        </div>
        {active && (
          <Link className={ui.editLink} href={`/workouts/${plan.id}/edit`}>
            Editar
          </Link>
        )}
      </div>

      {plan.endedOn ? (
        <EndedPlanWorkouts plan={plan} endedOn={plan.endedOn} />
      ) : (
      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Treinos</h2>
        <ul className={`${ui.list} ${styles.list}`}>
          {plan.workouts.map((workout) => (
            <li key={workout.id}>
              <Link className={styles.workoutRow} href={`/workouts/${plan.id}/${workout.id}`}>
                <WorkoutLetter label={workout.label} />
                <span className={ui.rowText}>
                  <span className={ui.rowTitle}>{workout.description ?? `Treino ${workout.label}`}</span>
                  <span className={ui.rowMeta}>{exerciseCount(plan.exerciseCounts[workout.id] ?? 0)}</span>
                </span>
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      )}

      {active && <PlanActionsPanel planId={plan.id} endAction={endPlan.bind(null, plan.id)} />}
    </>
  );
}

/** RN-30: an ended plan stays readable, with its sessions, removed exercises and final loads. */
async function EndedPlanWorkouts({ plan, endedOn }: { plan: PlanDetail; endedOn: string }) {
  const supabase = createClient(await cookies());
  const workoutIds = plan.workouts.map((workout) => workout.id);
  const [exercises, sessions] = await Promise.all([
    getPlanExercises(supabase, workoutIds),
    workoutIds.length > 0
      ? supabase.from("activity_sessions").select("workout_id").in("workout_id", workoutIds)
      : null,
  ]);
  if (sessions?.error) throw sessions.error;
  const sessionCount = (workoutId: string) =>
    sessions?.data.filter((session) => session.workout_id === workoutId).length ?? 0;

  return (
    <div className={styles.endedWorkouts}>
      <p className={ui.hint}>Ficha encerrada: só leitura. Toque num exercício para ver a evolução.</p>
      {plan.workouts.map((workout) => {
        const items = exercises.filter((exercise) => exercise.workoutId === workout.id);
        const count = sessionCount(workout.id);
        return (
          <section key={workout.id} className={ui.section}>
            <div className={styles.workoutHeader}>
              <WorkoutLetter label={workout.label} />
              <div>
                <h2 className={ui.rowTitle}>{workout.description ?? `Treino ${workout.label}`}</h2>
                <p className={ui.rowMeta}>
                  {count === 1 ? "1 sessão" : `${count} sessões`} · {exerciseCount(items.length)}
                </p>
              </div>
            </div>
            {items.length === 0 ? (
              <p className={ui.empty}>Sem exercícios.</p>
            ) : (
              <ul className={`${ui.list} ${styles.list}`}>
                {items.map((exercise) => {
                  const final = getLoadOn(exercise.versions, endedOn).current;
                  return (
                    <li key={exercise.id}>
                      <Link className={styles.workoutRow} href={`/workouts/exercises/${exercise.id}`}>
                        <ExerciseImage src={exercise.imageUrl} />
                        <span className={ui.rowText}>
                          <span className={`${ui.rowTitle} ${exercise.archived ? styles.ended : ""}`}>
                            {exercise.name}
                          </span>
                          <span className={ui.rowMeta}>{final ? `Final: ${formatLoad(final)}` : "Sem carga"}</span>
                        </span>
                        {exercise.archived && (
                          <span className={styles.pill} data-tone="muted">
                            removido
                          </span>
                        )}
                        <Chevron />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
