import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { isWithinBackfill } from "@/app/utils/checks";
import {
  addDays,
  formatLongDate,
  formatShortDate,
  getUserToday,
  getWeekday,
  isDay,
} from "@/app/utils/dates";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays, WEEKDAYS } from "@/app/utils/weekdays";
import type { Objective } from "../objectives/options";
import {
  getDayStrip,
  getObjectivesForDay,
  getUserTimezone,
  isScheduledOn,
  type StripDay,
} from "./day-objectives";
import { GoalsSummary } from "./goals-summary";
import { TodayView } from "./today-view";
import styles from "./dashboard.module.css";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <main className={styles.content}>
      <Suspense fallback={<Header title="Hoje" subtitle="Carregando..." />}>
        <TodayContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function Header({
  title,
  subtitle,
  action,
  strip,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  strip?: ReactNode;
}) {
  return (
    <div className={styles.headerArea}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {action}
      </header>
      {strip}
    </div>
  );
}

function getDayTitle(day: string, today: string) {
  if (day === today) return "Hoje";
  if (day === addDays(today, -1)) return "Ontem";
  return WEEKDAYS[getWeekday(day)].long;
}

async function TodayContent({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [{ day: requested }, timezone] = await Promise.all([
    searchParams,
    getUserTimezone(supabase, user.id),
  ]);
  const today = getUserToday(timezone);
  const day =
    typeof requested === "string" && isDay(requested) && isWithinBackfill(requested, today)
      ? requested
      : today;
  const title = getDayTitle(day, today);
  const dateLabel = formatLongDate(day);

  let data;
  let strip: StripDay[];
  try {
    data = await getObjectivesForDay(supabase, day, timezone);
    strip = await getDayStrip(supabase, today, timezone, data.active);
  } catch (error) {
    console.error("Failed to load the day's objectives", error);
    return (
      <>
        <Header title={title} subtitle={dateLabel} />
        <p className={styles.error}>
          Não foi possível carregar este dia. Atualize a página.
        </p>
      </>
    );
  }

  if (data.active.length === 0) {
    return (
      <>
        <Header
          title={title}
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

  const header = (
    <Header
      title={title}
      subtitle={dateLabel}
      strip={<DayStrip days={strip} selected={day} today={today} />}
    />
  );
  const goals = (
    <Suspense fallback={null}>
      <GoalsSummary today={today} />
    </Suspense>
  );

  if (data.scheduled.length === 0) {
    const next = day === today ? findNextObjective(data.active, day) : null;
    return (
      <>
        {header}
        <EmptyCard
          icon={<CalendarIcon />}
          title={day === today ? "Nada programado para hoje" : "Nada programado neste dia"}
        >
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
        <aside className={styles.aside}>{goals}</aside>
      </>
    );
  }

  return (
    <>
      {header}
      <TodayView key={day} day={day} objectives={data.scheduled} goals={goals} />
    </>
  );
}

function DayStrip({ days, selected, today }: { days: StripDay[]; selected: string; today: string }) {
  return (
    <nav className={styles.strip} aria-label="Dias que ainda dá para marcar">
      {days.map(({ day, scheduled, done }) => {
        const state = scheduled === 0 ? "none" : done >= scheduled ? "done" : "open";
        const status =
          state === "none" ? "nada programado" : `${done} de ${scheduled} feitos`;
        return (
          <Link
            key={day}
            href={day === today ? "/dashboard" : `/dashboard?day=${day}`}
            scroll={false}
            className={styles.stripDay}
            aria-current={day === selected ? "date" : undefined}
            aria-label={`${formatLongDate(day)}, ${status}`}
          >
            <span className={styles.stripWeekday} aria-hidden="true">
              {WEEKDAYS[getWeekday(day)].short}
            </span>
            <span className={styles.stripDate} aria-hidden="true">
              {Number(day.slice(8))}
            </span>
            <span className={styles.stripDot} data-state={state} aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
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
