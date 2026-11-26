"use client";

import { useState } from "react";
import { SwapWorkoutSheet } from "../dashboard/gym-row";
import type { GymDay, GymWorkout } from "../dashboard/gym-day";
import styles from "./objectives.module.css";

/** RN-28 from the calendar: the same swap as Hoje, disabled with the reason outside the window. */
export function DayWorkoutSwap({
  objective,
  gym,
  current,
  day,
  canSwap,
}: {
  objective: { id: string; title: string; checked: boolean };
  gym: GymDay;
  current: GymWorkout;
  day: string;
  canSwap: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.rowButton}
        aria-disabled={!canSwap || undefined}
        onClick={() => canSwap && setOpen(true)}
      >
        Trocar treino
      </button>
      {!canSwap && <p className={styles.hint}>Só dá para trocar até 7 dias atrás.</p>}
      {open && (
        <SwapWorkoutSheet objective={objective} gym={gym} current={current} day={day} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
