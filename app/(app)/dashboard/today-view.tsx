"use client";

import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState, type ReactNode } from "react";
import { CHECK_BACKFILL_DAYS } from "@/app/utils/checks";
import { formatShortDate, getWeekday } from "@/app/utils/dates";
import { formatWeekdays, WEEKDAYS } from "@/app/utils/weekdays";
import { ObjectiveBadge } from "../objectives/objective-badge";
import { setCheck, type CheckFailure } from "./actions";
import {
  ActionsSheet,
  AddObjectiveButton,
  AdditionUndoSheet,
  PickObjectiveSheet,
  type DayAction,
} from "./day-change-sheets";
import type { BlockedDays, DayObjective, DayOption, PendingItem } from "./day-objectives";
import { RescheduleSheet, type RescheduleSheetData } from "./reschedule-sheet";
import styles from "./dashboard.module.css";

type SheetState =
  | { kind: "reschedule"; data: RescheduleSheetData }
  | { kind: "actions" | "replace"; item: DayObjective }
  | null;

function getActions(item: DayObjective): DayAction[] {
  if (item.addition || item.reschedule) return [];
  const actions: DayAction[] = [];
  if (item.reschedulable) actions.push("move");
  if (item.alternatives.length > 0) actions.push("replace");
  return actions;
}

function moreLabel(item: DayObjective) {
  if (item.addition) {
    return item.addition.replacedObjectiveId
      ? `${item.title}: desfazer troca`
      : `${item.title}: tirar deste dia`;
  }
  if (item.reschedule) return `${item.title}: desfazer mudança de dia`;
  const actions = getActions(item);
  if (actions.length > 1) return `${item.title}: mudar de dia ou trocar`;
  return actions[0] === "move" ? `${item.title}: mudar de dia` : `${item.title}: trocar por outro objetivo`;
}

function hasMore(item: DayObjective) {
  return Boolean(item.addition || item.reschedule) || getActions(item).length > 0;
}

type Failure = {
  id: string;
  title: string;
  checked: boolean;
  reason: CheckFailure;
};

