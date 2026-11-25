"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { addMonths, formatDayMonth, isDay } from "@/app/utils/dates";
import type { ProgressSource } from "@/app/utils/goals";
import { formatWeekdays } from "@/app/utils/weekdays";
import { ObjectiveBadge } from "../objectives/objective-badge";
import ui from "../objectives/objectives.module.css";
import type { GoalFormState } from "./actions";
import type { Goal, GoalObjective } from "./data";
import { getObjectiveCapacities } from "./feasibility";
import { splitGoal, SPLIT_MAX_STAGES } from "./split";
import { DEFAULT_UNIT_LABEL, ENTRY_UNIT_LABEL, formatCount } from "./format";
import {
  countErrors,
  FIRST_STAGE_ERROR,
  getObjectiveTargets,
  getStageTotal,
  GOAL_TITLE_MAX_LENGTH,
  parseTarget,
  STAGE_ORDER_ERROR,
  STAGE_TARGET_MAX,
  STAGE_TITLE_MAX_LENGTH,
  UNIT_LABEL_MAX_LENGTH,
  validateGoal,
  validateStageDates,
  type GoalDraft,
  type TargetMode,
} from "./validation";
import styles from "./goals.module.css";

type StageState = {
  key: number;
  title: string;
  target: string;
  dueOn: string;
  mode: TargetMode;
  targets: Record<string, string>;
  locked: boolean;
  /** Cumulative count when the stage was completed (shown on locked stages). */
  savedCount?: number;
};

type GoalFormProps = {
  action: (prev: GoalFormState, formData: FormData) => Promise<GoalFormState>;
  goal?: Goal;
  objectives: GoalObjective[];
  /** Checks per objective since the saved goal start, for the feasibility preview. */
  doneByObjective?: Record<string, number>;
  today: string;
  submitLabel: string;
};

const DUE_SHORTCUTS = [3, 6, 12];

const PROGRESS_SOURCES: { id: ProgressSource; label: string }[] = [
  { id: "checks", label: "Checks dos objetivos" },
  { id: "entries", label: "Registro na meta" },
];

const TARGET_MODES: { id: TargetMode; label: string }[] = [
  { id: "per-objective", label: "Por objetivo" },
  { id: "total", label: "Alvo total" },
];

let nextKey = 0;

function emptyStage(): StageState {
  return {
    key: nextKey++,
    title: "",
    target: "",
    dueOn: "",
    mode: "per-objective",
    targets: {},
    locked: false,
  };
}

function initialStages(goal?: Goal): StageState[] {
  if (!goal) return [emptyStage()];
  return goal.stages.map((stage) => ({
    key: nextKey++,
    title: stage.title ?? "",
    target: String(stage.targetCount),
    dueOn: stage.dueOn,
    mode: stage.objectiveTargets ? "per-objective" : "total",
    targets: Object.fromEntries(
      (stage.objectiveTargets ?? []).map((target) => [target.objectiveId, String(target.targetCount)]),
    ),
    locked: stage.completed,
    savedCount: stage.checksCount,
  }));
}

