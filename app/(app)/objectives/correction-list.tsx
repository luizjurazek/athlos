"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CHECK_BACKFILL_DAYS } from "@/app/utils/checks";
import { addDays, formatDayMonth, formatShortDate } from "@/app/utils/dates";
import { setCheck } from "../dashboard/actions";
import styles from "./objectives.module.css";

const FAILURE_COPY = {
  "out-of-window": `Só dá para marcar até ${CHECK_BACKFILL_DAYS} dias atrás. Atualize a página.`,
  "not-scheduled": "Esse dia não está mais programado. Atualize a página.",
  failed: "Não deu para salvar. Tente de novo.",
};

export function CorrectionList({ objectiveId, days }: { objectiveId: string; days: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function markDone(day: string) {
    setError(null);
    setSavingDay(day);
    startTransition(async () => {
      let message: string | null = null;
      try {
        const result = await setCheck(objectiveId, day, true);
        if (!result.ok) message = FAILURE_COPY[result.reason];
      } catch {
        message = FAILURE_COPY.failed;
      }
      if (message) setError(message);
      else router.refresh();
    });
  }

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ul className={styles.list}>
        {days.map((day) => {
          const lastDay = addDays(day, CHECK_BACKFILL_DAYS);
          return (
            <li key={day} className={styles.correctionRow}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{formatShortDate(day)} · sem check</span>
                <span className={styles.rowMeta}>Ainda dá para marcar até {formatDayMonth(lastDay)}</span>
              </span>
              <button
                type="button"
                className={styles.correctionButton}
                disabled={pending}
                onClick={() => markDone(day)}
              >
                {pending && savingDay === day ? "Salvando..." : "Marcar feito"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
