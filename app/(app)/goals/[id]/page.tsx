import Link from "next/link";
import { Suspense } from "react";
import { LoadingStatus, Skeleton, SkeletonCard, SkeletonList } from "@/app/components/Skeleton";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/BackLink";
import { ProgressBar } from "@/app/components/ProgressBar";
import {
  formatDayMonth,
  formatNumericDate,
  getUserToday,
} from "@/app/utils/dates";
import {
  getDaysLeft,
  getExpectedProgress,
  getPace,
  getStageFeasibility,
  getStageStatuses,
  getUpcomingCapacity,
  hasStarted,
  type StageStatus,
} from "@/app/utils/goals";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays } from "@/app/utils/weekdays";
import { getUserTimezone } from "../../dashboard/day-objectives";
import { ObjectiveBadge } from "../../objectives/objective-badge";
import ui from "../../objectives/objectives.module.css";
import { getGoal, getObjectiveChecks, syncGoalStatuses, type Goal, type GoalStage } from "../data";
import { formatCount } from "../format";
import { PacePill, StatusPill } from "../goal-pills";
import styles from "../goals.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function GoalPage({ params }: PageProps<"/goals/[id]">) {
  return (
    <main className={ui.content}>
      <Suspense
        fallback={
          <>
            <BackLink href="/goals" label="Metas" />
            <LoadingStatus />
            <div className={ui.skeletonStack} aria-hidden="true">
              <Skeleton width="55%" height="var(--space-6)" />
              <Skeleton width="40%" height="var(--space-3)" />
            </div>
            <div className={styles.detailColumns}>
              <div className={styles.column}>
                <SkeletonCard lines={3} height="calc(var(--space-12) * 4)" />
              </div>
              <div className={styles.column}>
                <SkeletonList rows={2} />
                <SkeletonList rows={2} />
              </div>
            </div>
          </>
        }
      >
        <GoalDetail params={params} />
      </Suspense>
    </main>
  );
}

