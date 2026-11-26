"use client";

import { useState } from "react";
import { getBackfillStart } from "@/app/utils/checks";
import { addDays, formatDayMonth, formatShortDate, getWeekday } from "@/app/utils/dates";
import type { Reschedule } from "@/app/utils/occurrences";
import { WEEKDAYS } from "@/app/utils/weekdays";
import { rescheduleObjective, undoReschedule, type RescheduleResult } from "./actions";
import type { BlockedDays } from "./day-objectives";
import { Sheet, SheetError, useSheetAction, weekdayName, type SheetObjective } from "./sheet";
import styles from "./dashboard.module.css";

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type MoveProps = {
  mode: "move";
  objective: SheetObjective;
  fromDay: string;
  today: string;
  blocked: BlockedDays;
  pickerRange: { from: string; to: string };
};

type UndoProps = {
  mode: "undo";
  objective: SheetObjective;
  reschedule: Reschedule;
  checked: boolean;
};

export type RescheduleSheetData = MoveProps | UndoProps;

export type RescheduleSheetProps = RescheduleSheetData & { onClose: () => void };

function formatWeekRange(start: string) {
  const end = addDays(start, 6);
  const [startMonth, endMonth] = [Number(start.slice(5, 7)), Number(end.slice(5, 7))];
  if (startMonth === endMonth) {
    return `${Number(start.slice(8))} a ${Number(end.slice(8))} de ${MONTHS_SHORT[endMonth - 1]}`;
  }
  return `${formatDayMonth(start)} a ${formatDayMonth(end)}`;
}

export function RescheduleSheet(props: RescheduleSheetProps) {
  const { objective, onClose } = props;
  const { pending, error, run } = useSheetAction(onClose);

  return (
    <Sheet
      objective={objective}
      title={props.mode === "move" ? "Mudar de dia" : "Mudou de dia"}
      subtitle={
        props.mode === "move"
          ? `${objective.title} de ${weekdayName(props.fromDay)}, ${formatDayMonth(props.fromDay)}`
          : `${objective.title}: ${formatShortDate(props.reschedule.fromDay)} → ${formatShortDate(props.reschedule.toDay)}`
      }
      onClose={onClose}
    >
      {props.mode === "move" ? (
        <MovePicker {...props} pending={pending} error={error} onSubmit={run} />
      ) : (
        <>
          <p className={styles.sheetInfo}>
            {props.checked
              ? "O novo dia já tem check. Desmarque antes de desfazer."
              : `Desfazer devolve ${objective.title} para ${weekdayName(props.reschedule.fromDay)}, ${formatDayMonth(props.reschedule.fromDay)}.`}
          </p>
          <SheetError error={error} />
          <div className={styles.sheetActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Fechar
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={props.checked || pending}
              onClick={() => run(() => undoReschedule(props.reschedule.id))}
            >
              {pending ? "Desfazendo..." : "Desfazer mudança"}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function MovePicker({
  objective,
  fromDay,
  today,
  blocked,
  pickerRange,
  pending,
  error,
  onSubmit,
}: MoveProps & {
  pending: boolean;
  error: string | null;
  onSubmit: (action: () => Promise<RescheduleResult>) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const windowStart = getBackfillStart(today);

  const weeks: string[] = [];
  for (let start = pickerRange.from; start <= pickerRange.to; start = addDays(start, 7)) {
    weeks.push(start);
  }

  function blockReason(day: string) {
    if (day === fromDay) return "Este é o dia que você está mudando.";
    if (blocked.occurrence.includes(day)) return `Já tem ${objective.title} neste dia.`;
    if (blocked.replaced.includes(day)) return `${objective.title} foi trocado neste dia.`;
    if (blocked.checked.includes(day)) return "Já tem check neste dia.";
    const sameActivity = blocked.sameActivity.find((item) => item.day === day);
    if (sameActivity) return `Já tem ${sameActivity.title} (Academia) neste dia.`;
    return null;
  }

  const info =
    reason ??
    (selected
      ? selected <= today
        ? `${selected === today ? "Hoje" : "Dia passado"}: dá para registrar que já foi feito.`
        : "Dia futuro: o check fica para o próprio dia."
      : `Dias riscados já têm ${objective.title}. Toque em um para ver o motivo.`);

  const label = selected ? formatShortDate(selected) : "";

  return (
    <>
      <div className={styles.picker}>
        {weeks.map((start) => (
          <div key={start} className={styles.pickerWeek}>
            <p className={styles.pickerWeekLabel}>{formatWeekRange(start)}</p>
            <div className={styles.pickerDays}>
              {Array.from({ length: 7 }, (_, index) => {
                const day = addDays(start, index);
                if (day < windowStart) return <span key={day} aria-hidden="true" />;
                const dayReason = blockReason(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={styles.pickerDay}
                    data-origin={day === fromDay || undefined}
                    data-blocked={(dayReason && day !== fromDay) || undefined}
                    aria-pressed={selected === day}
                    aria-disabled={Boolean(dayReason)}
                    aria-label={`${weekdayName(day)}, ${formatDayMonth(day)}${dayReason ? `: ${dayReason}` : ""}`}
                    onClick={() => {
                      if (dayReason) {
                        setReason(dayReason);
                        return;
                      }
                      setReason(null);
                      setSelected(day);
                    }}
                  >
                    <span className={styles.pickerWeekday}>{WEEKDAYS[getWeekday(day)].short}</span>
                    <span className={styles.pickerDate}>{Number(day.slice(8))}</span>
                    {day === today && <span className={styles.pickerToday} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className={styles.sheetInfo} aria-live="polite">
        {info}
      </p>
      <SheetError error={error} />

      <div className={styles.sheetActions}>
        {!selected ? (
          <button type="button" className={styles.primaryButton} disabled>
            Escolha um dia
          </button>
        ) : selected <= today ? (
          <>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={pending}
              onClick={() => onSubmit(() => rescheduleObjective(objective.id, fromDay, selected, false))}
            >
              Só mudar o dia
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={pending}
              onClick={() => onSubmit(() => rescheduleObjective(objective.id, fromDay, selected, true))}
            >
              {pending ? "Salvando..." : `Mudar para ${label} e marcar feito`}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={pending}
            onClick={() => onSubmit(() => rescheduleObjective(objective.id, fromDay, selected, false))}
          >
            {pending ? "Salvando..." : `Mudar para ${label}`}
          </button>
        )}
      </div>
    </>
  );
}