export function TodayView({
  day,
  today,
  objectives,
  pending,
  blocked,
  pickerRange,
  dayOptions,
  goals,
}: {
  day: string;
  today: string;
  objectives: DayObjective[];
  pending: PendingItem[];
  blocked: Record<string, BlockedDays>;
  pickerRange: { from: string; to: string };
  dayOptions: DayOption[];
  goals?: ReactNode;
}) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const future = day > today;

  function openMove(item: DayObjective, from: string) {
    setSheet({
      kind: "reschedule",
      data: { mode: "move", objective: item, fromDay: from, today, blocked: blocked[item.id], pickerRange },
    });
  }

  function openActions(item: DayObjective) {
    if (item.addition) {
      setSheet({ kind: "actions", item });
      return;
    }
    if (item.reschedule) {
      setSheet({
        kind: "reschedule",
        data: { mode: "undo", objective: item, reschedule: item.reschedule, checked: item.checked },
      });
      return;
    }
    const actions = getActions(item);
    if (actions.length > 1) setSheet({ kind: "actions", item });
    else if (actions[0] === "move") openMove(item, day);
    else setSheet({ kind: "replace", item });
  }

  function renderSheet() {
    if (!sheet) return null;
    const close = () => setSheet(null);
    if (sheet.kind === "reschedule") return <RescheduleSheet {...sheet.data} onClose={close} />;
    const { item } = sheet;
    if (item.addition) {
      return (
        <AdditionUndoSheet
          objective={item}
          addition={item.addition}
          replacedTitle={item.replacedTitle}
          checked={item.checked}
          onClose={close}
        />
      );
    }
    if (sheet.kind === "actions") {
      return (
        <ActionsSheet
          objective={item}
          day={day}
          checked={item.checked}
          onPick={(action) => (action === "move" ? openMove(item, day) : setSheet({ kind: "replace", item }))}
          onClose={close}
        />
      );
    }
    return (
      <PickObjectiveSheet
        mode="replace"
        replaced={item}
        day={day}
        today={today}
        options={dayOptions.filter((option) => item.alternatives.includes(option.id))}
        onClose={close}
      />
    );
  }

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
          {future ? (
            <p className={styles.futureNote}>
              Ainda não dá para marcar este dia. Dá para adiantar mudanças de dia, trocas e
              objetivos extras.
            </p>
          ) : (
            <DaySummary done={done} total={items.length} />
          )}
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
        {pending.length > 0 && (
          <PendingSection items={pending} onMove={(item) => openMove(item.objective, item.day)} />
        )}
        {goals}
      </aside>

      <section className={styles.listArea} aria-labelledby="today-list-title">
        <h2 id="today-list-title" className={styles.sectionTitle}>
          {day === today ? "Para hoje" : future ? "Programados" : "Neste dia"}
        </h2>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.itemRow}>
              <button
                type="button"
                role="checkbox"
                aria-checked={item.checked}
                aria-disabled={future || undefined}
                className={styles.checkRow}
                onClick={() => {
                  if (!future) save(item, !item.checked);
                }}
              >
                <span className={styles.checkCircle} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="m6.5 12.5 3.5 3.5 7.5-8" />
                  </svg>
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{item.title}</span>
                  <span className={styles.rowMeta}>
                    {item.addition ? (
                      <span className={styles.movedBadge}>
                        {item.replacedTitle ? `no lugar de ${item.replacedTitle}` : "extra"}
                      </span>
                    ) : item.reschedule ? (
                      <span className={styles.movedBadge}>
                        → realocado de {WEEKDAYS[getWeekday(item.reschedule.fromDay)].short.toLowerCase()}
                      </span>
                    ) : (
                      formatWeekdays(item.weekdays)
                    )}
                  </span>
                </span>
                {!hasMore(item) && <ObjectiveBadge color={item.color} icon={item.icon} />}
              </button>
              {hasMore(item) && (
                <button
                  type="button"
                  className={styles.moreButton}
                  aria-label={moreLabel(item)}
                  onClick={() => openActions(item)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="6" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="18" cy="12" r="1.5" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
        <AddObjectiveButton day={day} today={today} options={dayOptions} />
      </section>

      {renderSheet()}
    </>
  );
}

export function PendingSection({
  items,
  onMove,
}: {
  items: PendingItem[];
  onMove: (item: PendingItem) => void;
}) {
  return (
    <section className={styles.pending} aria-labelledby="pending-title">
      <div className={styles.goalsHeader}>
        <h2 id="pending-title" className={styles.sectionTitle}>
          Pendentes
        </h2>
        <span className={styles.pendingHint}>últimos {CHECK_BACKFILL_DAYS} dias</span>
      </div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={`${item.objective.id}:${item.day}`} className={styles.pendingRow}>
            <ObjectiveBadge color={item.objective.color} icon={item.objective.icon} />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{item.objective.title}</span>
              <span className={styles.pendingMeta}>Faltou {formatShortDate(item.day)}</span>
            </span>
            <button type="button" className={styles.pendingButton} onClick={() => onMove(item)}>
              Mudar de dia
            </button>
          </li>
        ))}
      </ul>
    </section>
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
      : failure.reason === "out-of-window"
        ? {
            title: `Só dá para marcar até ${CHECK_BACKFILL_DAYS} dias atrás.`,
            detail: "Atualize para ver os dias que ainda dá para marcar.",
            action: "Atualizar",
            onAction: onRefresh,
          }
        : {
            title: `${failure.title} não está mais programado para este dia`,
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

export function PendingPanel({
  items,
  today,
  blocked,
  pickerRange,
}: {
  items: PendingItem[];
  today: string;
  blocked: Record<string, BlockedDays>;
  pickerRange: { from: string; to: string };
}) {
  const [sheet, setSheet] = useState<RescheduleSheetData | null>(null);
  return (
    <>
      <PendingSection
        items={items}
        onMove={(item) =>
          setSheet({
            mode: "move",
            objective: item.objective,
            fromDay: item.day,
            today,
            blocked: blocked[item.objective.id],
            pickerRange,
          })
        }
      />
      {sheet && <RescheduleSheet {...sheet} onClose={() => setSheet(null)} />}
    </>
  );
}
