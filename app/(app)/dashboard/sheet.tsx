"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { getWeekday } from "@/app/utils/dates";
import { WEEKDAYS } from "@/app/utils/weekdays";
import { ObjectiveBadge } from "../objectives/objective-badge";
import type { DayObjective } from "./day-objectives";
import styles from "./dashboard.module.css";

export type SheetObjective = Pick<DayObjective, "id" | "title" | "color" | "icon">;

export function weekdayName(day: string) {
  return WEEKDAYS[getWeekday(day)].long.toLowerCase();
}

export type SheetResult = { ok: true } | { ok: false; error: string };

/** Runs a sheet's server action: closes and refreshes on success, keeps the sheet open with the error otherwise. */
export function useSheetAction(onClose: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<SheetResult>) {
    setError(null);
    startTransition(async () => {
      let result: SheetResult;
      try {
        result = await action();
      } catch {
        result = { ok: false, error: "Não deu para salvar. Tente de novo." };
      }
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return { pending, error, run };
}

export function Sheet({
  objective,
  title,
  subtitle,
  onClose,
  children,
}: {
  objective?: SheetObjective;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheetHeader}>
        {objective && <ObjectiveBadge color={objective.color} icon={objective.icon} />}
        <div className={styles.sheetHeading}>
          <h2 id={titleId} className={styles.sheetTitle}>
            {title}
          </h2>
          <p className={styles.sheetSubtitle}>{subtitle}</p>
        </div>
        <button type="button" className={styles.sheetClose} aria-label="Fechar" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function SheetError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className={styles.sheetError} role="alert">
      {error}
    </p>
  );
}
