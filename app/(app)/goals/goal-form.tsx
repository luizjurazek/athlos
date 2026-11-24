"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { addDays, addMonths, formatDayMonth, isDay } from "@/app/utils/dates";
import { formatWeekdays } from "@/app/utils/weekdays";
import { ObjectiveBadge } from "../objectives/objective-badge";
import ui from "../objectives/objectives.module.css";
import type { GoalFormState } from "./actions";
import type { Goal, GoalObjective } from "./data";
import { describeObjectives, getStageCapacity } from "./feasibility";
import { DEFAULT_UNIT_LABEL, formatCount } from "./format";
import {
  countErrors,
  FIRST_STAGE_ERROR,
  GOAL_TITLE_MAX_LENGTH,
  parseTarget,
  STAGE_ORDER_ERROR,
  STAGE_TARGET_MAX,
  STAGE_TITLE_MAX_LENGTH,
  UNIT_LABEL_MAX_LENGTH,
  validateGoal,
  validateStageDates,
  type GoalDraft,
} from "./validation";
import styles from "./goals.module.css";

type StageState = {
  key: number;
  title: string;
  target: string;
  dueOn: string;
  locked: boolean;
  saved?: { windowStart: string; dueOn: string; checksCount: number };
};

type GoalFormProps = {
  action: (prev: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  goal?: Goal;
  objectives: GoalObjective[];
  today: string;
  submitLabel: string;
};

const DUE_SHORTCUTS = [3, 6, 12];

let nextKey = 0;

function emptyStage(): StageState {
  return { key: nextKey++, title: "", target: "", dueOn: "", locked: false };
}

function initialStages(goal?: Goal): StageState[] {
  if (!goal) return [emptyStage()];
  return goal.stages.map((stage) => ({
    key: nextKey++,
    title: stage.title,
    target: String(stage.targetCount),
    dueOn: stage.dueOn,
    locked: stage.completed,
    saved: { windowStart: stage.windowStart, dueOn: stage.dueOn, checksCount: stage.checksCount },
  }));
}

export function GoalForm({ action, goal, objectives, today, submitLabel }: GoalFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [unitLabel, setUnitLabel] = useState(goal?.unitLabel ?? "");
  const [startsOn, setStartsOn] = useState(goal?.startsOn ?? today);
  const [stages, setStages] = useState(() => initialStages(goal));
  const [objectiveIds, setObjectiveIds] = useState<string[]>(
    goal?.objectives.map((objective) => objective.id) ?? [],
  );
  const [submitted, setSubmitted] = useState(false);

  const draft: GoalDraft = { title, description, unitLabel, startsOn, stages, objectiveIds };
  const errors = submitted ? validateGoal(draft) : state?.errors;
  const liveDateErrors = validateStageDates(startsOn, stages).map((message) =>
    message === STAGE_ORDER_ERROR || message === FIRST_STAGE_ERROR ? message : undefined,
  );
  const unit = unitLabel.trim() || DEFAULT_UNIT_LABEL;
  const selectedObjectives = objectives.filter((objective) => objectiveIds.includes(objective.id));
  const lastLockedIndex = stages.findLastIndex((stage) => stage.locked);

  function updateStage(index: number, changes: Partial<StageState>) {
    setStages((current) =>
      current.map((stage, i) => (i === index ? { ...stage, ...changes } : stage)),
    );
  }

  // Swaps only title and target: each position keeps its deadline so the dates stay in order.
  function moveStage(index: number, direction: -1 | 1) {
    setStages((current) => {
      const next = [...current];
      const other = index + direction;
      const a = next[index];
      const b = next[other];
      next[index] = { ...a, title: b.title, target: b.target };
      next[other] = { ...b, title: a.title, target: a.target };
      return next;
    });
  }

  function toggleObjective(id: string) {
    setObjectiveIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (countErrors(validateGoal(draft)) > 0) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const errorCount = errors ? countErrors(errors) : 0;
  const lateStages = liveDateErrors.flatMap((message, index) => (message ? [index + 1] : []));
  const summary =
    errorCount > 0
      ? `${errorCount} ${errorCount === 1 ? "campo para corrigir" : "campos para corrigir"}.`
      : lateStages.length > 0
        ? `${lateStages.length === 1 ? "1 prazo para corrigir na etapa" : `${lateStages.length} prazos para corrigir nas etapas`} ${lateStages.join(", ")}.`
        : null;

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      {state?.error && (
        <p className={ui.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={styles.columns}>
        <div className={styles.column}>
          <div className={styles.fields}>
            <Field label="Título" error={errors?.title} className={styles.titleField}>
              <input
                className={ui.input}
                name="title"
                type="text"
                autoComplete="off"
                placeholder="Ex.: Meia maratona"
                maxLength={GOAL_TITLE_MAX_LENGTH}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field
              label="Contar como · opcional"
              error={errors?.unitLabel}
              hint='O que cada check representa, no plural. Vazio mostra "checks".'
            >
              <input
                className={ui.input}
                name="unit_label"
                type="text"
                autoComplete="off"
                placeholder={DEFAULT_UNIT_LABEL}
                maxLength={UNIT_LABEL_MAX_LENGTH}
                value={unitLabel}
                onChange={(event) => setUnitLabel(event.target.value)}
              />
            </Field>
            <Field
              label="Começa em"
              error={errors?.startsOn}
              hint={stages[0]?.locked ? "A primeira etapa já foi concluída." : undefined}
            >
              <input
                className={ui.input}
                name="starts_on"
                type="date"
                value={startsOn}
                readOnly={stages[0]?.locked}
                onChange={(event) => setStartsOn(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Descrição · opcional">
            <textarea
              className={`${ui.input} ${styles.textarea}`}
              name="description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <section className={styles.section} aria-labelledby="stages-title">
            <h2 id="stages-title" className={ui.sectionTitle}>
              Etapas
            </h2>
            {errors?.stagesList && <p className={styles.fieldError}>{errors.stagesList}</p>}
            <ol className={styles.stages}>
              {stages.map((stage, index) => {
                const stageErrors = errors?.stages[index];
                const dueError = stageErrors?.dueOn ?? liveDateErrors[index];
                const canMoveUp = index > 0 && !stage.locked && !stages[index - 1].locked;
                const canMoveDown =
                  index < stages.length - 1 && !stage.locked && !stages[index + 1].locked;
                const canRemove = stages.length > 1 && !stage.locked && index > lastLockedIndex;
                return (
                  <li key={stage.key} className={styles.stage} data-locked={stage.locked || undefined}>
                    <div className={styles.stageHeader}>
                      <span className={styles.stageNumber} aria-hidden="true">
                        {index + 1}
                      </span>
                      <input
                        className={`${ui.input} ${styles.stageTitle}`}
                        name="stage_title"
                        type="text"
                        autoComplete="off"
                        placeholder="Nome da etapa (ex.: Correr 5km)"
                        aria-label={`Nome da etapa ${index + 1}`}
                        aria-invalid={Boolean(stageErrors?.title) || undefined}
                        maxLength={STAGE_TITLE_MAX_LENGTH}
                        value={stage.title}
                        readOnly={stage.locked}
                        onChange={(event) => updateStage(index, { title: event.target.value })}
                      />
                      {!stage.locked && (
                        <div className={styles.stageActions}>
                          <IconButton
                            label={`Subir etapa ${index + 1}`}
                            disabled={!canMoveUp}
                            onClick={() => moveStage(index, -1)}
                          >
                            <path d="m6 15 6-6 6 6" />
                          </IconButton>
                          <IconButton
                            label={`Descer etapa ${index + 1}`}
                            disabled={!canMoveDown}
                            onClick={() => moveStage(index, 1)}
                          >
                            <path d="m6 9 6 6 6-6" />
                          </IconButton>
                          <IconButton
                            label={`Remover etapa ${index + 1}`}
                            disabled={!canRemove}
                            onClick={() =>
                              setStages((current) => current.filter((_, i) => i !== index))
                            }
                          >
                            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                          </IconButton>
                        </div>
                      )}
                    </div>
                    {stageErrors?.title && <p className={styles.fieldError}>{stageErrors.title}</p>}

                    <div className={styles.stageFields}>
                      <label className={styles.stageField}>
                        <span className={styles.label}>Alvo</span>
                        <span
                          className={`${ui.group} ${styles.suffixGroup}`}
                          data-invalid={Boolean(stageErrors?.target) || undefined}
                        >
                          <input
                            className={`${ui.input} ${styles.targetInput}`}
                            name="stage_target"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={STAGE_TARGET_MAX}
                            step={1}
                            value={stage.target}
                            readOnly={stage.locked}
                            onChange={(event) => updateStage(index, { target: event.target.value })}
                          />
                          <span className={styles.suffix}>{unit}</span>
                        </span>
                      </label>
                      <label className={styles.stageField}>
                        <span className={styles.label}>Prazo</span>
                        <span
                          className={ui.group}
                          data-invalid={Boolean(dueError) || undefined}
                        >
                          <input
                            className={ui.input}
                            name="stage_due"
                            type="date"
                            value={stage.dueOn}
                            readOnly={stage.locked}
                            onChange={(event) => updateStage(index, { dueOn: event.target.value })}
                          />
                        </span>
                      </label>
                    </div>
                    {stageErrors?.target && <p className={styles.fieldError}>{stageErrors.target}</p>}
                    {dueError && (
                      <p className={styles.fieldError} role="alert">
                        {dueError}
                      </p>
                    )}

                    {stage.locked ? (
                      <p className={styles.lockedNote}>
                        Concluída com {formatCount(stage.saved?.checksCount ?? 0, unitLabel)}. Etapas
                        concluídas não podem ser alteradas.
                      </p>
                    ) : (
                      isDay(startsOn) && (
                        <div className={ui.presets}>
                          {DUE_SHORTCUTS.map((months) => {
                            const due = addMonths(startsOn, months);
                            return (
                              <button
                                key={months}
                                type="button"
                                className={ui.chip}
                                aria-pressed={stage.dueOn === due}
                                onClick={() => updateStage(index, { dueOn: due })}
                              >
                                em {months} meses
                              </button>
                            );
                          })}
                        </div>
                      )
                    )}

                    {!stage.locked && (
                      <Capacity
                        stage={stage}
                        windowStart={index === 0 ? startsOn : addDaysSafe(stages[index - 1].dueOn)}
                        objectives={selectedObjectives}
                        today={today}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              className={styles.addStage}
              onClick={() => setStages((current) => [...current, emptyStage()])}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Adicionar etapa
            </button>
          </section>
        </div>

        <div className={styles.column}>
          <fieldset className={styles.section}>
            <legend className={`${ui.sectionTitle} ${styles.legend}`}>Objetivos que contam</legend>
            {objectives.length === 0 ? (
              <p className={ui.empty}>Crie um objetivo antes de montar uma meta.</p>
            ) : (
              <ul className={ui.list}>
                {objectives.map((objective) => (
                  <li key={objective.id}>
                    <label className={`${ui.row} ${styles.objectiveRow}`}>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        name="objective_ids"
                        value={objective.id}
                        checked={objectiveIds.includes(objective.id)}
                        onChange={() => toggleObjective(objective.id)}
                      />
                      <ObjectiveBadge color={objective.color} icon={objective.icon} />
                      <span className={ui.rowText}>
                        <span className={ui.rowTitle}>{objective.title}</span>
                        <span className={ui.rowMeta}>
                          {formatWeekdays(objective.weekdays)}
                          {objective.archived && " · Arquivado"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {errors?.objectives && <p className={styles.fieldError}>{errors.objectives}</p>}
            <p className={ui.hint}>Um check conta para todas as metas vinculadas ao objetivo.</p>
          </fieldset>

          <div className={styles.saveBar}>
            <button className={`${ui.button} ${styles.saveButton}`} type="submit" disabled={pending}>
              {pending ? "Salvando..." : submitLabel}
            </button>
            {summary && <p className={styles.summary}>{summary}</p>}
          </div>
        </div>
      </div>
    </form>
  );
}

function addDaysSafe(day: string) {
  return isDay(day) ? addDays(day, 1) : "";
}

function Field({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`${styles.field} ${className ?? ""}`}>
      <span className={styles.label}>{label}</span>
      <span className={ui.group} data-invalid={Boolean(error) || undefined}>
        {children}
      </span>
      {error ? (
        <span className={styles.fieldError}>{error}</span>
      ) : (
        hint && <span className={styles.fieldHint}>{hint}</span>
      )}
    </label>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

function Capacity({
  stage,
  windowStart,
  objectives,
  today,
}: {
  stage: StageState;
  windowStart: string;
  objectives: GoalObjective[];
  today: string;
}) {
  if (objectives.length === 0) return null;
  const sameWindow =
    stage.saved?.windowStart === windowStart && stage.saved?.dueOn === stage.dueOn;
  const capacity = getStageCapacity({
    objectives,
    windowStart,
    dueOn: stage.dueOn,
    today,
    doneInWindow: sameWindow ? (stage.saved?.checksCount ?? 0) : 0,
  });
  const target = parseTarget(stage.target);
  if (capacity === null || target === null) return null;

  const feasible = capacity >= target;
  const who = describeObjectives(objectives);
  const until = formatDayMonth(stage.dueOn);
  return (
    <p className={styles.capacity} data-feasible={feasible}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {feasible ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 3 3 5-6" />
          </>
        ) : (
          <>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17v.01" />
          </>
        )}
      </svg>
      <span>
        {feasible
          ? `Com ${who} você terá até ${capacity} dias até ${until}. Alvo ${target}.`
          : `Com ${who} você terá no máximo ${capacity} dias até ${until}, menos que o alvo de ${target}. Dá para salvar mesmo assim.`}
      </span>
    </p>
  );
}
