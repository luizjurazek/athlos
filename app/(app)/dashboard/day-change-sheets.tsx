"use client";

import { useState } from "react";
import { formatDayMonth, formatShortDate } from "@/app/utils/dates";
import type { Addition } from "@/app/utils/occurrences";
import { ObjectiveBadge } from "../objectives/objective-badge";
import { addObjectiveToDay, undoObjectiveAddition } from "./actions";
import { getOptionConflict, type DayConflict, type DayOption } from "./day-objectives";
import { Sheet, SheetError, useSheetAction, weekdayName, type SheetObjective } from "./sheet";
import styles from "./dashboard.module.css";

function describeDay(day: string) {
  return `${weekdayName(day)}, ${formatDayMonth(day)}`;
}

function conflictReason(conflict: Exclude<DayConflict, null>, title: string) {
  switch (conflict) {
    case "same-activity":
      return "Já tem Academia neste dia.";
    case "due":
      return `Já tem ${title} neste dia.`;
    case "checked":
      return `${title} já tem check neste dia.`;
    case "moved":
      return `${title} mudou deste dia para outro.`;
    case "replaced":
      return `${title} foi trocado neste dia.`;
  }
}

export type DayAction = "move" | "replace" | "workout" | "undo";

/** Shown when an occurrence has more than one secondary action (RN-12, RN-22, RN-28). */
export function ActionsSheet({
  objective,
  day,
  checked,
  actions,
  undoTitle,
  onPick,
  onClose,
}: {
  objective: SheetObjective;
  day: string;
  checked: boolean;
  actions: DayAction[];
  undoTitle: string;
  onPick: (action: DayAction) => void;
  onClose: () => void;
}) {
  const details: Record<DayAction, { title: string; hint: string; blockedWhenChecked: boolean }> = {
    move: { title: "Mudar de dia", hint: `Fazer ${objective.title} em outro dia.`, blockedWhenChecked: true },
    replace: {
      title: "Trocar por outro objetivo",
      hint: `Neste dia, fazer outro no lugar de ${objective.title}.`,
      blockedWhenChecked: true,
    },
    workout: { title: "Trocar treino", hint: "Só neste dia; a agenda não muda.", blockedWhenChecked: true },
    undo: { title: undoTitle, hint: "Volta este dia ao que era antes.", blockedWhenChecked: false },
  };
  const blocked = (action: DayAction) => checked && details[action].blockedWhenChecked;

  return (
    <Sheet
      objective={objective}
      title={objective.title}
      subtitle={`De ${describeDay(day)}`}
      onClose={onClose}
    >
      <ul className={styles.list}>
        {actions.map((action) => (
          <li key={action}>
            <button
              type="button"
              className={styles.optionRow}
              aria-disabled={blocked(action) || undefined}
              onClick={() => {
                if (!blocked(action)) onPick(action);
              }}
            >
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{details[action].title}</span>
                <span className={styles.rowMeta}>{details[action].hint}</span>
              </span>
              <svg className={styles.optionChevron} viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {actions.some(blocked) && (
        <p className={styles.sheetInfo}>Esse dia já tem check. Desmarque antes de mudar de dia ou trocar.</p>
      )}
    </Sheet>
  );
}

type PickProps = {
  day: string;
  today: string;
  options: DayOption[];
  onClose: () => void;
} & ({ mode: "replace"; replaced: SheetObjective } | { mode: "add" });

/** RN-22 (replace) and RN-23 (add): pick the objective that takes this day. */
export function PickObjectiveSheet(props: PickProps) {
  const { day, today, options, onClose } = props;
  const { pending, error, run } = useSheetAction(onClose);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const selected = options.find((option) => option.id === selectedId) ?? null;
  const replacedId = props.mode === "replace" ? props.replaced.id : null;
  const canMarkDone = day <= today;
  // RN-35: a gym objective only enters the day with its workout chosen here.
  const gymWorkouts = selected?.workouts;
  const chosenWorkout = gymWorkouts?.find((workout) => workout.id === workoutId) ?? null;
  const ready = Boolean(selected) && (gymWorkouts === undefined || Boolean(chosenWorkout));
  const selectedName = selected
    ? `${selected.title}${chosenWorkout ? ` (Treino ${chosenWorkout.label})` : ""}`
    : "";

  function submit(markDone: boolean) {
    if (!selected || !ready) return;
    run(() => addObjectiveToDay(selected.id, day, replacedId, markDone, chosenWorkout?.id ?? null));
  }

  const info =
    reason ??
    (props.mode === "replace"
      ? `${props.replaced.title} sai deste dia sem contar como falta. O check da troca conta para as metas do objetivo escolhido.`
      : "Fica só neste dia, sem mudar a rotina. O check conta para as metas do objetivo.");

  const verb = props.mode === "replace" ? "Trocar por" : "Adicionar";

  return (
    <Sheet
      objective={props.mode === "replace" ? props.replaced : undefined}
      title={props.mode === "replace" ? "Trocar por outro objetivo" : "Adicionar objetivo"}
      subtitle={
        props.mode === "replace"
          ? `${props.replaced.title} de ${describeDay(day)}`
          : `Só em ${describeDay(day)}`
      }
      onClose={onClose}
    >
      <ul className={styles.list}>
        {options.map((option) => {
          const conflict = getOptionConflict(option, replacedId);
          const optionReason =
            (conflict && conflictReason(conflict, option.title)) ||
            (option.workouts === null ? `${option.title} sem ficha. Crie uma ficha para escolher o treino.` : null);
          return (
            <li key={option.id}>
              <button
                type="button"
                className={styles.optionRow}
                aria-pressed={selectedId === option.id}
                aria-disabled={Boolean(optionReason) || undefined}
                aria-label={optionReason ? `${option.title}: ${optionReason}` : option.title}
                onClick={() => {
                  if (optionReason) {
                    setReason(optionReason);
                    return;
                  }
                  setReason(null);
                  setSelectedId(option.id);
                  setWorkoutId(null);
                }}
              >
                <ObjectiveBadge color={option.color} icon={option.icon} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{option.title}</span>
                  {optionReason && <span className={styles.rowMeta}>{optionReason}</span>}
                </span>
                <span className={styles.optionRadio} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {gymWorkouts && (
        <div className={styles.workoutChoice}>
          <p className={styles.workoutChoiceTitle}>Qual treino?</p>
          <div className={styles.workoutChips} role="group" aria-label="Treino do dia">
            {gymWorkouts.map((workout) => (
              <button
                key={workout.id}
                type="button"
                className={styles.workoutChip}
                aria-pressed={workoutId === workout.id}
                aria-label={`Treino ${workout.label}${workout.description ? `, ${workout.description}` : ""}`}
                onClick={() => setWorkoutId(workout.id)}
              >
                <span className={styles.workoutChipLetter} aria-hidden="true">
                  {workout.label}
                </span>
                <span aria-hidden="true">{workout.description ?? `Treino ${workout.label}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className={styles.sheetInfo} aria-live="polite">
        {info}
      </p>
      <SheetError error={error} />

      <div className={styles.sheetActions}>
        {!selected || !ready ? (
          <button type="button" className={styles.primaryButton} disabled>
            {selected ? "Escolha o treino" : "Escolha um objetivo"}
          </button>
        ) : canMarkDone ? (
          <>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={pending}
              onClick={() => submit(false)}
            >
              {props.mode === "replace" ? "Só trocar" : "Só adicionar"}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={pending}
              onClick={() => submit(true)}
            >
              {pending ? "Salvando..." : `${verb} ${selectedName} e marcar feito`}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={pending}
            onClick={() => submit(false)}
          >
            {pending ? "Salvando..." : `${verb} ${selectedName}`}
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function AdditionUndoSheet({
  objective,
  addition,
  replacedTitle,
  checked,
  onClose,
}: {
  objective: SheetObjective;
  addition: Addition;
  replacedTitle: string | null;
  checked: boolean;
  onClose: () => void;
}) {
  const { pending, error, run } = useSheetAction(onClose);
  const replaced = addition.replacedObjectiveId !== null;

  return (
    <Sheet
      objective={objective}
      title={replaced ? "Trocado neste dia" : "Extra neste dia"}
      subtitle={
        replaced
          ? `${objective.title} no lugar de ${replacedTitle ?? "outro objetivo"}, ${formatShortDate(addition.day)}`
          : `${objective.title} só em ${formatShortDate(addition.day)}`
      }
      onClose={onClose}
    >
      <p className={styles.sheetInfo}>
        {checked
          ? "Esse dia já tem check. Desmarque antes de desfazer."
          : replaced && replacedTitle
            ? `Desfazer tira ${objective.title} e devolve ${replacedTitle} para este dia.`
            : `Desfazer tira ${objective.title} deste dia.`}
      </p>
      <SheetError error={error} />
      <div className={styles.sheetActions}>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          Fechar
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={checked || pending}
          onClick={() => run(() => undoObjectiveAddition(addition.id))}
        >
          {pending ? "Desfazendo..." : replaced ? "Desfazer troca" : "Tirar deste dia"}
        </button>
      </div>
    </Sheet>
  );
}

export function AddObjectiveButton({
  day,
  today,
  options,
}: {
  day: string;
  today: string;
  options: DayOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={styles.addButton} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Adicionar objetivo
      </button>
      {open && (
        <PickObjectiveSheet
          mode="add"
          day={day}
          today={today}
          options={options}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
