"use client";

import { useActionState, useState } from "react";
import ui from "../objectives/objectives.module.css";
import type { GoalFormState } from "./actions";

export function AbandonGoalPanel({ action }: { action: () => Promise<GoalFormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className={ui.section}>
      {state?.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}
      <div className={`${ui.list} ${ui.actionsList}`}>
        {confirming ? (
          <form action={formAction} className={ui.confirmRow}>
            <button className={`${ui.rowButton} ${ui.danger}`} type="submit" disabled={pending}>
              {pending ? "Abandonando..." : "Confirmar abandono"}
            </button>
            <button className={ui.rowButton} type="button" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button
            className={`${ui.rowButton} ${ui.danger}`}
            type="button"
            onClick={() => setConfirming(true)}
          >
            Abandonar meta
          </button>
        )}
      </div>
      <p className={ui.hint}>
        A meta vai para Encerradas e os checks dos objetivos continuam guardados.
      </p>
    </section>
  );
}
