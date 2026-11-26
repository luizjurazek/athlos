"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/app/components/SubmitButton";
import type { FormState } from "./actions";
import { Feedback } from "./objective-form";
import styles from "./objectives.module.css";

type ObjectiveActionsPanelProps = {
  archived: boolean;
  archiveAction: (prev: FormState) => Promise<FormState>;
  unarchiveAction: (prev: FormState) => Promise<FormState>;
  deleteAction: (prev: FormState) => Promise<FormState>;
};

export function ObjectiveActionsPanel({
  archived,
  archiveAction,
  unarchiveAction,
  deleteAction,
}: ObjectiveActionsPanelProps) {
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteAction, undefined);
  const [archiveState, archiveFormAction] = useActionState(
    archived ? unarchiveAction : archiveAction,
    undefined,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <section className={styles.section}>
      <Feedback state={archiveState} />
      <Feedback state={deleteState} />
      <div className={`${styles.list} ${styles.actionsList}`}>
        <form action={archiveFormAction}>
          <SubmitButton
            className={styles.rowButton}
            pendingLabel={archived ? "Desarquivando..." : "Arquivando..."}
          >
            {archived ? "Desarquivar objetivo" : "Arquivar objetivo"}
          </SubmitButton>
        </form>
        {confirmingDelete ? (
          <form action={deleteFormAction} className={styles.confirmRow}>
            <button className={`${styles.rowButton} ${styles.danger}`} type="submit" disabled={deleting}>
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </button>
            <button className={styles.rowButton} type="button" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button
            className={`${styles.rowButton} ${styles.danger}`}
            type="button"
            onClick={() => setConfirmingDelete(true)}
          >
            Excluir objetivo
          </button>
        )}
      </div>
      <p className={styles.hint}>
        {archived
          ? "Objetivos arquivados não aparecem em Hoje, mas o histórico continua guardado."
          : "Arquivar tira o objetivo de Hoje e mantém o histórico. Só dá para excluir objetivos sem checks."}
      </p>
    </section>
  );
}