async function GoalDetail({ params }: Pick<PageProps<"/goals/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const supabase = createClient(await cookies());
  const [loaded, timezone] = await Promise.all([
    getGoal(supabase, id),
    getUserTimezone(supabase, user.id),
  ]);
  if (!loaded) notFound();

  const today = getUserToday(timezone);
  const [goal] = await syncGoalStatuses(supabase, [loaded], today);
  const statuses = getStageStatuses(goal.stages, today);
  const currentIndex = statuses.indexOf("current");
  const current = currentIndex === -1 ? null : goal.stages[currentIndex];
  const checks = current
    ? await getObjectiveChecks(
        supabase,
        goal.objectives.map((objective) => objective.id),
        current.windowStart,
        current.dueOn < today ? current.dueOn : today,
      )
    : [];

  return (
    <>
      <div className={styles.detailTop}>
        <BackLink href="/goals" label="Metas" />
        <Link className={styles.editLink} href={`/goals/${goal.id}/edit`}>
          Editar
        </Link>
      </div>

      <header className={styles.detailHeader}>
        <div>
          <h1 className={ui.title}>{goal.title}</h1>
          <p className={styles.detailSubtitle}>
            {goal.stages.length === 1 ? "1 etapa" : `${goal.stages.length} etapas`} ·{" "}
            {formatNumericDate(goal.startsOn)} a {formatNumericDate(goal.dueOn)}
          </p>
        </div>
        <StatusPill status={goal.status} />
      </header>
      {goal.description && <p className={styles.description}>{goal.description}</p>}

      <div className={styles.detailColumns}>
        <div className={styles.column}>
          {goal.status === "active" && current ? (
            <CurrentStage goal={goal} stage={current} checks={checks} today={today} />
          ) : (
            <ClosedSummary goal={goal} />
          )}
        </div>

        <div className={styles.column}>
          <section className={styles.section} aria-labelledby="stages-title">
            <h2 id="stages-title" className={ui.sectionTitle}>
              Etapas
            </h2>
            <ol className={styles.timeline}>
              {goal.stages.map((stage, index) => (
                <li key={stage.id} className={styles.timelineItem} data-status={statuses[index]}>
                  <span className={styles.timelineNumber} aria-hidden="true">
                    {stage.position}
                  </span>
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineTitle}>{stage.title}</span>
                    <ProgressBar
                      value={stage.checksCount / stage.targetCount}
                      label={`${stage.title}: ${stage.checksCount} de ${stage.targetCount}`}
                    />
                    <span className={styles.timelineMeta}>
                      {describeStage(goal, stage, statuses[index], index)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.section} aria-labelledby="objectives-title">
            <h2 id="objectives-title" className={ui.sectionTitle}>
              Objetivos que contam
            </h2>
            <ul className={ui.list}>
              {goal.objectives.map((objective) => {
                const count = checks.filter((check) => check.objectiveId === objective.id).length;
                return (
                  <li key={objective.id}>
                    <Link className={ui.row} href={`/objectives/${objective.id}/edit`}>
                      <ObjectiveBadge color={objective.color} icon={objective.icon} />
                      <span className={ui.rowText}>
                        <span className={ui.rowTitle}>{objective.title}</span>
                        <span className={ui.rowMeta}>
                          {formatWeekdays(objective.weekdays).toLowerCase()}
                          {current && ` · ${formatCount(count, goal.unitLabel)} na etapa`}
                          {objective.archived && " · arquivado"}
                        </span>
                      </span>
                      <svg className={ui.rowChevron} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m9 5 7 7-7 7" />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className={ui.hint}>Um check conta para todas as metas vinculadas ao objetivo.</p>
          </section>
        </div>
      </div>
    </>
  );
}

function describeStage(goal: Goal, stage: GoalStage, status: StageStatus, index: number) {
  const target = formatCount(stage.targetCount, goal.unitLabel);
  const due = formatNumericDate(stage.dueOn);
  switch (status) {
    case "completed":
      return `Concluída · ${stage.checksCount} de ${target}`;
    case "expired":
      return `Expirada · ${stage.checksCount} de ${target} até ${due}`;
    case "current":
      return `${stage.checksCount} de ${target} · até ${due}`;
    case "upcoming": {
      const capacity = getUpcomingCapacity(stage, goal.objectives);
      const warning =
        capacity < stage.targetCount ? ` · só ${capacity} dias programados na etapa` : "";
      return `Começa depois da etapa ${index} · ${target} até ${due}${warning}`;
    }
  }
}

function CurrentStage({
  goal,
  stage,
  checks,
  today,
}: {
  goal: Goal;
  stage: GoalStage;
  checks: { objectiveId: string; day: string }[];
  today: string;
}) {
  const started = hasStarted(stage, today);
  const progress = stage.checksCount / stage.targetCount;
  const expected = getExpectedProgress(stage, today);
  const missing = Math.max(0, stage.targetCount - stage.checksCount);
  const daysLeft = getDaysLeft(stage, today);

  return (
    <section className={styles.currentCard} aria-labelledby="current-title">
      <div className={styles.cardHeader}>
        <h2 id="current-title" className={styles.currentLabel}>
          {goal.stages.length === 1 ? "Etapa única" : "Etapa atual"} · {stage.title}
        </h2>
        {started && <PacePill pace={getPace(stage, today)} />}
      </div>

      <p className={styles.bigCount}>
        <strong>{stage.checksCount}</strong> de {formatCount(stage.targetCount, goal.unitLabel)}
      </p>
      <ProgressBar
        value={progress}
        expected={started ? expected.fraction : undefined}
        label={`${stage.checksCount} de ${stage.targetCount}`}
      />
      <div className={styles.progressLegend}>
        <span>{Math.round(progress * 100)}% feito</span>
        {started ? (
          <span>
            esperado hoje: {Math.round(expected.count)} ({Math.round(expected.fraction * 100)}%)
          </span>
        ) : (
          <span>começa em {formatNumericDate(stage.windowStart)}</span>
        )}
      </div>

      <dl className={styles.stats}>
        <div>
          <dt>Faltam</dt>
          <dd>{formatCount(missing, goal.unitLabel)}</dd>
        </div>
        <div>
          <dt>Prazo</dt>
          <dd>
            {daysLeft} {daysLeft === 1 ? "dia" : "dias"} · {formatDayMonth(stage.dueOn)}
          </dd>
        </div>
      </dl>

      <Feasibility goal={goal} stage={stage} checks={checks} today={today} started={started} />
    </section>
  );
}

function Feasibility({
  goal,
  stage,
  checks,
  today,
  started,
}: {
  goal: Goal;
  stage: GoalStage;
  checks: { objectiveId: string; day: string }[];
  today: string;
  started: boolean;
}) {
  let feasible: boolean;
  let text: string;
  if (started) {
    const result = getStageFeasibility({ stage, objectives: goal.objectives, checks, today });
    feasible = result.feasible;
    const perWeek =
      result.perWeek < 1 ? "menos de 1" : String(Math.round(result.perWeek));
    text = feasible
      ? `Dá para chegar: precisa fazer ${result.missing} dos ${result.available} dias programados que restam (≈ ${perWeek} por semana).`
      : `Com a frequência atual não dá mais: faltam ${result.missing}, restam ${result.available} dias programados. Adicione dias ao objetivo, vincule outro objetivo ou ajuste o prazo.`;
  } else {
    const capacity = getUpcomingCapacity(stage, goal.objectives);
    feasible = capacity >= stage.targetCount;
    text = feasible
      ? `Dá para chegar: a etapa tem ${capacity} dias programados para um alvo de ${stage.targetCount}.`
      : `Com a frequência atual não dá: a etapa tem só ${capacity} dias programados para um alvo de ${stage.targetCount}.`;
  }

  return (
    <p className={styles.capacity} data-feasible={feasible}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {feasible ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 3 3 5-6" />
          </>
        ) : (
          <>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17v.01" />
          </>
        )}
      </svg>
      <span>{text}</span>
    </p>
  );
}

function ClosedSummary({ goal }: { goal: Goal }) {
  const last = goal.stages.at(-1);
  const text = {
    active: "",
    completed: "Meta concluída. Todas as etapas chegaram ao alvo.",
    expired: `O prazo acabou em ${formatNumericDate(goal.dueOn)} sem atingir o alvo da última etapa.`,
    abandoned: "Você abandonou esta meta. Os checks dos objetivos continuam guardados.",
  }[goal.status];

  return (
    <section className={styles.currentCard}>
      <p className={styles.currentLabel}>{text}</p>
      {last && (
        <p className={styles.bigCount}>
          <strong>{last.checksCount}</strong> de {formatCount(last.targetCount, goal.unitLabel)}
        </p>
      )}
    </section>
  );
}
