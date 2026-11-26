import ui from "../objectives/objectives.module.css";
import styles from "./workouts.module.css";

export function WorkoutLetter({ label, small = false }: { label: string; small?: boolean }) {
  return (
    <span
      className={`${styles.letter} ${small ? styles.letterSmall : ""}`}
      aria-label={`Treino ${label}`}
      role="img"
    >
      {label}
    </span>
  );
}

export function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 12h10M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3" />
    </svg>
  );
}

export function PlanObjectivePill({ objectiveTitle }: { objectiveTitle: string | null }) {
  return objectiveTitle ? (
    <span className={styles.pill}>
      <LinkIcon />
      {objectiveTitle}
    </span>
  ) : (
    <span className={styles.pill} data-tone="muted">
      Livre
    </span>
  );
}

export function Chevron() {
  return (
    <svg className={ui.rowChevron} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
