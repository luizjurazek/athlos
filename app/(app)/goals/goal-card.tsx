import Link from "next/link";
import { ProgressBar, type ProgressSegment } from "@/app/components/ProgressBar";
import { diffDays, formatNumericDate, formatShortDate } from "@/app/utils/dates";
import {
  getDaysLeft,
  getExpectedProgress,
  getPace,
  getStageStatuses,
  hasStarted,
  type GoalStatus,
  type Pace,
} from "@/app/utils/goals";
import type { Goal, GoalStage } from "./data";
import { formatCount, getStageName, isMilestone, unitOf } from "./format";
import { PacePill, StatusPill } from "./goal-pills";
import styles from "./goals.module.css";

/** One progress line of a card: the goal total, or one objective's total in per-objective goals. */
export type CardBar = {
  /** Objective name in per-objective goals; null for the goal itself. */
  title: string | null;
  done: number;
  targetCount: number;
  /** Each stage's target inside the bar; null when the goal has a single stage. */
  segments: ProgressSegment[] | null;
  /** Share of the bar covered by reached stages, painted green. */
  completedUntil: number;
  expected?: number;
};

export type GoalCardData = {
  id: string;
  title: string;
  status: GoalStatus;
  pace: Pace | null;
  stageLabel: string;
  unit: string | null;
  /** Milestone stages show "Marco pendente" instead of "0 de 1". */
  milestone: boolean;
  bars: CardBar[];
  objectives: string;
  /** Set for active entry goals that already started: they get a +1 shortcut. */
  quickEntry: { milestone: boolean } | null;
};

export function getCurrentStage(goal: Goal, today: string) {
  const statuses = getStageStatuses(goal.stages, today);
  const index = statuses.indexOf("current");
  return goal.stages[index === -1 ? goal.stages.length - 1 : index];
}

/** Stage counts are cumulative, so the last stage holds the goal totals. */
export function getGoalTotals(goal: Goal) {
  const last = goal.stages.at(-1);
  const targetCount = last?.targetCount ?? 0;
  const lastReached = goal.stages.findLast((stage) => stage.completed);
  return {
    done: last?.checksCount ?? 0,
    targetCount,
    segments: toSegments(goal.stages.map((stage) => stage.targetCount), targetCount),
    completedUntil: lastReached ? lastReached.targetCount / Math.max(1, targetCount) : 0,
  };
}

/** Stage targets as labeled bar segments; a single stage needs none (the total says it all). */
function toSegments(targets: number[], total: number): ProgressSegment[] | null {
  if (targets.length < 2) return null;
  return targets.map((target) => ({ end: target / Math.max(1, total), label: String(target) }));
}

export type ObjectiveTotals = {
  objectiveId: string;
  title: string;
  done: number;
  targetCount: number;
  segments: ProgressSegment[] | null;
  completedUntil: number;
};

/**
 * Goals with per-objective targets are tracked per objective: each objective's total is its target
 * in the latest stage that has one, and green covers the stages where that objective hit its target.
 */
export function getObjectiveTotals(goal: Goal): ObjectiveTotals[] | null {
  if (goal.progressSource !== "checks" || !goal.stages.at(-1)?.objectiveTargets) return null;
  const ids = [
    ...new Set(goal.stages.flatMap((stage) => stage.objectiveTargets?.map((t) => t.objectiveId) ?? [])),
  ];
  return ids.flatMap((objectiveId) => {
    const rows = goal.stages.flatMap((stage) => {
      const target = stage.objectiveTargets?.find((item) => item.objectiveId === objectiveId);
      return target ? [target] : [];
    });
    const last = rows.at(-1);
    if (!last) return [];
    const total = Math.max(1, last.targetCount);
    const reached = rows.findLast((target) => target.checksCount >= target.targetCount);
    return [
      {
        objectiveId,
        title: goal.objectives.find((objective) => objective.id === objectiveId)?.title ?? "Objetivo",
        done: last.checksCount,
        targetCount: last.targetCount,
        segments: toSegments(
          rows.map((target) => target.targetCount),
          last.targetCount,
        ),
        completedUntil: reached ? reached.targetCount / total : 0,
      },
    ];
  });
}

/** "Etapa 1 de 2 · 182 dias · até 25/05/2027"; the days left only while the goal is active. */
export function describeCurrentStage(goal: Goal, stage: GoalStage, today: string) {
  const total = goal.stages.length;
  const parts = [total === 1 ? "Etapa única" : `Etapa ${stage.position} de ${total}`];
  if (isMilestone(goal, stage)) parts.push(getStageName(goal, stage));
  if (goal.status === "active") {
    const daysLeft = getDaysLeft(stage, today);
    parts.push(`${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`);
  }
  parts.push(`até ${formatNumericDate(stage.dueOn)}`);
  return parts.join(" · ");
}

