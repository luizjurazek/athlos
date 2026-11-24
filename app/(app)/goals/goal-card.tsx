import Link from "next/link";
import { ProgressBar } from "@/app/components/ProgressBar";
import { formatNumericDate } from "@/app/utils/dates";
import {
  getDaysLeft,
  getExpectedProgress,
  getPace,
  getStageStatuses,
  hasStarted,
  type GoalStatus,
  type Pace,
} from "@/app/utils/goals";
import type { Goal } from "./data";
import { formatCount } from "./format";
import { PacePill, StatusPill } from "./goal-pills";
import styles from "./goals.module.css";

export type GoalCardData = {
  id: string;
  title: string;
  status: GoalStatus;
  pace: Pace | null;
  stageLabel: string;
  done: number;
  target: string;
  progress: number;
  expected?: number;
  objectives: string;
  remaining: string;
};

export function getCurrentStage(goal: Goal, today: string) {
  const statuses = getStageStatuses(goal.stages, today);
  const index = statuses.indexOf("current");
  return goal.stages[index === -1 ? goal.stages.length - 1 : index];
}

export function toGoalCard(goal: Goal, today: string): GoalCardData {
  const stage = getCurrentStage(goal, today);
  const total = goal.stages.length;
  const tracking = goal.status === "active" && stage && hasStarted(stage, today);
  const missing = stage ? Math.max(0, stage.targetCount - stage.checksCount) : 0;
  const daysLeft = stage ? getDaysLeft(stage, today) : 0;

  return {
    id: goal.id,
    title: goal.title,
    status: goal.status,
    pace: tracking ? getPace(stage, today) : null,
    stageLabel: !stage
      ? ""
      : total === 1
        ? `Etapa única · até ${formatNumericDate(stage.dueOn)}`
        : `Etapa ${stage.position} de ${total} · ${stage.title} até ${formatNumericDate(stage.dueOn)}`,
    done: stage?.checksCount ?? 0,
    target: stage ? formatCount(stage.targetCount, goal.unitLabel) : "",
    progress: stage ? stage.checksCount / stage.targetCount : 0,
    expected: tracking ? getExpectedProgress(stage, today).fraction : undefined,
    objectives: goal.objectives.map((objective) => objective.title).join(", "),
    remaining:
      goal.status !== "active" || missing === 0
        ? ""
        : `faltam ${missing} em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`,
  };
}

export function GoalCard({
  card,
  footer = "objectives",
}: {
  card: GoalCardData;
  footer?: "objectives" | "remaining";
}) {
  return (
    <Link className={styles.card} href={`/goals/${card.id}`}>
      <span className={styles.cardHeader}>
        <span className={styles.cardTitle}>{card.title}</span>
        {card.pace ? <PacePill pace={card.pace} /> : <StatusPill status={card.status} />}
      </span>
      <span className={styles.cardMeta}>{card.stageLabel}</span>
      <ProgressBar
        className={styles.cardBar}
        value={card.progress}
        expected={card.expected}
        label={`${card.done} de ${card.target}`}
      />
      <span className={styles.cardFooter}>
        <span>
          <strong className={styles.cardCount}>{card.done}</strong> de {card.target}
        </span>
        <span className={styles.cardObjectives}>
          {footer === "objectives" ? card.objectives : card.remaining}
        </span>
      </span>
    </Link>
  );
}
