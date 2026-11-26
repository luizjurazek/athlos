"use client";

import { startTransition, useActionState, useId, useState, type FormEvent, type ReactNode } from "react";
import g from "../goals/goals.module.css";
import ui from "../objectives/objectives.module.css";
import type { PlanFormState } from "./actions";
import type { CopySource } from "./data";
import {
  countPlanErrors,
  nextWorkoutLabel,
  PLAN_TITLE_MAX_LENGTH,
  validatePlan,
  WORKOUT_DESCRIPTION_MAX_LENGTH,
  WORKOUT_LABEL_MAX_LENGTH,
  type PlanErrors,
  type WorkoutDraft,
} from "./validation";
import styles from "./workouts.module.css";

type PlanFormProps = {
  mode: "create" | "edit";
  action: (prev: PlanFormState, formData: FormData) => Promise<PlanFormState>;
  initial: {
    title: string;
    startedOn: string;
    workouts: { id: string | null; label: string; description: string | null }[];
  };
  /** Create: the plan "Nova ficha a partir desta" copies workouts and exercises from. */
  copySource?: CopySource | null;
  /** Edit: workouts that cannot be deleted (RN-26). */
  lockedWorkoutIds?: string[];
  /** Objective using this plan, shown as context (the link itself is made in the objective). */
  objectiveTitle?: string | null;
};

let keySequence = 0;
function newKey() {
  keySequence += 1;
  return `w${keySequence}`;
}

function blankWorkout(labels: string[]): WorkoutDraft {
  return { key: newKey(), id: null, label: nextWorkoutLabel(labels), description: "", copyFromId: null };
}

function fromSource(source: CopySource): WorkoutDraft[] {
  return source.workouts.map((workout) => ({
    key: newKey(),
    id: null,
    label: workout.label,
    description: workout.description ?? "",
    copyFromId: workout.id,
  }));
}

/**
 * The plan only holds its workouts (and their exercises, added on each workout's screen). Which
 * objective uses it and the workout of each weekday are chosen in the gym objective.
 */
