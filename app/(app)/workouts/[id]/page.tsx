import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/app/components/BackLink";
import { LoadingStatus, Skeleton, SkeletonList } from "@/app/components/Skeleton";
import { formatNumericDate } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { WEEKDAYS } from "@/app/utils/weekdays";
import ui from "../../objectives/objectives.module.css";
import { endPlan } from "../actions";
import { getPlan, type PlanDetail } from "../data";
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

      <div className={styles.detailColumns}>
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

        <ScheduleSection plan={plan} />
      </div>

      {active && <PlanActionsPanel planId={plan.id} endAction={endPlan.bind(null, plan.id)} />}
    </>
  );
}

function ScheduleSection({ plan }: { plan: PlanDetail }) {
  if (!plan.objectiveId || !plan.objectiveWeekdays) {
    return (
      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Agenda</h2>
        <p className={ui.empty}>
          Agenda precisa de um objetivo. Ficha livre não tem dias fixos nem aparece no Hoje.
        </p>
        {!plan.endedOn && (
          <Link className={ui.editLink} href={`/workouts/${plan.id}/edit`}>
            Vincular a um objetivo
          </Link>
        )}
      </section>
    );
  }

  const days = WEEKDAYS.filter((day) => plan.objectiveWeekdays?.includes(day.value));
  return (
    <section className={ui.section}>
      <div className={styles.sectionHeader}>
        <h2 className={ui.sectionTitle}>Agenda · dias de {plan.objectiveTitle}</h2>
        {!plan.endedOn && (
          <Link className={styles.textLink} href={`/workouts/${plan.id}/schedule`}>
            Editar agenda
          </Link>
        )}
      </div>
      <ul className={`${ui.list} ${styles.list}`}>
        {days.map((day) => {
          const entry = plan.schedule.find((item) => item.weekday === day.value);
          const workout = entry && plan.workouts.find((item) => item.id === entry.workoutId);
          return (
            <li key={day.value} className={styles.scheduleRow}>
              <span className={styles.scheduleDay}>{day.long}</span>
              {workout ? (
                <span className={styles.scheduleValue}>
                  <WorkoutLetter label={workout.label} small />
                  <span>{workout.description ?? `Treino ${workout.label}`}</span>
                </span>
              ) : (
                <span className={`${styles.scheduleValue} ${styles.scheduleNone}`}>Sem treino fixo</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className={ui.hint}>&quot;Sem treino fixo&quot; faz o Hoje perguntar qual treino fazer no dia.</p>
    </section>
  );
}
