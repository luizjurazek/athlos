import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LoadingStatus, SkeletonList } from "@/app/components/Skeleton";
import { formatDayMonth } from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import ui from "../objectives/objectives.module.css";
import { getPlans, type PlanSummary } from "./data";
import { Chevron, PlanObjectivePill, WorkoutLetter } from "./workout-letter";
import styles from "./workouts.module.css";

export default function WorkoutsPage() {
  return (
    <main className={ui.content}>
      <header className={ui.header}>
        <div>
          <h1 className={ui.title}>Treinos</h1>
          <p className={styles.subtitle}>Suas fichas de academia</p>
        </div>
        <Link className={`${ui.button} ${ui.headerAction}`} href="/workouts/new">
          Nova ficha
        </Link>
      </header>
      <Suspense
        fallback={
          <section className={ui.section}>
            <LoadingStatus />
            <SkeletonList rows={3} badge={false} />
          </section>
        }
      >
        <PlansList />
      </Suspense>
    </main>
  );
}

function workoutCount(plan: PlanSummary) {
  return plan.workouts.length === 1 ? "1 treino" : `${plan.workouts.length} treinos`;
}

async function PlansList() {
  await requireUser();
  const supabase = createClient(await cookies());
  let plans: PlanSummary[];
  try {
    plans = await getPlans(supabase);
  } catch (error) {
    console.error("Failed to load workout plans", error);
    return <p className={ui.error}>Não foi possível carregar suas fichas.</p>;
  }

  if (plans.length === 0) {
    return (
      <>
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
            </svg>
          </span>
          <p className={styles.emptyTitle}>Nenhuma ficha ainda</p>
          <p className={styles.emptyText}>
            Monte os treinos A, B, C… com os exercícios e as cargas. Ligue a um objetivo de academia
            para ver o treino do dia no Hoje.
          </p>
        </div>
        <Link className={`${ui.button} ${ui.bottomAction}`} href="/workouts/new">
          Criar ficha
        </Link>
      </>
    );
  }

  const active = plans.filter((plan) => !plan.endedOn);
  const ended = plans.filter((plan) => plan.endedOn);

  return (
    <>
      {active.length > 0 && (
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Ativas</h2>
          <ul className={`${ui.list} ${styles.list}`}>
            {active.map((plan) => (
              <li key={plan.id}>
                <Link className={ui.row} href={`/workouts/${plan.id}`}>
                  <span className={ui.rowText}>
                    <span className={ui.rowTitle}>{plan.title}</span>
                    <span className={styles.planMeta}>
                      <PlanObjectivePill objectiveTitle={plan.objectiveTitle} />
                      <span>
                        desde {formatDayMonth(plan.startedOn)} · {workoutCount(plan)}
                      </span>
                    </span>
                    <span className={styles.letters}>
                      {plan.workouts.map((workout) => (
                        <WorkoutLetter key={workout.id} label={workout.label} small />
                      ))}
                    </span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link className={`${ui.button} ${ui.bottomAction}`} href="/workouts/new">
        Nova ficha
      </Link>

      {ended.length > 0 && (
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Encerradas</h2>
          <ul className={`${ui.list} ${styles.list}`}>
            {ended.map((plan) => (
              <li key={plan.id}>
                <Link className={ui.row} href={`/workouts/${plan.id}`}>
                  <span className={ui.rowText}>
                    <span className={`${ui.rowTitle} ${styles.ended}`}>{plan.title}</span>
                    <span className={ui.rowMeta}>
                      {plan.objectiveTitle ?? "Livre"} · {formatDayMonth(plan.startedOn)} –{" "}
                      {formatDayMonth(plan.endedOn ?? plan.startedOn)} · {workoutCount(plan)}
                    </span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

