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
  formatShortDate,
  isDay,
} from "@/app/utils/dates";
import { getOccurrence, getRoutineChanges, type DayChanges } from "@/app/utils/occurrences";
import { getCurrentStreak, getLongestStreak } from "@/app/utils/streak";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays, WEEKDAYS } from "@/app/utils/weekdays";
import { getUserTimezone } from "../../dashboard/day-objectives";
import { getGymDays, type GymDay } from "../../dashboard/gym-day";
import { ExerciseImage } from "../../workouts/exercise-image";
import { formatLoad } from "@/app/utils/workout-loads";
import { isWithinWorkoutSwapWindow } from "@/app/utils/workouts";
import { DayWorkoutSwap } from "../day-workout-card";
import { CorrectionList } from "../correction-list";
import { ObjectiveBadge } from "../objective-badge";
import styles from "../objectives.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DayState = "done" | "missed" | "scheduled" | "moved" | "off";

const STATE_LABELS: Record<DayState, string> = {
  done: "feito",
  missed: "faltou",
  scheduled: "programado",
  moved: "mudou de dia ou foi trocado",
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
  const [{ id }, { month: requestedMonth, day: requestedDay }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const supabase = createClient(await cookies());

  const [objectiveResult, checksResult, reschedulesResult, additionsResult, alternativesResult, timezone] = await Promise.all([
    supabase.from("objectives").select("*").eq("id", id).maybeSingle(),
    supabase.from("objective_checks").select("day").eq("objective_id", id).order("day"),
    supabase
      .from("objective_reschedules")
      .select("id, objective_id, from_day, to_day")
      .eq("objective_id", id),
    supabase
      .from("objective_additions")
      .select("id, objective_id, day, replaced_objective_id")
      .or(`objective_id.eq.${id},replaced_objective_id.eq.${id}`),
    supabase
      .from("objective_alternatives")
      .select("objectives!objective_alternatives_alternative_fkey ( title, archived_at )")
      .eq("objective_id", id),
    getUserTimezone(supabase, user.id),
  ]);
  const objective = objectiveResult.data;
  if (!objective) notFound();
  if (checksResult.error) throw checksResult.error;
  if (reschedulesResult.error) throw reschedulesResult.error;
  if (additionsResult.error) throw additionsResult.error;
  if (alternativesResult.error) throw alternativesResult.error;
  const changes: DayChanges = {
    reschedules: reschedulesResult.data.map((row) => ({
      id: row.id,
      objectiveId: row.objective_id,
      fromDay: row.from_day,
      toDay: row.to_day,
    })),
    additions: additionsResult.data.map((row) => ({
      id: row.id,
      objectiveId: row.objective_id,
      day: row.day,
      replacedObjectiveId: row.replaced_objective_id,
    })),
  };
  const { removedDays, addedDays } = getRoutineChanges(id, changes);
  const received = new Set(addedDays);
  const alternativeTitles = alternativesResult.data.flatMap((link) =>
    link.objectives && !link.objectives.archived_at ? [link.objectives.title] : [],
  );

  const today = getUserToday(timezone);
  const checkedDays = new Set(checksResult.data.map((check) => check.day));
  const createdDay = getUserToday(timezone, new Date(objective.created_at));
  const firstCheck = checksResult.data[0]?.day;
  const firstDay = firstCheck && firstCheck < createdDay ? firstCheck : createdDay;

  const streakInput = {
    weekdays: objective.weekdays,
    checkedDays,
    firstDay,
    today,
    removedDays,
    addedDays,
  };
  const currentStreak = getCurrentStreak(streakInput);
  const longestStreak = getLongestStreak(streakInput);

  const thisMonth = `${today.slice(0, 7)}-01`;
  const firstMonth = `${firstDay.slice(0, 7)}-01`;
  const candidate = typeof requestedMonth === "string" ? `${requestedMonth}-01` : "";
  const month =
    isDay(candidate) && candidate >= firstMonth && candidate <= thisMonth ? candidate : thisMonth;

  const getState = (day: string): DayState => {
    if (checkedDays.has(day)) return "done";
    const occurrence = getOccurrence({ id, weekdays: objective.weekdays }, day, changes);
    if (!occurrence.due) return occurrence.movedTo || occurrence.replacedBy ? "moved" : "off";
    if (day >= today) return "scheduled";
    return day >= firstDay || occurrence.reschedule || occurrence.addition ? "missed" : "off";
  };

  const correctable: string[] = [];
  if (!objective.archived_at) {
    const from = getBackfillStart(today) > firstDay ? getBackfillStart(today) : firstDay;
    for (let day = addDays(today, -1); day >= from; day = addDays(day, -1)) {
      if (getState(day) === "missed") correctable.push(day);
    }
  }

  // Task 18: gym objectives show the workout letter on session days and the loads of a picked day.
  const isGym = objective.activity_type === "gym";
  const sessionsResult = isGym
    ? await supabase.from("activity_sessions").select("day, workouts ( label )").eq("objective_id", id)
    : null;
  if (sessionsResult?.error) throw sessionsResult.error;
  const letters = new Map(
    (sessionsResult?.data ?? []).flatMap((session) =>
      session.workouts ? [[session.day, session.workouts.label] as const] : [],
    ),
  );
  const selectedDay =
    isGym && typeof requestedDay === "string" && isDay(requestedDay) && requestedDay <= addDays(today, 14)
      ? requestedDay
      : null;
  const selectedOccurrence = selectedDay
    ? getOccurrence({ id, weekdays: objective.weekdays, createdDay }, selectedDay, changes)
    : null;
  const selectedGym =
    selectedDay && selectedOccurrence && (selectedOccurrence.due || letters.has(selectedDay))
      ? (await getGymDays(supabase, [{ id, reschedule: selectedOccurrence.reschedule }], selectedDay))[id]
      : undefined;

  const meta = [formatWeekdays(objective.weekdays).toLowerCase()];
  if (objective.reschedulable) meta.push("pode mudar de dia");
  if (alternativeTitles.length > 0) meta.push(`pode ser trocado por ${formatList(alternativeTitles)}`);
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
          letters={letters}
          selectedDay={selectedDay}
          objectiveId={id}
          canGoBack={month > firstMonth}
          canGoForward={month < thisMonth}
        />

        <div className={styles.detailSide}>
          {selectedDay && selectedGym && (
            <SelectedDayWorkout
              objective={{ id, title: objective.title, checked: checkedDays.has(selectedDay) }}
              day={selectedDay}
              today={today}
              gym={selectedGym}
              canSwap={Boolean(selectedOccurrence?.due) && isWithinWorkoutSwapWindow(selectedDay, today)}
            />
          )}
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
  letters,
  selectedDay,
  objectiveId,
  canGoBack,
  canGoForward,
}: {
  month: string;
  today: string;
  getState: (day: string) => DayState;
  received: ReadonlySet<string>;
  letters: ReadonlyMap<string, string>;
  selectedDay: string | null;
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
                    <span key={day} role="cell" className={styles.calendarCell}>
                      {letters.has(day) ? (
                        <Link
                          className={styles.calendarDay}
                          href={`/objectives/${objectiveId}?month=${month.slice(0, 7)}&day=${day}`}
                          scroll={false}
                          data-state={getState(day)}
                          data-received={received.has(day) || undefined}
                          data-today={day === today || undefined}
                          aria-current={day === selectedDay ? "date" : undefined}
                          aria-label={`${formatLongDate(day)}: ${STATE_LABELS[getState(day)]}, treino ${letters.get(day)}. Ver cargas do dia`}
                        >
                          {Number(day.slice(8))}
                        </Link>
                      ) : (
                        <span
                          className={styles.calendarDay}
                          data-state={getState(day)}
                          data-received={received.has(day) || undefined}
                          data-today={day === today || undefined}
                          aria-label={`${formatLongDate(day)}: ${STATE_LABELS[getState(day)]}${received.has(day) ? ", realocado ou extra" : ""}`}
                        >
                          {Number(day.slice(8))}
                        </span>
                      )}
                      {letters.has(day) && (
                        <span className={styles.calendarLetter} aria-hidden="true">
                          {letters.get(day)}
                        </span>
                      )}
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
          <li data-state="received">Realocado ou extra</li>
          <li data-state="moved">Mudou ou trocado</li>
        </ul>
      </section>
    </PendingNavigation>
  );
}

