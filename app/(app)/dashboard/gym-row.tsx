"use client";

import Link from "next/link";
import { startTransition, useId, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import { formatDayMonth, formatShortDate, getWeekday } from "@/app/utils/dates";
import { WEEKDAYS } from "@/app/utils/weekdays";
import {
  describeLoadChange,
  formatLoad,
  hasLoadErrors,
  sameLoad,
  validateLoad,
  type LoadValues,
} from "@/app/utils/workout-loads";
import { ExercisePreviewSheet, getExerciseImages, PreviewThumb } from "../workouts/exercise-preview";
import { LoadFields, toLoadDraft, toLoadValues, type LoadDraft } from "../workouts/load-fields";
import { saveDayLoad, setDayWorkout, type DayWorkoutFailure } from "./actions";
import type { GymDay, GymExercise, GymWorkout } from "./gym-day";
import { Sheet, SheetError, weekdayName } from "./sheet";
import styles from "./dashboard.module.css";

export type LoadFailure = { exercise: GymExercise; before: LoadValues | null; retry: () => void };

const EXPANDED_KEY = "athlos-gym-expanded";

function workoutName(workout: GymWorkout) {
  return workout.description ? `${workout.label} — ${workout.description}` : `Treino ${workout.label}`;
}

function exerciseCount(count: number) {
  return count === 1 ? "1 exercício" : `${count} exercícios`;
}

/** Meta line of the gym objective row: the day's workout, the question, or "Sem ficha". */
export function GymRowMeta({ gym }: { gym: GymDay }) {
  if (!gym.planId) return <span>Sem ficha</span>;
  const workout = gym.workouts.find((item) => item.id === gym.workout?.workoutId);
  if (!workout) return <span>Escolher treino</span>;
  const count = gym.exercises.filter((exercise) => exercise.workoutId === workout.id).length;
  return (
    <span className={styles.gymMeta}>
      <span className={styles.gymLetter} aria-hidden="true">
        {workout.label}
      </span>
      <span>
        <span className={styles.visuallyHidden}>Treino {workout.label}: </span>
        {workout.description ?? `Treino ${workout.label}`} · {exerciseCount(count)}
      </span>
    </span>
  );
}

function readExpanded(id: string) {
  try {
    return window.sessionStorage.getItem(`${EXPANDED_KEY}:${id}`) === "1";
  } catch {
    return false;
  }
}

// sessionStorage has no change events within the tab; the panel's own toggle state covers that.
function subscribeToNothing() {
  return () => {};
}

function writeExpanded(id: string, expanded: boolean) {
  try {
    window.sessionStorage.setItem(`${EXPANDED_KEY}:${id}`, expanded ? "1" : "0");
  } catch {
    // Remembering the panel is a convenience; private mode simply starts collapsed.
  }
}

export function GymPanel({
  objective,
  gym,
  day,
  today,
  onLoadFailure,
}: {
  objective: { id: string; title: string; checked: boolean };
  gym: GymDay;
  day: string;
  today: string;
  onLoadFailure: (failure: LoadFailure | null) => void;
}) {
  const panelId = useId();
  const future = day > today;
  const workout = gym.workouts.find((item) => item.id === gym.workout?.workoutId) ?? null;
  // Dúvida 5.3: a day without a fixed workout opens already asking which one.
  const asking = Boolean(gym.planId) && !workout && gym.workouts.length > 0;
  const stored = useSyncExternalStore(subscribeToNothing, () => readExpanded(objective.id), () => false);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const expanded = toggled ?? (asking || stored);
  const [swapOpen, setSwapOpen] = useState(false);
  const [editing, setEditing] = useState<GymExercise | null>(null);
  // Full-size photos; `fromEditor` returns to the load editor instead of closing.
  const [photo, setPhoto] = useState<{ exercise: GymExercise; fromEditor: boolean } | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);

  const [loads, setOptimisticLoad] = useOptimistic(
    gym.exercises,
    (state, change: { id: string; load: LoadValues }) =>
      state.map((exercise) =>
        exercise.id === change.id
          ? {
              ...exercise,
              current: { ...change.load, effectiveFrom: day },
              previous:
                exercise.current && exercise.current.effectiveFrom !== day ? exercise.current : exercise.previous,
            }
          : exercise,
      ),
  );
  const exercises = workout ? loads.filter((exercise) => exercise.workoutId === workout.id) : [];

  if (!gym.planId) {
    return (
      <Link className={styles.gymStrip} href={`/objectives/${objective.id}/edit`}>
        <span>Sem ficha · Escolher ficha</span>
        <svg className={styles.gymChevron} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </Link>
    );
  }

  function toggle() {
    const next = !expanded;
    setToggled(next);
    writeExpanded(objective.id, next);
  }

  function saveLoad(exercise: GymExercise, load: LoadValues) {
    onLoadFailure(null);
    const before = exercise.current;
    startTransition(async () => {
      setOptimisticLoad({ id: exercise.id, load });
      let ok = false;
      try {
        ok = (await saveDayLoad(exercise.id, day, load)).ok;
      } catch {
        ok = false;
      }
      if (!ok) onLoadFailure({ exercise, before, retry: () => saveLoad(exercise, load) });
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.gymStrip}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span>{expanded ? "Ocultar exercícios" : asking ? "Escolher treino" : "Ver exercícios"}</span>
        <svg className={styles.gymExpandIcon} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div id={panelId} className={styles.gymPanel}>
          {asking ? (
            <ChooseWorkout objectiveId={objective.id} day={day} workouts={gym.workouts} />
          ) : (
            workout && (
              <>
                <div className={styles.gymPanelHeader}>
                  <span className={styles.gymPanelTitle}>{workoutName(workout)}</span>
                  <button type="button" className={styles.gymTextButton} onClick={() => setSwapOpen(true)}>
                    Trocar treino
                  </button>
                </div>
                {exercises.length === 0 ? (
                  <div className={styles.gymEmpty}>
                    <p>Este treino ainda não tem exercícios.</p>
                    <Link className={styles.pendingButton} href={`/workouts/${gym.planId}/${workout.id}`}>
                      Adicionar na ficha
                    </Link>
                  </div>
                ) : (
                  <ul className={styles.gymExercises}>
                    {exercises.map((exercise) => {
                      const done = doneIds.includes(exercise.id);
                      const content = (
                        <>
                          <span className={styles.rowText}>
                            <span className={styles.gymExerciseName}>{exercise.name}</span>
                            {exercise.current && (
                              <span className={styles.gymLoad}>{formatLoad(exercise.current)}</span>
                            )}
                            {exercise.current && (
                              <span className={styles.rowMeta}>
                                {describeLoadChange(exercise.current, exercise.previous, today)}
                              </span>
                            )}
                          </span>
                        </>
                      );
                      return (
                        <li key={exercise.id} className={styles.gymExercise} data-done={done || undefined}>
                          {!future && (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={done}
                              aria-label={`Marcar ${exercise.name} como feito`}
                              className={styles.gymExerciseCheck}
                              onClick={() =>
                                setDoneIds((current) =>
                                  done ? current.filter((id) => id !== exercise.id) : [...current, exercise.id],
                                )
                              }
                            >
                              <span className={styles.checkCircleSmall} aria-hidden="true">
                                <svg viewBox="0 0 24 24">
                                  <path d="m6.5 12.5 3.5 3.5 7.5-8" />
                                </svg>
                              </span>
                            </button>
                          )}
                          <PreviewThumb
                            src={exercise.imageUrl}
                            name={exercise.name}
                            onOpen={() => setPhoto({ exercise, fromEditor: false })}
                          />
                          {future ? (
                            <div className={styles.gymExerciseBody}>{content}</div>
                          ) : (
                            <button
                              type="button"
                              className={styles.gymExerciseBody}
                              aria-label={`${exercise.name}${exercise.current ? `, ${formatLoad(exercise.current)}` : ""}. Ajustar carga`}
                              onClick={() => setEditing(exercise)}
                            >
                              {content}
                              <svg className={styles.gymChevron} viewBox="0 0 24 24" aria-hidden="true">
                                <path d="m9 5 7 7-7 7" />
                              </svg>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {future && <p className={styles.sheetInfo}>Dia futuro: as cargas só podem ser ajustadas no dia.</p>}
              </>
            )
          )}
        </div>
      )}

      {editing && (
        <LoadEditorSheet
          exercise={loads.find((item) => item.id === editing.id) ?? editing}
          workout={workout}
          day={day}
          onClose={() => setEditing(null)}
          onPreview={() => {
            setPhoto({ exercise: editing, fromEditor: true });
            setEditing(null);
          }}
          onSave={(load) => {
            saveLoad(editing, load);
            setEditing(null);
          }}
        />
      )}
      {photo && (
        <ExercisePreviewSheet
          title={photo.exercise.name}
          subtitle={workout ? workoutName(workout) : formatShortDate(day)}
          images={getExerciseImages(photo.exercise.imageUrl)}
          onClose={() => setPhoto(null)}
        >
          <div className={styles.sheetActions}>
            {photo.fromEditor ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setEditing(photo.exercise);
                  setPhoto(null);
                }}
              >
                Voltar para a carga
              </button>
            ) : (
              <button type="button" className={styles.secondaryButton} onClick={() => setPhoto(null)}>
                Fechar
              </button>
            )}
          </div>
        </ExercisePreviewSheet>
      )}
      {swapOpen && workout && (
        <SwapWorkoutSheet
          objective={objective}
          gym={gym}
          current={workout}
          day={day}
          onClose={() => setSwapOpen(false)}
        />
      )}
    </>
  );
}

const WORKOUT_ERRORS: Record<DayWorkoutFailure, string> = {
  "out-of-window": "Só dá para trocar até 7 dias atrás.",
  "not-scheduled": "Esse objetivo não está programado neste dia. Atualize a página.",
  "invalid-workout": "Esse treino não é da ficha deste dia. Atualize a página.",
  failed: "Não deu para salvar. Tente de novo.",
};

function useDayWorkout(objectiveId: string, day: string, onDone?: () => void) {
  const [pending, startDayTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function choose(workoutId: string) {
    setError(null);
    startDayTransition(async () => {
      const result = await setDayWorkout(objectiveId, day, workoutId).catch(() => ({
        ok: false as const,
        reason: "failed" as const,
      }));
      if (result.ok) onDone?.();
      else setError(WORKOUT_ERRORS[result.reason]);
    });
  }
  return { pending, error, choose };
}

function ChooseWorkout({ objectiveId, day, workouts }: { objectiveId: string; day: string; workouts: GymWorkout[] }) {
  const { pending, error, choose } = useDayWorkout(objectiveId, day);
  const weekday = WEEKDAYS[getWeekday(day)].long;
  return (
    <div className={styles.workoutChoice}>
      <p className={styles.gymPanelTitle}>Qual treino em {formatShortDate(day)}?</p>
      <p className={styles.workoutChoiceTitle}>{weekday} não tem treino fixo na agenda.</p>
      <div className={styles.workoutChips} role="group" aria-label="Escolher treino" aria-busy={pending}>
        {workouts.map((workout) => (
          <button
            key={workout.id}
            type="button"
            className={styles.workoutChip}
            disabled={pending}
            aria-label={`Treino ${workout.label}${workout.description ? `, ${workout.description}` : ""}`}
            onClick={() => choose(workout.id)}
          >
            <span className={styles.workoutChipLetter} aria-hidden="true">
              {workout.label}
            </span>
            <span aria-hidden="true">{workout.description ?? `Treino ${workout.label}`}</span>
          </button>
        ))}
      </div>
      <SheetError error={error} />
    </div>
  );
}

function originLabel(gym: GymDay) {
  // A session written by the check with the scheduled workout still reads as "from the schedule".
  const fromSchedule =
    gym.workout?.source !== "chosen" || gym.workout.workoutId === gym.scheduled?.workoutId
      ? gym.scheduled
      : null;
  if (!fromSchedule || fromSchedule.weekday == null) return "Escolhido para este dia";
  const name = WEEKDAYS[fromSchedule.weekday].long.toLowerCase();
  return fromSchedule.source === "moved-schedule"
    ? `Pela agenda de ${name} (dia de origem)`
    : `Pela agenda de ${name}`;
}

export function SwapWorkoutSheet({
  objective,
  gym,
  current,
  day,
  onClose,
}: {
  objective: { id: string; title: string; checked: boolean };
  gym: GymDay;
  current: GymWorkout;
  day: string;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(current.id);
  const { pending, error, choose } = useDayWorkout(objective.id, day, onClose);
  const selected = gym.workouts.find((workout) => workout.id === selectedId) ?? current;
  const origin = originLabel(gym);
  const scheduleWorkout = gym.workouts.find((workout) => workout.id === gym.scheduled?.workoutId) ?? null;

  return (
    <Sheet title="Trocar treino" subtitle={`${objective.title} · ${weekdayName(day)}, ${formatDayMonth(day)}`} onClose={onClose}>
      <ul className={styles.list}>
        {gym.workouts.map((workout) => (
          <li key={workout.id}>
            <button
              type="button"
              className={styles.optionRow}
              aria-pressed={selectedId === workout.id}
              onClick={() => setSelectedId(workout.id)}
            >
              <span className={styles.optionRadio} aria-hidden="true" />
              <span className={styles.workoutChipLetter} aria-hidden="true">
                {workout.label}
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{workout.description ?? `Treino ${workout.label}`}</span>
                {workout.id === current.id && origin && <span className={styles.rowMeta}>{origin}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.sheetInfo}>
        Só muda o treino deste dia.
        {scheduleWorkout ? ` A agenda continua ${scheduleWorkout.label}.` : ""}
        {objective.checked ? " O check continua marcado." : ""}
      </p>
      <SheetError error={error} />
      <div className={styles.sheetActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={pending || selected.id === current.id}
          onClick={() => choose(selected.id)}
        >
          {pending
            ? "Salvando..."
            : selected.id === current.id
              ? "Escolha outro treino"
              : `Trocar para Treino ${selected.label}${objective.checked ? " (o dia continua feito)" : ""}`}
        </button>
      </div>
    </Sheet>
  );
}

function LoadEditorSheet({
  exercise,
  workout,
  day,
  onClose,
  onPreview,
  onSave,
}: {
  exercise: GymExercise;
  workout: GymWorkout | null;
  day: string;
  onClose: () => void;
  onPreview: () => void;
  onSave: (load: LoadValues) => void;
}) {
  const [draft, setDraft] = useState<LoadDraft>(toLoadDraft(exercise.current));
  const values = toLoadValues(draft);
  const errors = validateLoad(values);
  const invalid = hasLoadErrors(errors);
  const { current, previous } = exercise;
  const dayVersion = current?.effectiveFrom === day;
  const baseline = dayVersion ? previous : current;
  const unchanged = current ? sameLoad(values, current) : false;
  const backToBaseline = dayVersion && baseline && sameLoad(values, baseline);
  const label = invalid
    ? "Confira os valores"
    : unchanged
      ? "Nada mudou"
      : backToBaseline
        ? `Voltar para ${formatLoad(values)}`
        : `Salvar ${formatLoad(values)} a partir de ${formatShortDate(day)}`;

  return (
    <Sheet
      title={exercise.name}
      subtitle={`${workout ? `Treino ${workout.label} · ` : ""}${formatShortDate(day)}`}
      onClose={onClose}
    >
      {exercise.imageUrl && (
        <PreviewThumb src={exercise.imageUrl} name={exercise.name} size="md" onOpen={onPreview} />
      )}
      {baseline && (
        <p className={styles.sheetInfo}>
          {dayVersion ? "Antes" : "Atual"}: {formatLoad(baseline)} desde {formatDayMonth(baseline.effectiveFrom)}
        </p>
      )}
      <LoadFields value={draft} onChange={setDraft} errors={errors} />
      <div className={styles.sheetActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={invalid || unchanged}
          onClick={() => onSave(values)}
        >
          {label}
        </button>
      </div>
      <Link className={styles.sheetLink} href={`/workouts/exercises/${exercise.id}`}>
        Ver evolução
      </Link>
    </Sheet>
  );
}
