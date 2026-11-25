"use client";

import { startTransition, useOptimistic, useState } from "react";
import { quickAddGoalEntry } from "../goals/actions";
import { GoalCard, type GoalCardData } from "../goals/goal-card";
import styles from "./dashboard.module.css";

/** Goal card with a +1 button that logs an entry for today and updates the count right away. */
export function QuickEntryGoal({ card }: { card: GoalCardData }) {
  const [optimistic, addOne] = useOptimistic(card, (current) => ({
    ...current,
    bars: current.bars.map((bar) => {
      const done = bar.done + 1;
      const progress = done / Math.max(1, bar.targetCount);
      const reached = (bar.segments ?? [{ end: 1 }]).filter((segment) => progress >= segment.end);
      return {
        ...bar,
        done,
        completedUntil: Math.max(bar.completedUntil, ...reached.map((segment) => segment.end)),
      };
    }),
  }));
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
        <GoalCard card={optimistic} showObjectives={false} reserveAction />
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
            <>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              1
            </>
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
