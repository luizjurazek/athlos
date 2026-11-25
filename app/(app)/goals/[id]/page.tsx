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
  countScheduledDays,
  getDaysLeft,
  getEntriesPace,
  getExpectedProgress,
  getPace,
  getStageFeasibility,
  getStageStatuses,
  getUpcomingCapacity,
  hasStarted,
  type ObjectiveTarget,
  type StageStatus,
} from "@/app/utils/goals";
import { createClient } from "@/app/utils/supabase/server";
import { requireUser } from "@/app/utils/supabase/user";
import { formatWeekdays } from "@/app/utils/weekdays";
import { getUserTimezone } from "../../dashboard/day-objectives";
import { ObjectiveBadge } from "../../objectives/objective-badge";
import ui from "../../objectives/objectives.module.css";
import {
  addGoalEntry,
  completeGoal,
  deleteGoalEntry,
  reopenGoal,
  updateGoalEntry,
} from "../actions";
import {
  getGoal,
  getGoalEntries,
  getObjectiveChecks,
  syncGoalStatuses,
  type Goal,
  type GoalStage,
} from "../data";
import { formatCount, getStageName, isMilestone, unitOf } from "../format";
import { getGoalTotals, getObjectiveTotals, type ObjectiveTotals } from "../goal-card";
import { GoalEntryForm, GoalEntryList } from "../goal-entries";
import { GoalProgressPanel } from "../goal-progress-panel";
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
  const byEntries = goal.progressSource === "entries";
  const lastTracked = current && current.dueOn < today ? current.dueOn : today;
  const [checks, entries] = current
    ? await Promise.all([
        getObjectiveChecks(
          supabase,
          goal.objectives.map((objective) => objective.id),
          current.windowStart,
          lastTracked,
        ),
        byEntries ? getGoalEntries(supabase, goal.id, goal.startsOn, today) : [],
      ])
    : [[], []];

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
          {byEntries && goal.status === "active" && current && (
            <section className={styles.section} aria-labelledby="entries-title">
              <h2 id="entries-title" className={ui.sectionTitle}>
                Registros
              </h2>
              <GoalEntryList
                entries={entries}
                unitLabel={unitOf(goal)}
                minDay={goal.startsOn}
                today={today}
                updateAction={updateGoalEntry.bind(null, goal.id)}
                removeAction={deleteGoalEntry.bind(null, goal.id)}
              />
            </section>
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
                    <span className={styles.timelineTitle}>{getStageName(goal, stage)}</span>
                    <ProgressBar
                      value={stage.checksCount / stage.targetCount}
                      completedUntil={stage.completed ? 1 : 0}
                      label={`${getStageName(goal, stage)}: ${stage.checksCount} de ${stage.targetCount}`}
                    />
                    {stage.objectiveTargets && (
                      <ul className={styles.timelineObjectives}>
                        {stage.objectiveTargets.map((target) => (
                          <li
                            key={target.objectiveId}
                            data-done={target.checksCount >= target.targetCount}
                          >
                            <span>{objectiveTitle(goal, target.objectiveId)}</span>
                            <span>
                              <strong>{Math.min(target.checksCount, target.targetCount)}</strong> de{" "}
                              {target.targetCount}
                              {target.checksCount >= target.targetCount && " ✓"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <span className={styles.timelineMeta}>
                      {stage.objectiveTargets
                        ? describeObjectiveStage(stage, statuses[index], index)
                        : describeStage(goal, stage, statuses[index], index)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {goal.objectives.length > 0 && (
            <section className={styles.section} aria-labelledby="objectives-title">
              <h2 id="objectives-title" className={ui.sectionTitle}>
                {byEntries ? "Hábitos de apoio" : "Objetivos que contam"}
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
                            {current &&
                              (byEntries
                                ? ` · ${count} de ${countScheduledDays([objective], current.windowStart, lastTracked)} dias programados na etapa`
                                : ` · ${formatCount(count, unitOf(goal))} na etapa`)}
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
              <p className={ui.hint}>
                {byEntries
                  ? "Os checks mostram a constância do hábito, mas não contam para o alvo."
                  : "Um check conta para todas as metas vinculadas ao objetivo."}
              </p>
            </section>
          )}
        </div>
      </div>

      <ProgressActions goal={goal} current={current} today={today} />
    </>
  );
}

function objectiveTitle(goal: Goal, objectiveId: string) {
  return goal.objectives.find((objective) => objective.id === objectiveId)?.title ?? "Objetivo";
}

function ProgressActions({
  goal,
  current,
  today,
}: {
  goal: Goal;
  current: GoalStage | null;
  today: string;
}) {
  const items = [];
  if (goal.status === "active" && current && hasStarted(current, today)) {
    items.push({
      label: "Concluir meta",
      confirmLabel:
        goal.stages.length === 1
          ? `Concluir ${missingText(goal, current)}`
          : "Concluir a meta agora",
      pendingLabel: "Concluindo...",
      action: completeGoal.bind(null, goal.id),
    });
  }
  if (goal.completedManuallyOn && goal.dueOn >= today) {
    items.push({
      label: "Reabrir meta",
      confirmLabel: "Reabrir a meta",
      pendingLabel: "Reabrindo...",
      action: reopenGoal.bind(null, goal.id),
    });
  }

  return (
    <GoalProgressPanel
      items={items}
      hint={
        goal.status === "active"
          ? goal.stages.length > 1
            ? "Cada etapa conclui sozinha ao bater o alvo, e a próxima começa no dia seguinte. Concluir a meta encerra tudo agora, mesmo sem bater o total."
            : "A meta conclui sozinha ao bater o alvo. Concluir agora encerra mesmo sem bater."
          : undefined
      }
    />
  );
}

function missingText(goal: Goal, stage: GoalStage) {
  if (stage.objectiveTargets) {
    const missing = stage.objectiveTargets
      .filter((target) => target.checksCount < target.targetCount)
      .map(
        (target) =>
          `${target.targetCount - target.checksCount} de ${objectiveTitle(goal, target.objectiveId).toLowerCase()}`,
      );
    return missing.length > 0 ? `mesmo faltando ${missing.join(" e ")}` : "agora";
  }
  const missing = stage.targetCount - stage.checksCount;
  return missing > 0 ? `mesmo faltando ${formatCount(missing, unitOf(goal))}` : "agora";
}

/** Per-objective stages list each objective's count above, so the text only tells status and dates. */
function describeObjectiveStage(stage: GoalStage, status: StageStatus, index: number) {
  const due = formatNumericDate(stage.dueOn);
  const closedOn = stage.completedManuallyOn ? formatNumericDate(stage.completedManuallyOn) : null;
  if (closedOn && !stage.completed) return `Encerrada com a meta em ${closedOn}`;
  return {
    completed: closedOn ? `Concluída em ${closedOn}` : "Concluída",
    expired: `Expirada em ${due}`,
    current: `Em andamento · até ${due}`,
    upcoming: `Começa depois da etapa ${index} · até ${due}`,
  }[status];
}

function describeStage(goal: Goal, stage: GoalStage, status: StageStatus, index: number) {
  const target = formatCount(stage.targetCount, unitOf(goal));
  const due = formatNumericDate(stage.dueOn);
  if (goal.completedManuallyOn && stage.completedManuallyOn && !stage.completed) {
    return `Encerrada com a meta em ${formatNumericDate(stage.completedManuallyOn)} · ${stage.checksCount} de ${target}`;
  }
  if (isMilestone(goal, stage)) {
    return {
      completed: stage.completedManuallyOn
        ? `Alcançado em ${formatNumericDate(stage.completedManuallyOn)}`
        : "Alcançado",
      expired: `Não alcançado até ${due}`,
      current: `Marco · até ${due}`,
      upcoming: `Marco · começa depois da etapa ${index} · até ${due}`,
    }[status];
  }
  switch (status) {
    case "completed":
      return stage.completedManuallyOn
        ? `Concluída em ${formatNumericDate(stage.completedManuallyOn)} · ${stage.checksCount} de ${target}`
        : `Concluída · ${stage.checksCount} de ${target}`;
    case "expired":
      return `Expirada · ${stage.checksCount} de ${target} até ${due}`;
    case "current":
      return `${stage.checksCount} de ${target} · até ${due}`;
    case "upcoming": {
      if (goal.progressSource === "entries") {
        return `Começa depois da etapa ${index} · ${target} até ${due}`;
      }
      const upcoming = getUpcomingCapacity(stage, goal.objectives);
      const short = upcoming.perObjective.find((item) => !item.feasible);
      const warning = upcoming.feasible
        ? ""
        : short
          ? ` · ${objectiveTitle(goal, short.objectiveId)} tem só ${short.capacity} dias programados para ${short.needed}`
          : ` · só ${upcoming.capacity} dias programados para ${upcoming.needed}`;
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
  const totals = getGoalTotals(goal);
  const totalTarget = Math.max(1, totals.targetCount);
  const progress = totals.done / totalTarget;
  const expected = getExpectedProgress(stage, today);
  const missing = Math.max(0, stage.targetCount - stage.checksCount);
  const daysLeft = getDaysLeft(stage, today);
  const milestone = isMilestone(goal, stage);
  const single = goal.stages.length === 1;
  const objectiveTotals = getObjectiveTotals(goal);

  return (
    <section className={styles.currentCard} aria-labelledby="current-title">
      <div className={styles.cardHeader}>
        <h2 id="current-title" className={styles.currentLabel}>
          {objectiveTotals
            ? "Meta · por objetivo"
            : `Meta · ${formatCount(totals.targetCount, unitOf(goal))}`}
        </h2>
        {started && <PacePill pace={getPace(stage, today)} />}
      </div>

      {objectiveTotals && stage.objectiveTargets ? (
        <ul className={styles.objectiveGoals}>
          {objectiveTotals.map((item) => (
            <ObjectiveGoal
              key={item.objectiveId}
              item={item}
              stageTarget={stage.objectiveTargets?.find((t) => t.objectiveId === item.objectiveId)}
              expectedFraction={started ? expected.fraction : undefined}
              single={single}
            />
          ))}
        </ul>
      ) : (
        <>
          <p className={styles.bigCount}>
            <strong>{totals.done}</strong> de {formatCount(totals.targetCount, unitOf(goal))}
          </p>
          <ProgressBar
            value={progress}
            expected={started ? expected.count / totalTarget : undefined}
            segments={totals.segments ?? undefined}
            completedUntil={totals.completedUntil}
            label={`${totals.done} de ${totals.targetCount}`}
          />
          <div className={styles.progressLegend}>
            <span>{Math.round(progress * 100)}% feito</span>
            {started ? (
              <span>esperado hoje: {Math.round(expected.count)}</span>
            ) : (
              <span>etapa começa em {formatNumericDate(stage.windowStart)}</span>
            )}
          </div>
        </>
      )}

      {!single && (
        <p className={styles.stageNow}>
          <span className={styles.stageNowLabel}>
            Etapa atual · {stage.position} de {goal.stages.length}
          </span>
          {stage.objectiveTargets ? (
            stage.title && <span>{stage.title}</span>
          ) : (
            <span>
              {milestone
                ? getStageName(goal, stage)
                : `${stage.title ? `${stage.title} · chegar` : "Chegar"} a ${formatCount(stage.targetCount, unitOf(goal))}`}
            </span>
          )}
        </p>
      )}
      {stage.objectiveTargets && !objectiveTotals && (
        <ul className={styles.objectiveProgress}>
          {stage.objectiveTargets.map((target) => (
            <li key={target.objectiveId} data-done={target.checksCount >= target.targetCount}>
              <span>{objectiveTitle(goal, target.objectiveId)}</span>
              <span>
                <strong>{Math.min(target.checksCount, target.targetCount)}</strong> de{" "}
                {target.targetCount}
                {target.checksCount >= target.targetCount && " ✓"}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.deadline}>
        <span className={styles.deadlineDue}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <span>
            <strong>
              {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
            </strong>{" "}
            até {formatNumericDate(stage.dueOn)}
          </span>
        </span>
        {!objectiveTotals && (
          <span className={styles.deadlineMissing}>
            {milestone
              ? "marco não alcançado"
              : `faltam ${formatCount(missing, unitOf(goal))}${single ? "" : " na etapa"}`}
          </span>
        )}
      </div>

      {goal.progressSource === "entries" ? (
        <>
          {started && <EntriesPace goal={goal} stage={stage} today={today} />}
          <GoalEntryForm
            action={addGoalEntry.bind(null, goal.id)}
            today={today}
            minDay={goal.startsOn}
            milestone={milestone}
          />
        </>
      ) : (
        <Feasibility goal={goal} stage={stage} checks={checks} today={today} started={started} />
      )}
    </section>
  );
}

/** One objective of a per-objective goal: its own total, bar and what is left in the stage. */
function ObjectiveGoal({
  item,
  stageTarget,
  expectedFraction,
  single,
}: {
  item: ObjectiveTotals;
  stageTarget: ObjectiveTarget | undefined;
  expectedFraction: number | undefined;
  single: boolean;
}) {
  const total = Math.max(1, item.targetCount);
  const base = stageTarget?.baseCount ?? 0;
  const expected =
    stageTarget && expectedFraction !== undefined
      ? (base + (stageTarget.targetCount - base) * expectedFraction) / total
      : undefined;
  const missing = stageTarget ? Math.max(0, stageTarget.targetCount - stageTarget.checksCount) : 0;

  return (
    <li className={styles.objectiveGoal}>
      <div className={styles.objectiveGoalHeader}>
        <span className={styles.objectiveGoalTitle}>{item.title}</span>
        <span>
          <strong>{item.done}</strong> de {item.targetCount}
        </span>
      </div>
      <ProgressBar
        value={item.done / total}
        expected={expected}
        segments={item.segments ?? undefined}
        completedUntil={item.completedUntil}
        label={`${item.title}: ${item.done} de ${item.targetCount}`}
      />
      <span className={styles.objectiveGoalMeta}>
        {!stageTarget
          ? "Não conta nesta etapa"
          : missing === 0
            ? single
              ? "Alvo alcançado ✓"
              : `Etapa: ${stageTarget.targetCount} alcançado ✓`
            : single
              ? `Faltam ${missing}`
              : `Etapa: chegar a ${stageTarget.targetCount} · faltam ${missing}`}
      </span>
    </li>
  );
}

function EntriesPace({ goal, stage, today }: { goal: Goal; stage: GoalStage; today: string }) {
  const pace = getEntriesPace(stage, today);
  if (pace.missing === 0) return null;
  const left =
    pace.period === "month"
      ? `${Math.round(pace.daysLeft / 30.44)} meses`
      : `${pace.daysLeft} ${pace.daysLeft === 1 ? "dia" : "dias"}`;
  const rate = Math.round(pace.rate) < 1 ? "menos de 1" : String(Math.round(pace.rate));
  const text =
    isMilestone(goal, stage)
      ? `Marque quando alcançar. Faltam ${left} até ${formatDayMonth(stage.dueOn)}.`
      : `Faltam ${formatCount(pace.missing, unitOf(goal))} em ${left} (≈ ${rate} por ${pace.period === "month" ? "mês" : "semana"}).`;
  return <p className={styles.paceNote}>{text}</p>;
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
    const short = result.perObjective.find((item) => !item.feasible);
    text = short
      ? `Com a frequência atual não dá mais: ${objectiveTitle(goal, short.objectiveId)} precisa de ${short.missing} e só restam ${short.available} dias programados. Adicione dias ao objetivo ou ajuste o prazo.`
      : result.perObjective.length > 0
      ? `Dá para chegar: ${result.perObjective
          .filter((item) => item.missing > 0)
          .map((item) => `${objectiveTitle(goal, item.objectiveId)} precisa de ${item.missing} dos ${item.available} dias que restam`)
          .join("; ") || "todos os objetivos já bateram o alvo da etapa"}.`
      : feasible
      ? `Dá para chegar: precisa fazer ${result.missing} dos ${result.available} dias programados que restam (≈ ${perWeek} por semana).`
      : `Com a frequência atual não dá mais: faltam ${result.missing}, restam ${result.available} dias programados. Adicione dias ao objetivo, vincule outro objetivo ou ajuste o prazo.`;
  } else {
    const { capacity, ...upcoming } = getUpcomingCapacity(stage, goal.objectives);
    feasible = upcoming.feasible;
    const short = upcoming.perObjective.find((item) => !item.feasible);
    text = short
      ? `Com a frequência atual não dá: ${objectiveTitle(goal, short.objectiveId)} tem só ${short.capacity} dias programados na etapa.`
      : feasible
      ? `Dá para chegar: a etapa tem ${capacity} dias programados para os ${upcoming.needed} que ela soma ao total.`
      : `Com a frequência atual não dá: a etapa tem só ${capacity} dias programados para os ${upcoming.needed} que ela soma ao total.`;
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
    completed: goal.completedManuallyOn
      ? `Meta concluída em ${formatNumericDate(goal.completedManuallyOn)}.`
      : "Meta concluída. Todas as etapas chegaram ao alvo.",
    expired: `O prazo acabou em ${formatNumericDate(goal.dueOn)} sem atingir o alvo da última etapa.`,
    abandoned: "Você abandonou esta meta. Os checks dos objetivos continuam guardados.",
  }[goal.status];

  return (
    <section className={styles.currentCard}>
      <p className={styles.currentLabel}>{text}</p>
      {last && (
        <ProgressBar
          value={last.checksCount / Math.max(1, last.targetCount)}
          segments={getGoalTotals(goal).segments ?? undefined}
          completedUntil={getGoalTotals(goal).completedUntil}
          label={`${last.checksCount} de ${last.targetCount}`}
        />
      )}
      {last && (
        <p className={styles.bigCount}>
          <strong>{last.checksCount}</strong> de {formatCount(last.targetCount, unitOf(goal))}
        </p>
      )}
    </section>
  );
}