function formatList(items: string[]) {
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} ou ${items.at(-1)}`;
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

function SelectedDayWorkout({
  objective,
  day,
  today,
  gym,
  canSwap,
}: {
  objective: { id: string; title: string; checked: boolean };
  day: string;
  today: string;
  gym: GymDay;
  canSwap: boolean;
}) {
  const workout = gym.workouts.find((item) => item.id === gym.workout?.workoutId) ?? null;
  const exercises = workout ? gym.exercises.filter((exercise) => exercise.workoutId === workout.id) : [];
  return (
    <section className={styles.section} aria-labelledby="day-workout-title">
      <h2 id="day-workout-title" className={styles.sectionTitle}>
        {formatShortDate(day)}
        {workout ? ` · Treino ${workout.label}${workout.description ? ` — ${workout.description}` : ""}` : ""}
      </h2>
      {!workout ? (
        <p className={styles.empty}>Sem treino registrado neste dia.</p>
      ) : exercises.length === 0 ? (
        <p className={styles.empty}>Este treino não tinha exercícios.</p>
      ) : (
        <ul className={styles.list}>
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              <Link className={styles.row} href={`/workouts/exercises/${exercise.id}`}>
                <ExerciseImage src={exercise.imageUrl} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{exercise.name}</span>
                  <span className={styles.rowMeta}>
                    {exercise.current ? formatLoad(exercise.current) : "Sem carga neste dia"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.hint}>
        {day === today ? "Cargas de hoje." : `Cargas como estavam em ${formatShortDate(day)}.`}
      </p>
      {workout && (
        <div className={styles.list}>
          <DayWorkoutSwap objective={objective} gym={gym} current={workout} day={day} canSwap={canSwap} />
        </div>
      )}
    </section>
  );
}
