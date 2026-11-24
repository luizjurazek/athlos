import type { GoalStatus, Pace } from "@/app/utils/goals";
import styles from "./goals.module.css";

const PACE: Record<Pace, { label: string; tone: string }> = {
  ahead: { label: "Adiantado", tone: "accent" },
  "on-track": { label: "No ritmo", tone: "success" },
  "slightly-behind": { label: "Um pouco atrás", tone: "warning" },
  behind: { label: "Atrasado", tone: "danger" },
};

const STATUS: Partial<Record<GoalStatus, { label: string; tone: string }>> = {
  completed: { label: "Concluída", tone: "success" },
  expired: { label: "Expirada", tone: "danger" },
  abandoned: { label: "Abandonada", tone: "neutral" },
};

export function PacePill({ pace }: { pace: Pace }) {
  return (
    <span className={styles.pill} data-tone={PACE[pace].tone}>
      {PACE[pace].label}
    </span>
  );
}

export function StatusPill({ status }: { status: GoalStatus }) {
  const config = STATUS[status];
  if (!config) return null;
  return (
    <span className={styles.pill} data-tone={config.tone}>
      {config.label}
    </span>
  );
}
