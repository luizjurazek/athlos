"use client";

import { startTransition, useOptimistic, useState } from "react";
import { quickAddGoalEntry } from "../goals/actions";
import { GoalCard, type GoalCardData } from "../goals/goal-card";
import styles from "./dashboard.module.css";

/** Goal card with a +1 button that logs an entry for today and updates the count right away. */
export function QuickEntryGoal({ card }: { card: GoalCardData }) {
  const [optimistic, addOne] = useOptimistic(card, (current) => {
    const done = current.done + 1;
    return { ...current, done, progress: Math.min(1, done / Math.max(1, current.targetCount)) };
  });
  const [error, setError] = useState<string | null>(null);
  const milestone = card.quickEntry?.milestone ?? false;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      addOne(undefined);
      const result = await quickAddGoalEntry(card.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className={styles.quickEntry}>
      <div className={styles.quickEntryRow}>
        <GoalCard card={optimistic} footer="remaining" />
        <button
          type="button"
          className={styles.quickEntryButton}
          aria-label={milestone ? `Marcar ${card.title} como alcançada` : `Registrar +1 em ${card.title}`}
          onClick={handleClick}
        >
          {milestone ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 5 5 9-10" />
            </svg>
          ) : (
            "+1"
          )}
        </button>
      </div>
      {error && (
        <p className={styles.quickEntryError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
