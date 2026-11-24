"use client";

import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState, type ReactNode } from "react";
import { formatWeekdays } from "@/app/utils/weekdays";
import { ObjectiveBadge } from "../objectives/objective-badge";
import { setCheck, type CheckFailure } from "./actions";
import type { DayObjective } from "./day-objectives";
import styles from "./dashboard.module.css";

type Failure = {
  id: string;
  title: string;
  checked: boolean;
  reason: CheckFailure;
};

export function TodayView({
  day,
  objectives,
  goals,
}: {
  day: string;
  objectives: DayObjective[];
  goals?: ReactNode;
}) {
  const router = useRouter();
  const [items, setOptimisticCheck] = useOptimistic(
    objectives,
    (state, change: { id: string; checked: boolean }) =>
      state.map((item) =>
        item.id === change.id ? { ...item, checked: change.checked } : item,
      ),
  );
  const [failure, setFailure] = useState<Failure | null>(null);

  function save(item: Pick<DayObjective, "id" | "title">, checked: boolean) {
    setFailure(null);
    startTransition(async () => {
      setOptimisticCheck({ id: item.id, checked });
      let reason: CheckFailure | null;
      try {
        const result = await setCheck(item.id, day, checked);
        reason = result.ok ? null : result.reason;
      } catch {
        reason = "failed";
      }
      if (reason)
        setFailure({ id: item.id, title: item.title, checked, reason });
    });
  }

  const done = items.filter((item) => item.checked).length;

  return (
    <>
      <aside className={styles.aside}>
        <div className={styles.summaryArea}>
          <DaySummary done={done} total={items.length} />
          {failure && (
            <CheckErrorToast
              failure={failure}
              onRetry={() => save(failure, failure.checked)}
              onRefresh={() => {
                setFailure(null);
                router.refresh();
              }}
              onClose={() => setFailure(null)}
            />
          )}
        </div>
        {goals}
      </aside>

      <section className={styles.listArea} aria-labelledby="today-list-title">
        <h2 id="today-list-title" className={styles.sectionTitle}>
          Para hoje
        </h2>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={item.checked}
                className={styles.checkRow}
                onClick={() => save(item, !item.checked)}
              >
                <span className={styles.checkCircle} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="m6.5 12.5 3.5 3.5 7.5-8" />
                  </svg>
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{item.title}</span>
                  <span className={styles.rowMeta}>
                    {formatWeekdays(item.weekdays)}
                  </span>
                </span>
                <ObjectiveBadge color={item.color} icon={item.icon} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function DaySummary({ done, total }: { done: number; total: number }) {
  const remaining = total - done;
  const progress = total === 0 ? 0 : (done / total) * 100;

  return (
    <section className={styles.summary} aria-label="Resumo do dia">
      <svg className={styles.ring} viewBox="0 0 48 48" aria-hidden="true">
        <circle
          className={styles.ringTrack}
          cx="24"
          cy="24"
          r="20"
          pathLength={100}
        />
        {done > 0 && (
          <circle
            className={styles.ringFill}
            cx="24"
            cy="24"
            r="20"
            pathLength={100}
            strokeDasharray={`${progress} 100`}
          />
        )}
      </svg>
      <div className={styles.summaryText} aria-live="polite">
        <p className={styles.summaryCount}>
          {done} de {total}
        </p>
        <p className={styles.summaryPhrase}>
          {remaining === 0
            ? "Dia fechado"
            : `${remaining === 1 ? "Falta 1" : `Faltam ${remaining}`} para fechar o dia`}
        </p>
      </div>
    </section>
  );
}

function CheckErrorToast({
  failure,
  onRetry,
  onRefresh,
  onClose,
}: {
  failure: Failure;
  onRetry: () => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const copy =
    failure.reason === "failed"
      ? {
          title: `Não deu para salvar ${failure.title}`,
          detail: failure.checked
            ? "Voltou para não feito."
            : "Voltou para feito.",
          action: "Tentar de novo",
          onAction: onRetry,
        }
      : failure.reason === "stale-day"
        ? {
            title: "O dia mudou",
            detail: "Atualize para ver os objetivos de hoje.",
            action: "Atualizar",
            onAction: onRefresh,
          }
        : {
            title: `${failure.title} não está mais programado para hoje`,
            detail: "Ele foi arquivado ou mudou de dia.",
            action: "Atualizar",
            onAction: onRefresh,
          };

  return (
    <div className={styles.toast} role="alert">
      <svg className={styles.toastIcon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
      <div className={styles.toastBody}>
        <p className={styles.toastTitle}>{copy.title}</p>
        <p className={styles.toastDetail}>{copy.detail}</p>
        <button
          type="button"
          className={styles.toastAction}
          onClick={copy.onAction}
        >
          {copy.action}
        </button>
      </div>
      <button
        type="button"
        className={styles.toastClose}
        onClick={onClose}
        aria-label="Fechar aviso"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
