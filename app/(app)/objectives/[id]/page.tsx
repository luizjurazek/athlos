import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/BackLink";
import { PendingLink, PendingNavigation, PendingRegion } from "@/app/components/PendingNavigation";
import {
  LoadingStatus,
  Skeleton,
  SkeletonCard,
  SkeletonList,
} from "@/app/components/Skeleton";
import { CHECK_BACKFILL_DAYS, getBackfillStart } from "@/app/utils/checks";
import {
  addDays,
  addMonths,
  formatLongDate,
  formatMonthYear,
  getUserToday,
  getWeekday,
  isDay,
} from "@/app/utils/dates";
import { getOccurrence, type Reschedule } from "@/app/utils/occurrences";
import { getCurrentStreak, getLongestStreak } from "@/app/utils/streak";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays, WEEKDAYS } from "@/app/utils/weekdays";
import { getUserTimezone } from "../../dashboard/day-objectives";
import { CorrectionList } from "../correction-list";
import { ObjectiveBadge } from "../objective-badge";
import styles from "../objectives.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DayState = "done" | "missed" | "scheduled" | "moved" | "off";

const STATE_LABELS: Record<DayState, string> = {
  done: "feito",
  missed: "faltou",
  scheduled: "programado",
  moved: "mudou de dia",
  off: "não programado",
};

function ObjectiveDetailSkeleton() {
  return (
    <>
      <LoadingStatus />
      <div className={styles.detailHeader} aria-hidden="true">
        <Skeleton width="var(--space-10)" height="var(--space-10)" radius="var(--radius-md)" />
        <div className={styles.skeletonStack}>
          <Skeleton width="55%" height="var(--space-6)" />
          <Skeleton width="40%" height="var(--space-3)" />
        </div>
      </div>
      <div className={styles.detailColumns}>
        <SkeletonCard lines={1} height="calc(var(--space-12) * 7)" />
        <div className={styles.detailSide}>
          <div className={styles.streaks}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonList rows={2} badge={false} />
        </div>
      </div>
    </>
  );
}