export function PlanForm({
  mode,
  action,
  initial,
  copySource = null,
  lockedWorkoutIds = [],
  objectiveTitle = null,
}: PlanFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [title, setTitle] = useState(initial.title);
  const [startedOn, setStartedOn] = useState(initial.startedOn);
  const [copy, setCopy] = useState(Boolean(copySource));
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>(() => {
    if (copySource) return fromSource(copySource);
    if (initial.workouts.length > 0) {
      return initial.workouts.map((workout) => ({
        key: newKey(),
        id: workout.id,
        label: workout.label,
        description: workout.description ?? "",
        copyFromId: null,
      }));
    }
    return [blankWorkout([])];
  });
  const [clientErrors, setClientErrors] = useState<PlanErrors | null>(null);
  const errors = clientErrors ?? state?.errors;

  function toggleCopy(checked: boolean) {
    setCopy(checked);
    setWorkouts(checked && copySource ? fromSource(copySource) : [blankWorkout([])]);
  }

  function updateWorkout(index: number, patch: Partial<WorkoutDraft>) {
    setWorkouts((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addWorkout() {
    setWorkouts((current) => [...current, blankWorkout(current.map((workout) => workout.label))]);
  }

  function removeWorkout(index: number) {
    setWorkouts((current) => current.filter((_, i) => i !== index));
  }

  function moveWorkout(index: number, offset: -1 | 1) {
    setWorkouts((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = { title, startedOn, workouts };
    const found = validatePlan(draft);
    if (countPlanErrors(found) > 0) {
      setClientErrors(found);
      return;
    }
    setClientErrors(null);
    const formData = new FormData();
    formData.set("plan", JSON.stringify(draft));
    startTransition(() => formAction(formData));
  }

  const errorCount = errors ? countPlanErrors(errors) : 0;
  const submitLabel =
    mode === "edit"
      ? "Salvar ficha"
      : `Criar ficha com ${workouts.length} ${workouts.length === 1 ? "treino" : "treinos"}`;

  return (
    <form className={`${ui.form} ${g.form}`} onSubmit={handleSubmit} noValidate>
      {state?.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}

      <Field label="Nome" error={errors?.title}>
        {(id, describedBy) => (
          <div className={ui.group} data-invalid={Boolean(errors?.title) || undefined}>
            <input
              id={id}
              className={ui.input}
              type="text"
              autoComplete="off"
              placeholder="Ex.: Ficha Novembro"
              maxLength={PLAN_TITLE_MAX_LENGTH}
              value={title}
              aria-invalid={Boolean(errors?.title) || undefined}
              aria-describedby={describedBy}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
        )}
      </Field>

      <Field
        label="Começa em"
        error={errors?.startedOn}
        hint={objectiveTitle ? `Usada pela ${objectiveTitle}: o treino do dia vale a partir desta data.` : undefined}
      >
        {(id, describedBy) => (
          <div className={ui.group} data-invalid={Boolean(errors?.startedOn) || undefined}>
            <input
              id={id}
              className={ui.input}
              type="date"
              value={startedOn}
              aria-invalid={Boolean(errors?.startedOn) || undefined}
              aria-describedby={describedBy}
              onChange={(event) => setStartedOn(event.target.value)}
            />
          </div>
        )}
      </Field>

      {mode === "create" && copySource && (
        <label className={styles.checkRow}>
          <input
            className={g.checkbox}
            type="checkbox"
            checked={copy}
            onChange={(event) => toggleCopy(event.target.checked)}
          />
          <span>Copiar treinos, exercícios e cargas da {copySource.title}</span>
        </label>
      )}

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Treinos</h2>
        <ul className={g.stages}>
          {workouts.map((workout, index) => {
            const workoutErrors = errors?.workouts[index];
            const locked = Boolean(workout.id && lockedWorkoutIds.includes(workout.id));
            return (
              <li key={workout.key} className={styles.workoutCard}>
                <div className={styles.workoutCardTop}>
                  <div className={styles.workoutFields}>
                    <div className={ui.group} data-invalid={Boolean(workoutErrors?.label) || undefined}>
                      <input
                        className={`${ui.input} ${styles.labelInput}`}
                        type="text"
                        autoComplete="off"
                        aria-label={`Letra do treino ${index + 1}`}
                        aria-invalid={Boolean(workoutErrors?.label) || undefined}
                        maxLength={WORKOUT_LABEL_MAX_LENGTH}
                        value={workout.label}
                        onChange={(event) => updateWorkout(index, { label: event.target.value.toUpperCase() })}
                      />
                    </div>
                    <div
                      className={ui.group}
                      data-invalid={Boolean(workoutErrors?.description) || undefined}
                    >
                      <input
                        className={ui.input}
                        type="text"
                        autoComplete="off"
                        placeholder="Ex.: Peito e tríceps"
                        aria-label={`Descrição do treino ${workout.label || index + 1}`}
                        maxLength={WORKOUT_DESCRIPTION_MAX_LENGTH}
                        value={workout.description}
                        onChange={(event) => updateWorkout(index, { description: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className={styles.workoutTools}>
                    {mode === "edit" && (
                      <>
                        <IconButton
                          label={`Subir treino ${workout.label}`}
                          disabled={index === 0}
                          onClick={() => moveWorkout(index, -1)}
                        >
                          <path d="m6 15 6-6 6 6" />
                        </IconButton>
                        <IconButton
                          label={`Descer treino ${workout.label}`}
                          disabled={index === workouts.length - 1}
                          onClick={() => moveWorkout(index, 1)}
                        >
                          <path d="m6 9 6 6 6-6" />
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      label={`Excluir treino ${workout.label}`}
                      disabled={workouts.length === 1 || locked}
                      onClick={() => removeWorkout(index)}
                    >
                      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                    </IconButton>
                  </div>
                </div>
                {workoutErrors?.label && <p className={g.fieldError}>{workoutErrors.label}</p>}
                {workoutErrors?.description && <p className={g.fieldError}>{workoutErrors.description}</p>}
                {locked && (
                  <p className={g.fieldHint}>Tem histórico: não dá para excluir. Para mudar, crie uma nova ficha.</p>
                )}
              </li>
            );
          })}
        </ul>
        {errors?.workoutsList && <p className={g.fieldError}>{errors.workoutsList}</p>}
        <button className={g.addStage} type="button" onClick={addWorkout}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Adicionar treino {nextWorkoutLabel(workouts.map((workout) => workout.label))}
        </button>
        <p className={ui.hint}>
          {mode === "create"
            ? "Os exercícios entram depois, na tela de cada treino. O treino de cada dia é escolhido no objetivo de academia."
            : "O treino de cada dia é escolhido no objetivo de academia que usa esta ficha."}
        </p>
      </section>

      <div className={g.saveBar}>
        {errorCount > 0 && (
          <p className={g.summary} role="alert">
            {errorCount === 1 ? "Corrija 1 campo." : `Corrija ${errorCount} campos.`}
          </p>
        )}
        <button className={`${ui.button} ${g.saveButton}`} type="submit" disabled={pending}>
          {pending ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={g.field}>
      <label className={g.label} htmlFor={id}>
        {label}
      </label>
      {children(id, error || hint ? messageId : undefined)}
      {error ? (
        <p id={messageId} className={g.fieldError}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className={g.fieldHint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={g.iconButton} type="button" aria-label={label} disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
