"use client";

import { useActionState, useState } from "react";
import ui from "../objectives/objectives.module.css";
import type { GoalFormState } from "./actions";

type Action = () => Promise<GoalFormState>;

type ConfirmItem = {
  label: string;
  confirmLabel: string;
  pendingLabel: string;
  action: Action;
};

/** Manual completion and its undo. Each row asks for a second tap before running. */
export function GoalProgressPanel({ items, hint }: { items: ConfirmItem[]; hint?: string }) {
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0) return null;

  return (
    <section className={ui.section}>
      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <div className={`${ui.list} ${ui.actionsList}`}>
        {items.map((item) => (
          <ConfirmRow key={item.label} item={item} onError={setError} />
        ))}
      </div>
      {hint && <p className={ui.hint}>{hint}</p>}
    </section>
  );
}

function ConfirmRow({
  item,
  onError,
}: {
  item: ConfirmItem;
  onError: (message: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [, formAction, pending] = useActionState(async () => {
    const result = await item.action();
    onError(result?.error ?? null);
    return result;
  }, undefined);

  if (!confirming) {
    return (
      <button className={ui.rowButton} type="button" onClick={() => setConfirming(true)}>
        {item.label}
      </button>
    );
  }
  return (
    <form action={formAction} className={ui.confirmRow}>
      <button className={ui.rowButton} type="submit" disabled={pending}>
        {pending ? item.pendingLabel : item.confirmLabel}
      </button>
      <button className={ui.rowButton} type="button" onClick={() => setConfirming(false)}>
        Cancelar
      </button>
    </form>
  );
}
