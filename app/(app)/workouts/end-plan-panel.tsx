"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import ui from "../objectives/objectives.module.css";
import type { PlanFormState } from "./actions";
import styles from "./workouts.module.css";

export function PlanActionsPanel({
  planId,
  endAction,
}: {
  planId: string;
  endAction: (prev: PlanFormState) => Promise<PlanFormState>;
}) {
  const [state, formAction, pending] = useActionState(endAction, undefined);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className={ui.section}>
      {state?.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}
      <div className={`${ui.list} ${ui.actionsList} ${styles.actions}`}>
        <Link className={`${ui.rowButton} ${styles.linkButton}`} href={`/workouts/new?from=${planId}`}>
          Nova ficha a partir desta
        </Link>
        {confirming ? (
          <form action={formAction} className={ui.confirmRow}>
            <button className={`${ui.rowButton} ${ui.danger}`} type="submit" disabled={pending}>
              {pending ? "Encerrando..." : "Confirmar encerramento"}
            </button>
            <button className={ui.rowButton} type="button" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button className={`${ui.rowButton} ${ui.danger}`} type="button" onClick={() => setConfirming(true)}>
            Encerrar ficha
          </button>
        )}
      </div>
      <p className={ui.hint}>
        Nova ficha copia treinos, exercícios e cargas. Se esta ficha estiver num objetivo, a troca e o treino de
        cada dia são confirmados nele. Encerrar guarda tudo em Encerradas.
      </p>
    </section>
  );
}