export default function ObjectivePage({ params, searchParams }: PageProps<"/objectives/[id]">) {
  return (
    <main className={styles.content}>
      <Suspense
        fallback={
          <>
            <BackLink href="/objectives" label="Objetivos" />
            <ObjectiveDetailSkeleton />
          </>
        }
      >
        <ObjectiveDetail params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ObjectiveDetail({
  params,
  searchParams,
}: Pick<PageProps<"/objectives/[id]">, "params" | "searchParams">) {
  const [{ id }, { month: requestedMonth }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const supabase = createClient(await cookies());

  const [objectiveResult, checksResult, reschedulesResult, timezone] = await Promise.all([
    supabase.from("objectives").select("*").eq("id", id).maybeSingle(),
    supabase.from("objective_checks").select("day").eq("objective_id", id).order("day"),
    supabase
      .from("objective_reschedules")
      .select("id, objective_id, from_day, to_day")
      .eq("objective_id", id),
    getUserTimezone(supabase, user.id),
  ]);
  const objective = objectiveResult.data;
  if (!objective) notFound();
  if (checksResult.error) throw checksResult.error;
  if (reschedulesResult.error) throw reschedulesResult.error;
  const reschedules: Reschedule[] = reschedulesResult.data.map((row) => ({
    id: row.id,
    objectiveId: row.objective_id,
    fromDay: row.from_day,
    toDay: row.to_day,
  }));
  const received = new Set(reschedules.map((item) => item.toDay));

  const today = getUserToday(timezone);
  const checkedDays = new Set(checksResult.data.map((check) => check.day));
  const createdDay = getUserToday(timezone, new Date(objective.created_at));
  const firstCheck = checksResult.data[0]?.day;
  const firstDay = firstCheck && firstCheck < createdDay ? firstCheck : createdDay;

  const streakInput = { weekdays: objective.weekdays, checkedDays, firstDay, today, reschedules };
  const currentStreak = getCurrentStreak(streakInput);
  const longestStreak = getLongestStreak(streakInput);

  const thisMonth = `${today.slice(0, 7)}-01`;
  const firstMonth = `${firstDay.slice(0, 7)}-01`;
  const candidate = typeof requestedMonth === "string" ? `${requestedMonth}-01` : "";
  const month =
    isDay(candidate) && candidate >= firstMonth && candidate <= thisMonth ? candidate : thisMonth;

  const getState = (day: string): DayState => {
    if (checkedDays.has(day)) return "done";
    const occurrence = getOccurrence({ id, weekdays: objective.weekdays }, day, reschedules);
    if (!occurrence.due) {
      const movedAway = reschedules.some((item) => item.fromDay === day);
      return movedAway ? "moved" : "off";
    }
    if (day >= today) return "scheduled";
    return day >= firstDay || occurrence.reschedule ? "missed" : "off";
  };

  const correctable: string[] = [];
  if (!objective.archived_at) {
    const from = getBackfillStart(today) > firstDay ? getBackfillStart(today) : firstDay;
    for (let day = addDays(today, -1); day >= from; day = addDays(day, -1)) {
      if (getState(day) === "missed") correctable.push(day);
    }
  }

  const meta = [formatWeekdays(objective.weekdays).toLowerCase()];
  if (objective.reschedulable) meta.push("pode mudar de dia");
  if (objective.archived_at) meta.push("arquivado");

  return (
    <>
      <div className={styles.detailTop}>
        <BackLink href="/objectives" label="Objetivos" />
        <Link className={styles.editLink} href={`/objectives/${id}/edit`}>
          Editar
        </Link>
      </div>

      <header className={styles.detailHeader}>
        <span className={styles.detailBadge}>
          <ObjectiveBadge color={objective.color} icon={objective.icon} />
        </span>
        <div>
          <h1 className={styles.title}>{objective.title}</h1>
          <p className={styles.detailMeta}>{meta.join(" · ")}</p>
        </div>
      </header>

      <div className={styles.detailColumns}>
        <Calendar
          month={month}
          today={today}
          getState={getState}
          received={received}
          objectiveId={id}
          canGoBack={month > firstMonth}
          canGoForward={month < thisMonth}
        />

        <div className={styles.detailSide}>
          <div className={styles.streaks}>
            <div className={styles.streakCard}>
              <p className={styles.streakValue}>
                <svg className={styles.flameIcon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8Z" />
                </svg>
                {currentStreak}
              </p>
              <p className={styles.streakLabel}>Sequência atual</p>
            </div>
            <div className={styles.streakCard}>
              <p className={styles.streakValue}>
                <svg className={styles.trophyIcon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4" />
                </svg>
                {longestStreak}
              </p>
              <p className={styles.streakLabel}>Maior sequência</p>
            </div>
          </div>

          {!objective.archived_at && (
            <section className={styles.section} aria-labelledby="corrections-title">
              <h2 id="corrections-title" className={styles.sectionTitle}>
                Dá para corrigir
              </h2>
              {correctable.length > 0 ? (
                <CorrectionList objectiveId={id} days={correctable} />
              ) : (
                <p className={styles.empty}>Nada para corrigir nos últimos {CHECK_BACKFILL_DAYS} dias.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Calendar({
  month,
  today,
  getState,
  received,
  objectiveId,
  canGoBack,
  canGoForward,
}: {
  month: string;
  today: string;
  getState: (day: string) => DayState;
  received: ReadonlySet<string>;
  objectiveId: string;
  canGoBack: boolean;
  canGoForward: boolean;
}) {
  const nextMonth = addMonths(month, 1);
  const days: string[] = [];
  for (let day = month; day < nextMonth; day = addDays(day, 1)) days.push(day);
  const leading = getWeekday(month);
  const monthHref = (day: string) => `/objectives/${objectiveId}?month=${day.slice(0, 7)}`;

  return (
    <PendingNavigation>
      <section className={styles.calendar} aria-labelledby="calendar-title">
        <div className={styles.calendarHeader}>
          <h2 id="calendar-title" className={styles.calendarTitle}>
            {formatMonthYear(month)}
          </h2>
          <div className={styles.calendarNav}>
            <MonthLink href={canGoBack ? monthHref(addMonths(month, -1)) : null} label="Mês anterior">
              <path d="m15 5-7 7 7 7" />
            </MonthLink>
            <MonthLink href={canGoForward ? monthHref(nextMonth) : null} label="Próximo mês">
              <path d="m9 5 7 7-7 7" />
            </MonthLink>
          </div>
        </div>

        <PendingRegion>
          <div className={styles.calendarGrid} role="table" aria-labelledby="calendar-title">
            <div role="row" className={styles.calendarRow}>
              {WEEKDAYS.map((weekday) => (
                <span key={weekday.value} role="columnheader" className={styles.calendarWeekday}>
                  <abbr title={weekday.long}>{weekday.short}</abbr>
                </span>
              ))}
            </div>
            {chunkWeeks(leading, days).map((week, index) => (
              <div key={index} role="row" className={styles.calendarRow}>
                {week.map((day, cell) =>
                  day ? (
                    <span
                      key={day}
                      role="cell"
                      className={styles.calendarDay}
                      data-state={getState(day)}
                      data-received={received.has(day) || undefined}
                      data-today={day === today || undefined}
                      aria-label={`${formatLongDate(day)}: ${STATE_LABELS[getState(day)]}${received.has(day) ? ", recebeu realocação" : ""}`}
                    >
                      {Number(day.slice(8))}
                    </span>
                  ) : (
                    <span key={`empty-${cell}`} role="cell" />
                  ),
                )}
              </div>
            ))}
          </div>
      </PendingRegion>

        <ul className={styles.calendarLegend}>
          <li data-state="done">Feito</li>
          <li data-state="missed">Faltou</li>
          <li data-state="scheduled">Programado</li>
          <li data-state="received">Recebeu realocação</li>
          <li data-state="moved">Mudou de dia</li>
        </ul>
      </section>
    </PendingNavigation>
  );
}

function chunkWeeks(leading: number, days: string[]) {
  const cells: (string | null)[] = [...Array<null>(leading).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function MonthLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const icon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
  if (!href) {
    return (
      <span className={styles.monthLink} aria-disabled="true" aria-label={label}>
        {icon}
      </span>
    );
  }
  return (
    <PendingLink className={styles.monthLink} href={href} pendingKey={href} aria-label={label}>
      {icon}
    </PendingLink>
  );
}
