import Link from "next/link";
import { Suspense } from "react";
import { LoadingStatus, SkeletonList } from "@/app/components/Skeleton";
import { cookies } from "next/headers";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays } from "@/app/utils/weekdays";
import { getUserToday } from "@/app/utils/dates";
import { getUserTimezone } from "../dashboard/day-objectives";
import { ObjectiveBadge } from "./objective-badge";
import { StreakBadge } from "./streak-badge";
import { getObjectiveStreaks, type ObjectiveStreak } from "./streaks";
import type { Objective } from "./options";
import styles from "./objectives.module.css";

export default function ObjectivesPage() {
  return (
    <main className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>Objetivos</h1>
        <Link className={`${styles.button} ${styles.headerAction}`} href="/objectives/new">
          Novo objetivo
        </Link>
      </header>
      <Suspense
        fallback={
          <section className={styles.section}>
            <LoadingStatus />
            <SkeletonList rows={4} />
          </section>
        }
      >
        <ObjectivesList />
      </Suspense>
    </main>
  );
}

async function ObjectivesList() {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [{ data, error }, timezone] = await Promise.all([
    supabase.from("objectives").select("*").order("created_at", { ascending: true }),
    getUserTimezone(supabase, user.id),
  ]);

  if (error) {
    console.error("Failed to load objectives", error);
    return <p className={styles.error}>Não foi possível carregar seus objetivos.</p>;
  }

  const active = data.filter((objective) => !objective.archived_at);
  const archived = data.filter((objective) => objective.archived_at);
  const streaks = await getObjectiveStreaks(
    supabase,
    active,
    getUserToday(timezone),
    timezone,
  ).catch((streakError: unknown) => {
    console.error("Failed to load streaks", streakError);
    return {};
  });

  return (
    <>
      <section className={styles.section}>
        {active.length > 0 ? (
          <ObjectiveRows objectives={active} streaks={streaks} />
        ) : (
          <p className={styles.empty}>
            Nenhum objetivo ainda. Crie o primeiro para montar sua rotina.
          </p>
        )}
        <Link className={`${styles.button} ${styles.bottomAction}`} href="/objectives/new">
          Novo objetivo
        </Link>
      </section>

      {archived.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Arquivados</h2>
          <ObjectiveRows objectives={archived} />
        </section>
      )}
    </>
  );
}

function ObjectiveRows({
  objectives,
  streaks = {},
}: {
  objectives: Objective[];
  streaks?: Record<string, ObjectiveStreak>;
}) {
  return (
    <ul className={`${styles.list} ${styles.cardGrid}`}>
      {objectives.map((objective) => (
        <li key={objective.id}>
          <Link className={styles.row} href={`/objectives/${objective.id}`}>
            <ObjectiveBadge color={objective.color} icon={objective.icon} />
            <span className={styles.rowText}>
              <span className={styles.rowTitleLine}>
                <span className={styles.rowTitle}>{objective.title}</span>
                <StreakBadge count={streaks[objective.id]?.current ?? 0} />
              </span>
              <span className={styles.rowMeta}>
                {formatWeekdays(objective.weekdays)}
                {objective.reschedulable && " · Pode mudar de dia"}
              </span>
            </span>
            <svg className={styles.rowChevron} viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
