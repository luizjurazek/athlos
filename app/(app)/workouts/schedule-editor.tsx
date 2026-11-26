"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { WEEKDAYS, type Weekday } from "@/app/utils/weekdays";
import { Sheet } from "../dashboard/sheet";
import sheetStyles from "../dashboard/dashboard.module.css";
import g from "../goals/goals.module.css";
import ui from "../objectives/objectives.module.css";
import { savePlanSchedule } from "./actions";
import type { PlanWorkout, ScheduleEntry } from "./data";
import { Chevron, WorkoutLetter } from "./workout-letter";
import styles from "./workouts.module.css";

function workoutTitle(workout: PlanWorkout) {
  return workout.description ?? `Treino ${workout.label}`;
}

export function ScheduleEditor({
  planId,
  planTitle,
  objectiveTitle,
  weekdays,
  workouts,
  schedule,
}: {
  planId: string;
  planTitle: string;
  objectiveTitle: string;
  weekdays: Weekday[];
  workouts: PlanWorkout[];
  schedule: ScheduleEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Partial<Record<Weekday, string | null>>>(() =>
    Object.fromEntries(
      weekdays.map((weekday) => [weekday, schedule.find((entry) => entry.weekday === weekday)?.workoutId ?? null]),
    ),
  );
  const [editing, setEditing] = useState<Weekday | null>(null);
  const changed = weekdays.some(
    (weekday) =>
      (values[weekday] ?? null) !==
      (schedule.find((entry) => entry.weekday === weekday)?.workoutId ?? null),
  );

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await savePlanSchedule(
        planId,
        weekdays.map((weekday) => ({ weekday, workoutId: values[weekday] ?? null })),
      ).catch(() => ({ ok: false as const, error: "Não deu para salvar. Tente de novo." }));
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <ul className={`${ui.list} ${styles.list}`}>
        {WEEKDAYS.map((day) => {
          const scheduled = weekdays.includes(day.value);
          const workout = workouts.find((item) => item.id === values[day.value]);
          if (!scheduled) {
            return (
              <li key={day.value} className={`${styles.scheduleRow} ${styles.scheduleOff}`}>
                <span className={styles.scheduleDay}>{day.long}</span>
                <span className={styles.scheduleValue}>{objectiveTitle} não acontece</span>
              </li>
            );
          }
          return (
            <li key={day.value}>
              <button
                type="button"
                className={`${styles.scheduleRow} ${styles.scheduleButton}`}
                aria-label={`${day.long}: ${workout ? `Treino ${workout.label}, ${workoutTitle(workout)}` : "Sem treino fixo"}. Trocar`}
                onClick={() => {
                  setSaved(false);
                  setEditing(day.value);
                }}
              >
                <span className={styles.scheduleDay}>{day.long}</span>
                {workout ? (
                  <span className={styles.scheduleValue}>
                    <WorkoutLetter label={workout.label} small />
                    <span>{workoutTitle(workout)}</span>
                  </span>
                ) : (
                  <span className={`${styles.scheduleValue} ${styles.scheduleNone}`}>
                    Sem treino fixo · o Hoje pergunta
                  </span>
                )}
                <Chevron />
              </button>
            </li>
          );
        })}
      </ul>
      <p className={ui.hint}>A troca de um dia específico é feita no Hoje, pelo ⋯ da {objectiveTitle}.</p>
      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      <div className={g.saveBar}>
        <button className={`${ui.button} ${g.saveButton}`} type="button" disabled={pending || !changed} onClick={save}>
          {pending ? "Salvando..." : saved && !changed ? "Agenda salva" : changed ? "Salvar agenda" : "Nada mudou"}
        </button>
      </div>

      {editing !== null && (
        <DayPicker
          weekday={editing}
          planTitle={planTitle}
          workouts={workouts}
          current={values[editing] ?? null}
          onClose={() => setEditing(null)}
          onPick={(workoutId) => {
            setValues((current) => ({ ...current, [editing]: workoutId }));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function DayPicker({
  weekday,
  planTitle,
  workouts,
  current,
  onClose,
  onPick,
}: {
  weekday: Weekday;
  planTitle: string;
  workouts: PlanWorkout[];
  current: string | null;
  onClose: () => void;
  onPick: (workoutId: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(current);
  const dayName = WEEKDAYS[weekday].long;
  const selectedWorkout = workouts.find((workout) => workout.id === selected);
  const plural = `${dayName.toLowerCase()}s`;

  return (
    <Sheet title={dayName} subtitle={`Agenda da ${planTitle}`} onClose={onClose}>
      <ul className={sheetStyles.list}>
        {[...workouts.map((workout) => ({ id: workout.id, workout })), { id: null, workout: null }].map(
          ({ id, workout }) => (
            <li key={id ?? "none"}>
              <button
                type="button"
                className={sheetStyles.optionRow}
                aria-pressed={selected === id}
                onClick={() => setSelected(id)}
              >
                <span className={sheetStyles.optionRadio} aria-hidden="true" />
                {workout && <WorkoutLetter label={workout.label} />}
                <span className={sheetStyles.rowText}>
                  <span className={sheetStyles.rowTitle}>{workout ? workoutTitle(workout) : "Sem treino fixo"}</span>
                  {!workout && <span className={sheetStyles.rowMeta}>O Hoje pergunta qual treino</span>}
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      <div className={sheetStyles.sheetActions}>
        <button type="button" className={sheetStyles.primaryButton} onClick={() => onPick(selected)}>
          {selectedWorkout ? `Usar Treino ${selectedWorkout.label} às ${plural}` : `Sem treino fixo às ${plural}`}
        </button>
      </div>
    </Sheet>
  );
}
