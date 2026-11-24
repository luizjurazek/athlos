"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import {
  EVERY_DAY,
  normalizeWeekdays,
  WEEKDAYS,
  WORKDAYS,
  type Weekday,
} from "@/app/utils/weekdays";
import type { FormState } from "./actions";
import { ObjectiveIcon } from "./objective-icon";
import {
  OBJECTIVE_COLORS,
  OBJECTIVE_ICONS,
  TITLE_MAX_LENGTH,
  type Objective,
} from "./options";
import styles from "./objectives.module.css";

type ObjectiveFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  objective?: Pick<
    Objective,
    "title" | "color" | "icon" | "weekdays" | "reschedulable"
  >;
  submitLabel: string;
};

export function Feedback({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p className={styles.error} role="alert">
      {state.error}
    </p>
  );
}

function sameDays(a: readonly Weekday[], b: readonly Weekday[]) {
  return a.length === b.length && a.every((day) => b.includes(day));
}

export function ObjectiveForm({
  action,
  objective,
  submitLabel,
}: ObjectiveFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [title, setTitle] = useState(objective?.title ?? "");
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    normalizeWeekdays(objective?.weekdays ?? EVERY_DAY),
  );
  const [color, setColor] = useState(objective?.color ?? "");
  const [icon, setIcon] = useState(objective?.icon ?? "");
  const [reschedulable, setReschedulable] = useState(
    objective?.reschedulable ?? false,
  );

  function toggleDay(day: Weekday) {
    setWeekdays((current) =>
      normalizeWeekdays(
        current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day],
      ),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const presets = [
    { label: "Todos os dias", days: EVERY_DAY },
    { label: "Dias úteis", days: WORKDAYS },
  ];

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Feedback state={state} />

      <div className={styles.formColumns}>
        <div className={styles.formColumn}>
          <div className={styles.group}>
            <input
              className={styles.input}
              name="title"
              type="text"
              autoComplete="off"
              placeholder="Nome (ex.: Academia)"
              aria-label="Nome do objetivo"
              maxLength={TITLE_MAX_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Dias da semana</legend>
            <div className={styles.presets}>
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={styles.chip}
                  aria-pressed={sameDays(weekdays, preset.days)}
                  onClick={() => setWeekdays(normalizeWeekdays(preset.days))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className={styles.days}>
              {WEEKDAYS.map((day) => (
                <label key={day.value} className={styles.day} title={day.long}>
                  <input
                    className={styles.visuallyHidden}
                    type="checkbox"
                    name="weekdays"
                    value={day.value}
                    checked={weekdays.includes(day.value)}
                    onChange={() => toggleDay(day.value)}
                    aria-label={day.long}
                  />
                  <span aria-hidden="true">{day.short}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.fieldset}>
            <label className={`${styles.group} ${styles.switchRow}`}>
              <span>Pode mudar de dia</span>
              <input
                className={styles.switch}
                type="checkbox"
                role="switch"
                name="reschedulable"
                checked={reschedulable}
                onChange={(event) => setReschedulable(event.target.checked)}
              />
            </label>
            <p className={styles.hint}>
              Ex.: academia pode ir para o sábado se você faltar. Beber água,
              não.
            </p>
          </div>
        </div>
        <div className={styles.formColumn}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Ícone</legend>
            <div className={styles.swatches}>
              {OBJECTIVE_ICONS.map((option) => (
                <label
                  key={option.value}
                  className={styles.iconOption}
                  title={option.label}
                >
                  <input
                    className={styles.visuallyHidden}
                    type="radio"
                    name="icon"
                    value={option.value}
                    checked={icon === option.value}
                    onChange={() => setIcon(option.value)}
                    aria-label={option.label}
                  />
                  <ObjectiveIcon
                    name={option.value}
                    className={styles.optionIcon}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Cor</legend>
            <div className={styles.swatches}>
              <label
                className={styles.colorOption}
                data-color="neutral"
                title="Sem cor"
              >
                <input
                  className={styles.visuallyHidden}
                  type="radio"
                  name="color"
                  value=""
                  checked={color === ""}
                  onChange={() => setColor("")}
                  aria-label="Sem cor"
                />
              </label>
              {OBJECTIVE_COLORS.map((option) => (
                <label
                  key={option.value}
                  className={styles.colorOption}
                  data-color={option.value}
                  title={option.label}
                >
                  <input
                    className={styles.visuallyHidden}
                    type="radio"
                    name="color"
                    value={option.value}
                    checked={color === option.value}
                    onChange={() => setColor(option.value)}
                    aria-label={option.label}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
