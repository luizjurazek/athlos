"use client";

import { useActionState, useState } from "react";
import { formatShortDate } from "@/app/utils/dates";
import ui from "../objectives/objectives.module.css";
import type { GoalFormState } from "./actions";
import { formatCount } from "./format";
import { ENTRY_AMOUNT_MAX, ENTRY_NOTE_MAX_LENGTH } from "./validation";
import styles from "./goals.module.css";

export function GoalEntryForm({
  action,
  today,
  minDay,
  milestone,
}: {
  action: (prev: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  today: string;
  minDay: string;
  milestone: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  const submitLabel = milestone ? "Marcar como alcançado" : "Registrar";

  if (!open) {
    return (
      <button className={ui.button} type="button" onClick={() => setOpen(true)}>
        {submitLabel}
      </button>
    );
  }

  return (
    <form action={formAction} className={styles.entryForm}>
      {state?.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}
      <EntryFields today={today} minDay={minDay} milestone={milestone} />
      <div className={styles.entryActions}>
        <button className={ui.button} type="submit" disabled={pending}>
          {pending ? "Registrando..." : submitLabel}
        </button>
        <button className={ui.rowButton} type="button" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function EntryFields({
  today,
  minDay,
  milestone,
  entry,
}: {
  today: string;
  minDay: string;
  milestone: boolean;
  entry?: Entry;
}) {
  return (
    <>
      <div className={styles.stageFields}>
        <label className={styles.stageField} data-wide={milestone || undefined}>
          <span className={styles.label}>Dia</span>
          <span className={ui.group}>
            <input
              className={ui.input}
              name="day"
              type="date"
              defaultValue={entry?.day ?? today}
              min={minDay}
              max={today}
              required
            />
          </span>
        </label>
        {!milestone && (
          <label className={styles.stageField}>
            <span className={styles.label}>Quantidade</span>
            <span className={ui.group}>
              <input
                className={`${ui.input} ${styles.targetInput}`}
                name="amount"
                type="number"
                inputMode="numeric"
                min={1}
                max={ENTRY_AMOUNT_MAX}
                step={1}
                defaultValue={entry?.amount ?? 1}
              />
            </span>
          </label>
        )}
      </div>
      <label className={styles.field}>
        <span className={styles.label}>Nota · opcional</span>
        <span className={ui.group}>
          <input
            className={ui.input}
            name="note"
            type="text"
            autoComplete="off"
            placeholder={milestone ? "Ex.: 5km em 31min" : "Ex.: nome do livro"}
            maxLength={ENTRY_NOTE_MAX_LENGTH}
            defaultValue={entry?.note ?? ""}
          />
        </span>
      </label>
    </>
  );
}

type Entry = { id: string; day: string; amount: number; note: string | null };

type EntryActions = {
  unitLabel: string | null;
  minDay: string;
  today: string;
  updateAction: (entryId: string, prev: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  removeAction: (entryId: string) => Promise<GoalFormState>;
};

export function GoalEntryList({ entries, ...actions }: { entries: Entry[] } & EntryActions) {
  if (entries.length === 0) {
    return <p className={ui.empty}>Nenhum registro ainda.</p>;
  }
  return (
    <ul className={ui.list}>
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} {...actions} />
      ))}
    </ul>
  );
}

function EntryRow({
  entry,
  unitLabel,
  minDay,
  today,
  updateAction,
  removeAction,
}: { entry: Entry } & EntryActions) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const [removeState, removeFormAction, removing] = useActionState(
    () => removeAction(entry.id),
    undefined,
  );
  const [editState, editFormAction, saving] = useActionState(
    updateAction.bind(null, entry.id),
    undefined,
  );

  if (mode === "edit") {
    return (
      <li className={styles.entryEditRow}>
        <form action={editFormAction} className={styles.entryForm}>
          {editState?.error && (
            <p className={ui.error} role="alert">
              {editState.error}
            </p>
          )}
          <EntryFields today={today} minDay={minDay} milestone={false} entry={entry} />
          <div className={styles.entryActions}>
            <button className={ui.button} type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar registro"}
            </button>
            <button className={ui.rowButton} type="button" onClick={() => setMode("view")}>
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`${ui.row} ${styles.entryRow}`}>
      <span className={ui.rowText}>
        <span className={ui.rowTitle}>{entry.note ?? `+${entry.amount}`}</span>
        <span className={ui.rowMeta}>
          {formatShortDate(entry.day)}
          {entry.note && entry.amount > 1 && ` · ${formatCount(entry.amount, unitLabel)}`}
          {removeState?.error && ` · ${removeState.error}`}
        </span>
      </span>
      {mode === "remove" ? (
        <form action={removeFormAction} className={styles.entryRemove}>
          <button className={`${styles.textButton} ${ui.danger}`} type="submit" disabled={removing}>
            {removing ? "Removendo..." : "Remover"}
          </button>
          <button className={styles.textButton} type="button" onClick={() => setMode("view")}>
            Cancelar
          </button>
        </form>
      ) : (
        <span className={styles.entryRemove}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Editar registro"
            title="Editar registro"
            onClick={() => setMode("edit")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
            </svg>
          </button>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Remover registro"
            title="Remover registro"
            onClick={() => setMode("remove")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </button>
        </span>
      )}
    </li>
  );
}
