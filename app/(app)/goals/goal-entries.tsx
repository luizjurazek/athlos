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
      <div className={styles.stageFields}>
        <label className={styles.stageField} data-wide={milestone || undefined}>
          <span className={styles.label}>Dia</span>
          <span className={ui.group}>
            <input
              className={ui.input}
              name="day"
              type="date"
              defaultValue={today}
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
                defaultValue={1}
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
          />
        </span>
      </label>
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

type Entry = { id: string; day: string; amount: number; note: string | null };

export function GoalEntryList({
  entries,
  unitLabel,
  removeAction,
}: {
  entries: Entry[];
  unitLabel: string | null;
  removeAction: (entryId: string) => Promise<GoalFormState>;
}) {
  if (entries.length === 0) {
    return <p className={ui.empty}>Nenhum registro nesta etapa ainda.</p>;
  }
  return (
    <ul className={ui.list}>
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} unitLabel={unitLabel} removeAction={removeAction} />
      ))}
    </ul>
  );
}

function EntryRow({
  entry,
  unitLabel,
  removeAction,
}: {
  entry: Entry;
  unitLabel: string | null;
  removeAction: (entryId: string) => Promise<GoalFormState>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(() => removeAction(entry.id), undefined);

  return (
    <li className={`${ui.row} ${styles.entryRow}`}>
      <span className={ui.rowText}>
        <span className={ui.rowTitle}>{entry.note ?? `+${entry.amount}`}</span>
        <span className={ui.rowMeta}>
          {formatShortDate(entry.day)}
          {entry.note && entry.amount > 1 && ` · ${formatCount(entry.amount, unitLabel)}`}
          {state?.error && ` · ${state.error}`}
        </span>
      </span>
      {confirming ? (
        <form action={formAction} className={styles.entryRemove}>
          <button className={`${styles.textButton} ${ui.danger}`} type="submit" disabled={pending}>
            {pending ? "Removendo..." : "Remover"}
          </button>
          <button className={styles.textButton} type="button" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button
          className={styles.iconButton}
          type="button"
          aria-label="Remover registro"
          title="Remover registro"
          onClick={() => setConfirming(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      )}
    </li>
  );
}
