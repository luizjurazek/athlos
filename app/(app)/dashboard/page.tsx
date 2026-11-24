import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import {
  addDays,
  formatLongDate,
  formatShortDate,
  getUserToday,
  getWeekday,
} from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays, WEEKDAYS } from "@/app/utils/weekdays";
import type { Objective } from "../objectives/options";
import {
  getObjectivesForDay,
  getUserTimezone,
  isScheduledOn,
} from "./day-objectives";
import { GoalsSummary } from "./goals-summary";
import { TodayView } from "./today-view";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  return (
    <main className={styles.content}>
      <Suspense fallback={<Header subtitle="Carregando..." />}>
        <TodayContent />
      </Suspense>
    </main>
  );
}

function Header({
  subtitle,
  action,
}: {
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>Hoje</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

async function TodayContent() {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const day = getUserToday(await getUserTimezone(supabase, user.id));
  const dateLabel = formatLongDate(day);

  let data;
  try {
    data = await getObjectivesForDay(supabase, day);
  } catch (error) {
    console.error("Failed to load today's objectives", error);
    return (
      <>
        <Header subtitle={dateLabel} />
        <p className={styles.error}>
          Não foi possível carregar o dia de hoje. Atualize a página.
        </p>
      </>
    );
  }

  if (data.active.length === 0) {
    return (
      <>
        <Header
          subtitle={dateLabel}
          action={
            <Link
              className={`${styles.button} ${styles.headerAction}`}
              href="/objectives/new"
            >
              <PlusIcon />
              Novo objetivo
            </Link>
          }
        />
        <EmptyCard icon={<TargetIcon />} title="Nenhum objetivo ainda">
          Crie o primeiro para montar sua rotina. Ele aparece aqui nos dias da
          semana que você escolher.
        </EmptyCard>
        <Link
          className={`${styles.button} ${styles.bottomAction}`}
          href="/objectives/new"
        >
          <PlusIcon />
          Novo objetivo
        </Link>
      </>
    );
  }

  if (data.scheduled.length === 0) {
    const next = findNextObjective(data.active, day);
    return (
      <>
        <Header subtitle={dateLabel} />
        <EmptyCard icon={<CalendarIcon />} title="Nada programado para hoje">
          {describeFreeDay(data.active, day)}
          {next && (
            <>
              {" "}
              O próximo é{" "}
              <strong className={styles.emptyStrong}>
                {next.objective.title}
              </strong>
              , {next.when}.
            </>
          )}
          <Link className={styles.emptyLink} href="/objectives">
            Ver objetivos
          </Link>
        </EmptyCard>
        <aside className={styles.aside}>
          <Suspense fallback={null}>
            <GoalsSummary today={day} />
          </Suspense>
        </aside>
      </>
    );
  }

  return (
    <>
      <Header subtitle={dateLabel} />
      <TodayView
        day={day}
        objectives={data.scheduled}
        goals={
          <Suspense fallback={null}>
            <GoalsSummary today={day} />
          </Suspense>
        }
      />
    </>
  );
}

function describeFreeDay(active: Objective[], day: string) {
  const schedules = new Set(
    active.map((objective) => formatWeekdays(objective.weekdays)),
  );
  const count = active.length;
  if (schedules.size === 1) {
    const schedule = [...schedules][0].toLowerCase();
    return count === 1
      ? `Seu objetivo é de ${schedule}.`
      : `Seus ${count} objetivos são de ${schedule}.`;
  }
  return `Nenhum dos seus ${count} objetivos é de ${WEEKDAYS[getWeekday(day)].long.toLowerCase()}.`;
}

function findNextObjective(active: Objective[], day: string) {
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = addDays(day, offset);
    const objective = active.find((item) => isScheduledOn(item, candidate));
    if (objective) {
      const date = formatShortDate(candidate);
      return { objective, when: offset === 1 ? `amanhã (${date})` : date };
    }
  }
  return null;
}

function EmptyCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        {icon}
      </span>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyText}>{children}</p>
    </section>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className={styles.buttonIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