export function GoalForm({
  action,
  goal,
  objectives,
  doneByObjective = {},
  today,
  submitLabel,
}: GoalFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [unitLabel, setUnitLabel] = useState(goal?.unitLabel ?? "");
  const [startsOn, setStartsOn] = useState(goal?.startsOn ?? today);
  const [progressSource, setProgressSource] = useState<ProgressSource>(
    goal?.progressSource ?? "checks",
  );
  const [stages, setStages] = useState(() => initialStages(goal));
  const [objectiveIds, setObjectiveIds] = useState<string[]>(
    goal?.objectives.map((objective) => objective.id) ?? [],
  );
  const [submitted, setSubmitted] = useState(false);

  const draft: GoalDraft = {
    title,
    description,
    unitLabel,
    startsOn,
    progressSource,
    stages,
    objectiveIds,
  };
  const byEntries = progressSource === "entries";
  const sourceLocked = stages.some((stage) => stage.locked);
  const errors = submitted ? validateGoal(draft) : state?.errors;
  const liveDateErrors = validateStageDates(startsOn, stages).map((message) =>
    message === STAGE_ORDER_ERROR || message === FIRST_STAGE_ERROR ? message : undefined,
  );
  const unit =
    unitLabel.trim() || (progressSource === "entries" ? ENTRY_UNIT_LABEL : DEFAULT_UNIT_LABEL);
  const selectedObjectives = objectives.filter((objective) => objectiveIds.includes(objective.id));
  const lastLockedIndex = stages.findLastIndex((stage) => stage.locked);
  const done = goal && startsOn === goal.startsOn ? doneByObjective : {};

  function updateStage(index: number, changes: Partial<StageState>) {
    setStages((current) =>
      current.map((stage, i) => (i === index ? { ...stage, ...changes } : stage)),
    );
  }

  // Swaps only title and targets: each position keeps its deadline so the dates stay in order.
  function moveStage(index: number, direction: -1 | 1) {
    setStages((current) => {
      const next = [...current];
      const other = index + direction;
      const a = next[index];
      const b = next[other];
      const swap = (stage: StageState) => ({
        title: stage.title,
        target: stage.target,
        mode: stage.mode,
        targets: stage.targets,
      });
      next[index] = { ...a, ...swap(b) };
      next[other] = { ...b, ...swap(a) };
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
          <div className={styles.field}>
            <span className={styles.label} id="progress-source-label">
              Como medir o progresso
            </span>
            <input type="hidden" name="progress_source" value={progressSource} />
            <div
              className={`${styles.tabs} ${styles.modeTabs}`}
              role="group"
              aria-labelledby="progress-source-label"
            >
              {PROGRESS_SOURCES.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={styles.tab}
                  aria-pressed={progressSource === source.id}
                  disabled={sourceLocked}
                  onClick={() => setProgressSource(source.id)}
                >
                  {source.label}
                </button>
              ))}
            </div>
            <span className={styles.fieldHint}>
              {sourceLocked
                ? "Não muda depois que uma etapa foi concluída."
                : byEntries
                  ? "Você registra o progresso na própria meta, ex.: +1 livro ou \"corri 5km\"."
                  : "Cada check dos objetivos escolhidos conta para a meta."}
            </span>
          </div>

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
              label={byEntries ? "Contar como" : "Contar como · opcional"}
              error={errors?.unitLabel}
              hint={
                byEntries
                  ? `O que cada registro representa, no plural. Vazio mostra "${ENTRY_UNIT_LABEL}".`
                  : `O que cada check representa, no plural. Vazio mostra "${DEFAULT_UNIT_LABEL}".`
              }
            >
              <input
                className={ui.input}
                name="unit_label"
                type="text"
                autoComplete="off"
                placeholder={byEntries ? "livros" : DEFAULT_UNIT_LABEL}
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

          <fieldset className={styles.section}>
            <legend className={`${ui.sectionTitle} ${styles.legend}`}>
              {byEntries ? "Hábitos de apoio · opcional" : "Objetivos que contam"}
            </legend>
            {objectives.length === 0 ? (
              <p className={ui.empty}>
                {byEntries
                  ? "Nenhum objetivo criado. Você pode montar a meta mesmo assim."
                  : "Crie um objetivo antes de montar uma meta."}
              </p>
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
            <p className={ui.hint}>
              {byEntries
                ? "Os checks aparecem na meta como apoio, mas não contam para o alvo."
                : "Um check conta para todas as metas vinculadas ao objetivo."}
            </p>
          </fieldset>

          <Field label="Descrição · opcional">
            <textarea
              className={`${ui.input} ${styles.textarea}`}
              name="description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

        </div>

        <div className={styles.column}>
          <section className={styles.section} aria-labelledby="stages-title">
            <h2 id="stages-title" className={ui.sectionTitle}>
              Etapas
            </h2>
            <p className={styles.fieldHint}>
              Cada etapa é um ponto do caminho até o total da meta. O alvo é acumulado desde o
              início: 6 livros e depois 12, e o que você fez na etapa 1 continua contando na 2.
            </p>
            {lastLockedIndex === -1 && (
              <SplitStages
                startsOn={startsOn}
                unit={unit}
                defaultOpen={!goal}
                objectives={selectedObjectives}
                byEntries={byEntries}
                done={done}
                today={today}
                onSplit={setStages}
              />
            )}
            {errors?.stagesList && <p className={styles.fieldError}>{errors.stagesList}</p>}
            <ol className={styles.stages}>
              {stages.map((stage, index) => {
                const stageErrors = errors?.stages[index];
                const dueError = stageErrors?.dueOn ?? liveDateErrors[index];
                const canMoveUp = index > 0 && !stage.locked && !stages[index - 1].locked;
                const canMoveDown =
                  index < stages.length - 1 && !stage.locked && !stages[index + 1].locked;
                const canRemove = stages.length > 1 && !stage.locked && index > lastLockedIndex;
                const mode = byEntries ? "total" : stage.mode;
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
                        placeholder="Nome · opcional (ex.: Correr 5km)"
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

                    <input type="hidden" name={`stage_${index}_mode`} value={mode} />
                    {!byEntries && (stage.mode === "per-objective" || selectedObjectives.length > 1) && (
                      <div
                        className={`${styles.tabs} ${styles.modeTabs}`}
                        role="group"
                        aria-label={`Alvo da etapa ${index + 1}`}
                      >
                        {TARGET_MODES.map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            className={styles.tab}
                            aria-pressed={stage.mode === mode.id}
                            disabled={stage.locked}
                            onClick={() => updateStage(index, { mode: mode.id })}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={styles.stageFields}>
                      {mode === "per-objective" ? (
                        <input type="hidden" name="stage_target" value="" />
                      ) : (
                        <label className={styles.stageField}>
                          <span className={styles.label}>Alvo acumulado</span>
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
                      )}
                      <label
                        className={styles.stageField}
                        data-wide={mode === "per-objective" || undefined}
                      >
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

                    {mode === "per-objective" && (
                      <ObjectiveTargets
                        stage={stage}
                        index={index}
                        objectives={selectedObjectives}
                        unit={unit}
                        invalid={Boolean(stageErrors?.target)}
                        onChange={(objectiveId, value) =>
                          updateStage(index, { targets: { ...stage.targets, [objectiveId]: value } })
                        }
                      />
                    )}
                    {stageErrors?.target ? (
                      <p className={styles.fieldError}>{stageErrors.target}</p>
                    ) : (
                      index > 0 && (
                        <StageStep
                          total={getStageTotal(stage, progressSource, objectiveIds)}
                          previous={getStageTotal(stages[index - 1], progressSource, objectiveIds)}
                          unit={unit}
                        />
                      )
                    )}
                    {dueError && (
                      <p className={styles.fieldError} role="alert">
                        {dueError}
                      </p>
                    )}

                    {stage.locked ? (
                      <p className={styles.lockedNote}>
                        Concluída com {formatCount(stage.savedCount ?? 0, unit)}. Etapas
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

                    {byEntries && !stage.locked && (
                      <p className={styles.fieldHint}>
                        Uma etapa que soma só 1 ao total funciona como um marco, ex.: &quot;Correr
                        5km&quot;.
                      </p>
                    )}
                    {!byEntries && !stage.locked && (
                      <Capacity
                        stage={stage}
                        startsOn={startsOn}
                        objectives={selectedObjectives}
                        done={done}
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

function StageStep({
  total,
  previous,
  unit,
}: {
  total: number | null;
  previous: number | null;
  unit: string;
}) {
  if (total === null || previous === null || total <= previous) return null;
  return (
    <p className={styles.fieldHint}>
      Soma {formatCount(total - previous, unit)} aos {previous} da etapa anterior.
    </p>
  );
}

type SplitValues = {
  mode: TargetMode;
  total: string;
  totals: Record<string, string>;
  count: string;
  dueOn: string;
};

type SplitPlan = { dueOn: string; total: number; targets: Record<string, string> | null }[];

function SplitStages({
  startsOn,
  unit,
  defaultOpen,
  objectives,
  byEntries,
  done,
  today,
  onSplit,
}: {
  startsOn: string;
  unit: string;
  defaultOpen: boolean;
  /** The goal's selected objectives. */
  objectives: GoalObjective[];
  byEntries: boolean;
  done: Record<string, number>;
  today: string;
  onSplit: (stages: StageState[]) => void;
}) {
  const [values, setValues] = useState<SplitValues>({
    mode: "per-objective",
    total: "",
    totals: {},
    count: "2",
    dueOn: "",
  });
  const canChooseMode = !byEntries && objectives.length > 1;
  const perObjective = canChooseMode && values.mode === "per-objective";
  const plan = planSplit(values);
  const touched =
    values.total.trim() !== "" ||
    values.dueOn !== "" ||
    Object.values(values.totals).some((value) => value.trim() !== "");

  function planSplit(next: SplitValues): { stages: SplitPlan } | { error: string } {
    const count = next.count.trim() && Number.isInteger(Number(next.count)) ? Number(next.count) : null;
    const split = (total: number | null) => splitGoal({ total, count, startsOn, dueOn: next.dueOn });
    if (!(canChooseMode && next.mode === "per-objective")) {
      const result = split(parseTarget(next.total));
      if ("error" in result) return result;
      return {
        stages: result.stages.map((stage) => ({ dueOn: stage.dueOn, total: stage.target, targets: null })),
      };
    }

    const filled = objectives.flatMap((objective) => {
      const total = parseTarget(next.totals[objective.id] ?? "");
      return total === null ? [] : [{ objective, result: split(total) }];
    });
    if (filled.length === 0) return { error: "Informe o total de pelo menos um objetivo." };
    const splits: { objectiveId: string; stages: { target: number; dueOn: string }[] }[] = [];
    for (const { objective, result } of filled) {
      if ("error" in result) return { error: `${objective.title}: ${result.error}` };
      splits.push({ objectiveId: objective.id, stages: result.stages });
    }
    return {
      stages: splits[0].stages.map((stage, index) => {
        const targets = Object.fromEntries(
          splits.map((item) => [item.objectiveId, String(item.stages[index].target)]),
        );
        const total = Object.values(targets).reduce((sum, value) => sum + Number(value), 0);
        return { dueOn: stage.dueOn, total, targets };
      }),
    };
  }

  // Generates the stages as soon as the fields form a valid split, no extra button.
  function update(changes: Partial<SplitValues>) {
    const next = { ...values, ...changes };
    setValues(next);
    const result = planSplit(next);
    if ("error" in result) return;
    onSplit(
      result.stages.map((stage) => ({
        ...emptyStage(),
        title: "",
        target: stage.targets ? "" : String(stage.total),
        dueOn: stage.dueOn,
        mode: stage.targets ? "per-objective" : "total",
        targets: stage.targets ?? {},
      })),
    );
  }

  const countField = (
    <label className={styles.stageField}>
      <span className={styles.label}>Etapas</span>
      <span className={ui.group}>
        <input
          className={`${ui.input} ${styles.targetInput}`}
          type="number"
          inputMode="numeric"
          min={1}
          max={SPLIT_MAX_STAGES}
          step={1}
          value={values.count}
          onChange={(event) => update({ count: event.target.value })}
        />
      </span>
    </label>
  );

  const dueField = (
    <label className={styles.stageField} data-wide={!perObjective || undefined}>
      <span className={styles.label}>Prazo final</span>
      <span className={ui.group}>
        <input
          className={ui.input}
          type="date"
          value={values.dueOn}
          onChange={(event) => update({ dueOn: event.target.value })}
        />
      </span>
    </label>
  );

  return (
    <details className={styles.split} open={defaultOpen}>
      <summary className={styles.splitSummary}>Dividir automaticamente</summary>
      <div className={styles.splitBody}>
        {canChooseMode && (
          <div className={`${styles.tabs} ${styles.modeTabs}`} role="group" aria-label="Como dividir">
            {TARGET_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={styles.tab}
                aria-pressed={values.mode === mode.id}
                onClick={() => update({ mode: mode.id })}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}

        {perObjective ? (
          <>
            <ul className={`${ui.list} ${styles.targetList}`}>
              {objectives.map((objective) => (
                <li key={objective.id}>
                  <label className={`${ui.row} ${styles.targetRow}`}>
                    <ObjectiveBadge color={objective.color} icon={objective.icon} />
                    <span className={`${ui.rowTitle} ${styles.targetName}`}>{objective.title}</span>
                    <span className={`${ui.group} ${styles.suffixGroup} ${styles.targetGroup}`}>
                      <input
                        className={`${ui.input} ${styles.targetInput}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={STAGE_TARGET_MAX}
                        step={1}
                        placeholder="0"
                        aria-label={`Total de ${objective.title} na meta`}
                        value={values.totals[objective.id] ?? ""}
                        onChange={(event) =>
                          update({ totals: { ...values.totals, [objective.id]: event.target.value } })
                        }
                      />
                      <span className={styles.suffix}>{unit}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className={styles.stageFields}>
              {countField}
              {dueField}
            </div>
          </>
        ) : (
          <>
            <div className={styles.stageFields}>
              <label className={styles.stageField}>
                <span className={styles.label}>Total da meta</span>
                <span className={`${ui.group} ${styles.suffixGroup}`}>
                  <input
                    className={`${ui.input} ${styles.targetInput}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={STAGE_TARGET_MAX}
                    step={1}
                    value={values.total}
                    onChange={(event) => update({ total: event.target.value })}
                  />
                  <span className={styles.suffix}>{unit}</span>
                </span>
              </label>
              {countField}
            </div>
            {dueField}
          </>
        )}

        {isDay(startsOn) && (
          <div className={ui.presets}>
            {DUE_SHORTCUTS.map((months) => {
              const due = addMonths(startsOn, months);
              return (
                <button
                  key={months}
                  type="button"
                  className={ui.chip}
                  aria-pressed={values.dueOn === due}
                  onClick={() => update({ dueOn: due })}
                >
                  em {months} meses
                </button>
              );
            })}
          </div>
        )}

        {!byEntries &&
          (objectives.length === 0 ? (
            <p className={styles.fieldHint}>
              Escolha os objetivos acima para ver quantos dias programados eles têm.
            </p>
          ) : (
            <SplitCapacity
              objectives={objectives}
              startsOn={startsOn}
              dueOn={values.dueOn}
              today={today}
              done={done}
              total={perObjective ? null : parseTarget(values.total)}
              totals={perObjective ? values.totals : null}
            />
          ))}

        {"stages" in plan ? (
          <p className={styles.fieldHint}>
            Etapas geradas abaixo:{" "}
            {plan.stages.map((stage) => `${stage.total} até ${formatDayMonth(stage.dueOn)}`).join(" · ")}
            . Mudar estes campos refaz as etapas.
          </p>
        ) : (
          touched && <p className={styles.fieldHint}>{plan.error}</p>
        )}
      </div>
    </details>
  );
}

/** Scheduled days of the selected objectives through the final deadline, against the split totals. */
function SplitCapacity({
  objectives,
  startsOn,
  dueOn,
  today,
  done,
  total,
  totals,
}: {
  objectives: GoalObjective[];
  startsOn: string;
  dueOn: string;
  today: string;
  done: Record<string, number>;
  total: number | null;
  totals: Record<string, string> | null;
}) {
  const capacities = getObjectiveCapacities({
    objectives,
    startsOn,
    dueOn,
    today,
    doneByObjective: done,
  });
  if (!capacities) {
    return (
      <p className={styles.fieldHint}>Escolha o prazo final para ver os dias programados.</p>
    );
  }
  const until = formatDayMonth(dueOn);
  const rows: CapacityRow[] = objectives.map((objective, index) => {
    const { capacity } = capacities[index];
    const target = totals ? parseTarget(totals[objective.id] ?? "") : null;
    return { objective, capacity, target, short: target !== null && capacity < target };
  });

  let feasible: boolean | undefined;
  let summary = `Dias programados até ${until}, contando desde o início da meta:`;
  if (totals) {
    const withTarget = rows.filter((row) => row.target !== null);
    if (withTarget.length > 0) {
      feasible = withTarget.every((row) => !row.short);
      summary = feasible
        ? `Todos os totais cabem nos dias programados até ${until}.`
        : `Nem todos os totais cabem nos dias programados até ${until}. Dá para salvar mesmo assim.`;
    }
  } else if (total !== null) {
    const capacity = rows.reduce((sum, row) => sum + row.capacity, 0);
    feasible = capacity >= total;
    summary = feasible
      ? `Você terá até ${capacity} dias programados até ${until}. Total ${total}.`
      : `Você terá no máximo ${capacity} dias programados até ${until}, menos que o total de ${total}. Dá para salvar mesmo assim.`;
  }

  return <CapacityBox feasible={feasible} summary={summary} rows={rows} />;
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

function ObjectiveTargets({
  stage,
  index,
  objectives,
  unit,
  invalid,
  onChange,
}: {
  stage: StageState;
  index: number;
  objectives: GoalObjective[];
  unit: string;
  invalid: boolean;
  onChange: (objectiveId: string, value: string) => void;
}) {
  if (objectives.length === 0) {
    return <p className={styles.fieldHint}>Escolha os objetivos da meta para definir os alvos.</p>;
  }
  const total = getObjectiveTargets(
    stage,
    objectives.map((objective) => objective.id),
  ).reduce((sum, target) => sum + target.targetCount, 0);

  return (
    <div className={styles.objectiveTargets}>
      <ul className={`${ui.list} ${styles.targetList}`}>
        {objectives.map((objective) => (
          <li key={objective.id}>
            <label className={`${ui.row} ${styles.targetRow}`}>
              <ObjectiveBadge color={objective.color} icon={objective.icon} />
              <span className={`${ui.rowTitle} ${styles.targetName}`}>{objective.title}</span>
              <span
                className={`${ui.group} ${styles.suffixGroup} ${styles.targetGroup}`}
                data-invalid={invalid || undefined}
              >
                <input
                  className={`${ui.input} ${styles.targetInput}`}
                  name={`stage_${index}_target_${objective.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={STAGE_TARGET_MAX}
                  step={1}
                  placeholder="0"
                  aria-label={`Alvo de ${objective.title} na etapa ${index + 1}`}
                  value={stage.targets[objective.id] ?? ""}
                  readOnly={stage.locked}
                  onChange={(event) => onChange(objective.id, event.target.value)}
                />
                <span className={styles.suffix}>{unit}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className={styles.fieldHint}>
        Total: {formatCount(total, unit)}. A etapa só conclui quando cada objetivo bater o próprio alvo;
        objetivo sem alvo não conta nesta etapa.
      </p>
    </div>
  );
}

function Capacity({
  stage,
  startsOn,
  objectives,
  done,
  today,
}: {
  stage: StageState;
  startsOn: string;
  objectives: GoalObjective[];
  done: Record<string, number>;
  today: string;
}) {
  if (objectives.length === 0) return null;
  const perObjective = getObjectiveCapacities({
    objectives,
    startsOn,
    dueOn: stage.dueOn,
    today,
    doneByObjective: done,
  });
  if (perObjective === null) return null;
  const until = formatDayMonth(stage.dueOn);

  let feasible: boolean | undefined;
  let summary: string;
  const rows = objectives.map((objective, i) => {
    const { capacity } = perObjective[i];
    const target =
      stage.mode === "per-objective" ? parseTarget(stage.targets[objective.id] ?? "") : null;
    return { objective, capacity, target, short: target !== null && capacity < target };
  });

  if (stage.mode === "per-objective") {
    const withTarget = rows.filter((row) => row.target !== null);
    if (withTarget.length === 0) {
      summary = `Até ${until}, contando desde o início da meta:`;
    } else {
      feasible = withTarget.every((row) => !row.short);
      summary = feasible
        ? `Todos os alvos cabem nos dias programados até ${until}.`
        : `Nem todos os alvos cabem nos dias programados até ${until}. Dá para salvar mesmo assim.`;
    }
  } else {
    const capacity = perObjective.reduce((total, item) => total + item.capacity, 0);
    const target = parseTarget(stage.target);
    if (target === null) {
      summary = `Até ${until}, contando desde o início da meta:`;
    } else {
      feasible = capacity >= target;
      summary = feasible
        ? `Você terá até ${capacity} dias desde o início da meta até ${until}. Alvo ${target}.`
        : `Você terá no máximo ${capacity} dias desde o início da meta até ${until}, menos que o alvo de ${target}. Dá para salvar mesmo assim.`;
    }
  }

  return <CapacityBox feasible={feasible} summary={summary} rows={rows} />;
}

type CapacityRow = { objective: GoalObjective; capacity: number; target: number | null; short: boolean };

function CapacityBox({
  feasible,
  summary,
  rows,
}: {
  feasible: boolean | undefined;
  summary: string;
  rows: CapacityRow[];
}) {
  return (
    <div className={styles.capacity} data-feasible={feasible}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {feasible === false ? (
          <>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17v.01" />
          </>
        ) : feasible ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 3 3 5-6" />
          </>
        ) : (
          <>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </>
        )}
      </svg>
      <div className={styles.capacityBody}>
        <p>{summary}</p>
        <ul className={styles.capacityList}>
          {rows.map((row) => (
            <li key={row.objective.id} data-short={row.short || undefined}>
              <span>{row.objective.title}</span>
              <span>
                {row.capacity} {row.capacity === 1 ? "dia" : "dias"}
                {row.target !== null &&
                  (row.short ? ` · alvo ${row.target} não cabe` : ` · alvo ${row.target}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
