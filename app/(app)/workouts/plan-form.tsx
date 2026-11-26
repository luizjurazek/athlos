"use client";

import { startTransition, useActionState, useId, useState, type FormEvent, type ReactNode } from "react";
import { addDays, formatNumericDate } from "@/app/utils/dates";
import { formatWeekdays, isWeekday, WEEKDAYS, type Weekday } from "@/app/utils/weekdays";
import g from "../goals/goals.module.css";
import ui from "../objectives/objectives.module.css";
import type { PlanFormState } from "./actions";
import type { CopySource, GymObjective } from "./data";
import {
  countPlanErrors,
  formatWorkoutName,
  nextWorkoutLabel,
  PLAN_TITLE_MAX_LENGTH,
  suggestSchedule,
  validatePlan,
  WORKOUT_DESCRIPTION_MAX_LENGTH,
  WORKOUT_LABEL_MAX_LENGTH,
  type PlanErrors,
  type WorkoutDraft,
} from "./validation";
import styles from "./workouts.module.css";

type ScheduleByKey = Partial<Record<Weekday, string | null>>;

type PlanFormProps = {
  mode: "create" | "edit";
  action: (prev: PlanFormState, formData: FormData) => Promise<PlanFormState>;
  objectives: GymObjective[];
  today: string;
  initial: {
    title: string;
    startedOn: string;
    objectiveId: string | null;
    workouts: { id: string | null; label: string; description: string | null }[];
  };
  /** Create: a plan to copy from (the "Nova ficha" origin). Also the objectives' active plans. */
  copySources?: Record<string, CopySource>;
  sourcePlanId?: string | null;
  /** Edit: this plan's id and the workouts that cannot be deleted (RN-26). */
  planId?: string;
  lockedWorkoutIds?: string[];
  hasSchedule?: boolean;
};

let keySequence = 0;
function newKey() {
  keySequence += 1;
  return `w${keySequence}`;
}

function blankWorkout(labels: string[]): WorkoutDraft {
  return { key: newKey(), id: null, label: nextWorkoutLabel(labels), description: "", copyFromId: null };
}

function suggestByKey(weekdays: readonly number[], workouts: WorkoutDraft[]): ScheduleByKey {
  const byIndex = suggestSchedule(weekdays, workouts.length);
  const schedule: ScheduleByKey = {};
  for (const weekday of weekdays.filter(isWeekday)) {
    const index = byIndex[weekday];
    schedule[weekday] = index == null ? null : workouts[index].key;
  }
  return schedule;
}

function fromSource(source: CopySource, weekdays: readonly number[]) {
  const workouts = source.workouts.map((workout) => ({
    key: newKey(),
    id: null,
    label: workout.label,
    description: workout.description ?? "",
    copyFromId: workout.id,
  }));
  const schedule: ScheduleByKey = {};
  for (const weekday of weekdays.filter(isWeekday)) {
    const entry = source.schedule.find((item) => item.weekday === weekday);
    const index = entry ? source.workouts.findIndex((workout) => workout.id === entry.workoutId) : -1;
    schedule[weekday] = index >= 0 ? workouts[index].key : null;
  }
  return { workouts, schedule };
}