/**
 * Day the goal was completed: closed by hand, or the day its last stage reached the target
 * (stage closures are stored as `completed_manually_on`). Null while the goal is not completed.
 */
export function getCompletedOn(goal: Goal) {
  if (goal.status !== "completed") return null;
  return goal.completedManuallyOn ?? goal.stages.at(-1)?.completedManuallyOn ?? null;
}

/** "Meta concluída hoje!" style note for a goal completed in the last few days. */
export function describeCompletion(completedOn: string, today: string) {
  const ago = diffDays(completedOn, today);
  if (ago === 0) return "Meta concluída hoje! Parabéns.";
  if (ago === 1) return "Meta concluída ontem! Parabéns.";
  return `Meta concluída em ${formatShortDate(completedOn)}. Parabéns!`;
}

export function toGoalCard(goal: Goal, today: string): GoalCardData {
  const stage = getCurrentStage(goal, today);
  const totals = getGoalTotals(goal);
  const tracking = goal.status === "active" && stage && hasStarted(stage, today);
  const expected = tracking ? getExpectedProgress(stage, today) : null;
  const objectiveTotals = getObjectiveTotals(goal);

  const bars: CardBar[] = objectiveTotals
    ? objectiveTotals.map((item) => {
        const target = stage?.objectiveTargets?.find((t) => t.objectiveId === item.objectiveId);
        const base = target?.baseCount ?? 0;
        return {
          title: item.title,
          done: item.done,
          targetCount: item.targetCount,
          segments: item.segments,
          completedUntil: item.completedUntil,
          expected:
            expected && target
              ? (base + (target.targetCount - base) * expected.fraction) / Math.max(1, item.targetCount)
              : undefined,
        };
      })
    : [
        {
          title: null,
          done: totals.done,
          targetCount: totals.targetCount,
          segments: totals.segments,
          completedUntil: totals.completedUntil,
          expected: expected ? expected.count / Math.max(1, totals.targetCount) : undefined,
        },
      ];

  return {
    id: goal.id,
    title: goal.title,
    status: goal.status,
    pace: tracking ? getPace(stage, today) : null,
    stageLabel: stage ? describeCurrentStage(goal, stage, today) : "",
    unit: unitOf(goal),
    milestone: stage ? isMilestone(goal, stage) && !stage.completed : false,
    bars,
    objectives:
      goal.progressSource === "entries"
        ? goal.objectives.length > 0
          ? `Apoio: ${goal.objectives.map((objective) => objective.title).join(", ")}`
          : ""
        : goal.objectives.map((objective) => objective.title).join(", "),
    quickEntry:
      goal.progressSource === "entries" && goal.status === "active" && goal.startsOn <= today
        ? { milestone: Boolean(stage && isMilestone(goal, stage)) }
        : null,
  };
}

export function GoalCard({
  card,
  showObjectives = true,
  reserveAction = false,
  celebration,
}: {
  card: GoalCardData;
  showObjectives?: boolean;
  /** Highlights a goal completed in the last days, with this message on top. */
  celebration?: string;
  /** Leaves room on the count line for a button laid over the card (the +1 on Hoje). */
  reserveAction?: boolean;
}) {
  return (
    <Link
      className={styles.card}
      href={`/goals/${card.id}`}
      data-action={reserveAction || undefined}
      data-celebrate={celebration ? true : undefined}
    >
      {celebration && (
        <span className={styles.celebration}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 3 3 5-6" />
          </svg>
          {celebration}
        </span>
      )}
      <span className={styles.cardHeader}>
        <span className={styles.cardTitle}>{card.title}</span>
        {card.pace ? <PacePill pace={card.pace} /> : <StatusPill status={card.status} />}
      </span>
      <span className={styles.cardMeta}>{card.stageLabel}</span>
      <span className={styles.cardBars}>
        {card.bars.map((bar) => (
          <span key={bar.title ?? "goal"} className={styles.cardBarItem}>
            <ProgressBar
              value={bar.done / Math.max(1, bar.targetCount)}
              expected={bar.expected}
              segments={bar.segments ?? undefined}
              completedUntil={bar.completedUntil}
              label={`${bar.title ? `${bar.title}: ` : ""}${bar.done} de ${bar.targetCount}`}
            />
            <span className={styles.cardFooter}>
              {card.milestone && !bar.title ? (
                <span>Marco pendente</span>
              ) : bar.title ? (
                <span>
                  {bar.title} <strong className={styles.cardCount}>{bar.done}</strong> de{" "}
                  {bar.targetCount}
                </span>
              ) : (
                <span>
                  <strong className={styles.cardCount}>{bar.done}</strong> de{" "}
                  {formatCount(bar.targetCount, card.unit)}
                </span>
              )}
            </span>
          </span>
        ))}
      </span>
      {showObjectives && card.objectives && (
        <span className={styles.cardNote}>{card.objectives}</span>
      )}
    </Link>
  );
}