export function PlanForm({
  mode,
  action,
  objectives,
  today,
  initial,
  copySources = {},
  sourcePlanId = null,
  planId,
  lockedWorkoutIds = [],
  hasSchedule = false,
}: PlanFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [title, setTitle] = useState(initial.title);
  const [startedOn, setStartedOn] = useState(initial.startedOn);
  const [objectiveId, setObjectiveId] = useState(initial.objectiveId ?? "");
  const objective = objectives.find((item) => item.id === objectiveId) ?? null;
  const weekdays = objective?.weekdays ?? [];

  // Create: copy from the chosen objective's active plan, or from a free origin plan.
  const sourcePlan = sourcePlanId ? copySources[sourcePlanId] : undefined;
  const copySource =
    mode === "create"
      ? objective
        ? (objective.activePlan && copySources[objective.activePlan.id]) || null
        : sourcePlan && !objectives.some((item) => item.activePlan?.id === sourcePlan.id)
          ? sourcePlan
          : null
      : null;

  const initialCopy = mode === "create" && Boolean(sourcePlanId) && copySource?.id === sourcePlanId;
  const [copy, setCopy] = useState(initialCopy);
  const [initialCopied] = useState(() =>
    initialCopy && copySource ? fromSource(copySource, weekdays) : null,
  );
  const [workouts, setWorkouts] = useState<WorkoutDraft[]>(() => {
    if (initialCopied) return initialCopied.workouts;
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
  const [schedule, setSchedule] = useState<ScheduleByKey>(
    () => initialCopied?.schedule ?? suggestByKey(weekdays, workouts),
  );
  // While untouched, the schedule keeps following the A, B, C… suggestion as workouts change.
  const [scheduleEdited, setScheduleEdited] = useState(initialCopy);
  const [confirmEndOther, setConfirmEndOther] = useState(false);
  const [clientErrors, setClientErrors] = useState<PlanErrors | null>(null);
  const errors = clientErrors ?? state?.errors;

  const otherPlan =
    objective?.activePlan && objective.activePlan.id !== planId ? objective.activePlan : null;
  const endingPlan = mode === "create" ? (objective ? otherPlan : copy ? copySource : null) : otherPlan;
  const endingOn =
    mode === "create"
      ? addDays(startedOn, -1)
      : otherPlan && addDays(today, -1) >= otherPlan.startedOn
        ? addDays(today, -1)
        : (otherPlan?.startedOn ?? today);

  function applyObjective(nextId: string) {
    setObjectiveId(nextId);
    setConfirmEndOther(false);
    const next = objectives.find((item) => item.id === nextId) ?? null;
    const nextWeekdays = next?.weekdays ?? [];
    if (mode === "create" && copy) {
      const nextSource = next?.activePlan ? copySources[next.activePlan.id] : undefined;
      if (nextSource) {
        const copied = fromSource(nextSource, nextWeekdays);
        setWorkouts(copied.workouts);
        setSchedule(copied.schedule);
        setScheduleEdited(true);
        return;
      }
      setCopy(false);
    }
    setScheduleEdited(false);
    setSchedule(suggestByKey(nextWeekdays, workouts));
  }

  function toggleCopy(checked: boolean) {
    setCopy(checked);
    if (checked && copySource) {
      const copied = fromSource(copySource, weekdays);
      setWorkouts(copied.workouts);
      setSchedule(copied.schedule);
      setScheduleEdited(true);
    } else {
      const fresh = [blankWorkout([])];
      setWorkouts(fresh);
      setSchedule(suggestByKey(weekdays, fresh));
      setScheduleEdited(false);
    }
  }

  function updateWorkout(index: number, patch: Partial<WorkoutDraft>) {
    setWorkouts((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addWorkout() {
    const next = [...workouts, blankWorkout(workouts.map((workout) => workout.label))];
    setWorkouts(next);
    if (!scheduleEdited) setSchedule(suggestByKey(weekdays, next));
  }

  function removeWorkout(index: number) {
    const removedKey = workouts[index].key;
    const next = workouts.filter((_, i) => i !== index);
    setWorkouts(next);
    if (!scheduleEdited) {
      setSchedule(suggestByKey(weekdays, next));
      return;
    }
    setSchedule((current) => {
      const next: ScheduleByKey = {};
      for (const day of WEEKDAYS) {
        if (day.value in current) next[day.value] = current[day.value] === removedKey ? null : current[day.value];
      }
      return next;
    });
  }

  function moveWorkout(index: number, offset: -1 | 1) {
    setWorkouts((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }

  function buildDraft() {
    const scheduleByIndex: Partial<Record<Weekday, number | null>> = {};
    for (const weekday of weekdays.filter(isWeekday)) {
      const key = schedule[weekday];
      const index = key ? workouts.findIndex((workout) => workout.key === key) : -1;
      scheduleByIndex[weekday] = index >= 0 ? index : null;
    }
    return {
      title,
      startedOn,
      objectiveId: objectiveId || null,
      workouts,
      schedule: scheduleByIndex,
      confirmEndOther,
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = buildDraft();
    const found = validatePlan(draft, {
      minStartedOn:
        mode === "create" && endingPlan
          ? {
              day: endingPlan.startedOn,
              message: `A ${endingPlan.title} começou em ${formatNumericDate(endingPlan.startedOn)}. A nova precisa começar depois.`,
            }
          : undefined,
    });
    if (mode === "edit" && otherPlan && !confirmEndOther) {
      found.objective = `Confirme que a ${otherPlan.title} será encerrada.`;
    }
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

      <Field label="Começa em" error={errors?.startedOn}>
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

      <Field
        label="Objetivo de academia (opcional)"
        error={errors?.objective}
        hint={
          objectives.length === 0
            ? "Você ainda não tem objetivo do tipo Academia. A ficha fica livre: sem agenda e fora do Hoje. Dá para vincular depois."
            : 'A agenda usa os dias deste objetivo. Escolha "Nenhum" para uma ficha livre (sem agenda e fora do Hoje); dá para vincular depois.'
        }
      >
        {(id, describedBy) => (
          <div className={ui.group} data-invalid={Boolean(errors?.objective) || undefined}>
            <select
              id={id}
              className={styles.select}
              value={objectiveId}
              aria-describedby={describedBy}
              onChange={(event) => applyObjective(event.target.value)}
            >
              <option value="">Nenhum (ficha livre)</option>
              {objectives.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {formatWeekdays(item.weekdays)}
                </option>
              ))}
            </select>
          </div>
        )}
      </Field>

      {mode === "edit" && hasSchedule && objectiveId !== (initial.objectiveId ?? "") && (
        <Notice>Trocar o objetivo apaga a agenda desta ficha.</Notice>
      )}

      {endingPlan && (mode === "create" || otherPlan) && (
        <Notice>
          A {endingPlan.title} será encerrada em {formatNumericDate(endingOn)}. O histórico dela continua
          em Encerradas.
        </Notice>
      )}
      {mode === "edit" && otherPlan && (
        <label className={styles.checkRow}>
          <input
            className={g.checkbox}
            type="checkbox"
            checked={confirmEndOther}
            onChange={(event) => setConfirmEndOther(event.target.checked)}
          />
          <span>Encerrar a {otherPlan.title} e vincular esta ficha</span>
        </label>
      )}
      {mode === "create" && copySource && (
        <label className={styles.checkRow}>
          <input
            className={g.checkbox}
            type="checkbox"
            checked={copy}
            onChange={(event) => toggleCopy(event.target.checked)}
          />
          <span>Copiar treinos, exercícios, cargas e agenda da {copySource.title}</span>
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
        {mode === "create" && <p className={ui.hint}>Os exercícios entram depois, na tela de cada treino.</p>}
      </section>

      {mode === "create" && objective && (
        <section className={ui.section}>
          <h2 className={ui.sectionTitle}>Agenda · dias de {objective.title}</h2>
          <ul className={`${ui.list} ${styles.list}`}>
            {WEEKDAYS.filter((day) => weekdays.includes(day.value)).map((day) => (
              <li key={day.value} className={styles.scheduleRow}>
                <label className={styles.scheduleDay} htmlFor={`schedule-${day.value}`}>
                  {day.long}
                </label>
                <select
                  id={`schedule-${day.value}`}
                  className={styles.scheduleSelect}
                  value={schedule[day.value] ?? ""}
                  onChange={(event) => {
                    setScheduleEdited(true);
                    setSchedule((current) => ({ ...current, [day.value]: event.target.value || null }));
                  }}
                >
                  {workouts.map((workout) => (
                    <option key={workout.key} value={workout.key}>
                      {formatWorkoutName({
                        label: workout.label || "?",
                        description: workout.description.trim() || null,
                      })}
                    </option>
                  ))}
                  <option value="">Sem treino fixo</option>
                </select>
              </li>
            ))}
          </ul>
          {errors?.schedule && <p className={g.fieldError}>{errors.schedule}</p>}
          <p className={ui.hint}>
            &quot;Sem treino fixo&quot; faz o Hoje perguntar qual treino fazer naquele dia.
          </p>
        </section>
      )}

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

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className={styles.notice}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      <span>{children}</span>
    </p>
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
