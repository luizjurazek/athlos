"use client";

import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import {
  EVERY_DAY,
  formatWeekdays,
  normalizeWeekdays,
  WEEKDAYS,
  WORKDAYS,
  type Weekday,
} from "@/app/utils/weekdays";
import type { LinkableGoal } from "../goals/data";
import type { FormState } from "./actions";
import g from "../goals/goals.module.css";
import type { AlternativeOption, GymFormContext } from "./data";
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
    "title" | "color" | "icon" | "weekdays" | "reschedulable" | "activity_type"
  >;
  gym: GymFormContext;
  goals: LinkableGoal[];
  linkedGoalIds?: string[];
  alternatives: AlternativeOption[];
  alternativeIds?: string[];
  submitLabel: string;
};

export function Feedback({ state }: { state: FormState | { error?: string } }) {
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
  goals,
  linkedGoalIds = [],
  alternatives,
  alternativeIds: initialAlternativeIds = [],
  gym,
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
  const [goalIds, setGoalIds] = useState(linkedGoalIds);
  const [alternativeIds, setAlternativeIds] = useState(initialAlternativeIds);
  const [activityType, setActivityType] = useState<"" | "gym">(objective?.activity_type ?? "");
  const [planId, setPlanId] = useState(gym.linkedPlan?.id ?? "");
  const isGym = activityType === "gym";
  const takenTitles = new Map<number, string>(
    isGym ? gym.takenDays.map((taken) => [taken.weekday, taken.title]) : [],
  );
  const conflictDays = weekdays.filter((day) => takenTitles.has(day));
  const droppedScheduleDays = normalizeWeekdays(gym.scheduledWeekdays).filter((day) => !weekdays.includes(day));
  const weekdaysError =
    conflictDays.length > 0
      ? `${formatWeekdays(conflictDays)} já ${conflictDays.length === 1 ? "é" : "são"} de outro objetivo de academia. Dois objetivos de academia não podem cair no mesmo dia.`
      : state?.errors?.weekdays;

  function toggleGoal(id: string) {
    setGoalIds((current) =>
      current.includes(id) ? current.filter((goalId) => goalId !== id) : [...current, id],
    );
  }

  function toggleAlternative(id: string) {
    setAlternativeIds((current) =>
      current.includes(id) ? current.filter((alternativeId) => alternativeId !== id) : [...current, id],
    );
  }

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
  ].map((preset) => ({ ...preset, days: preset.days.filter((day) => !takenTitles.has(day)) }));
  const takenSummary = [...new Set(gym.takenDays.map((taken) => taken.title))]
    .map((title) => {
      const days = gym.takenDays.filter((taken) => taken.title === title).map((taken) => taken.weekday);
      return `${formatWeekdays(days)}: ${title}`;
    })
    .join(" · ");

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
            <legend className={styles.legend}>Tipo</legend>
            <input type="hidden" name="activity_type" value={activityType} />
            <div className={g.tabs} role="group" aria-label="Tipo do objetivo">
              <button
                type="button"
                className={g.tab}
                aria-pressed={!isGym}
                disabled={Boolean(gym.linkedPlan) && isGym}
                onClick={() => setActivityType("")}
              >
                Comum
              </button>
              <button
                type="button"
                className={g.tab}
                aria-pressed={isGym}
                onClick={() => {
                  setActivityType("gym");
                  const taken = new Set(gym.takenDays.map((item) => item.weekday));
                  setWeekdays((current) => {
                    const free = current.filter((day) => !taken.has(day));
                    return free.length > 0 ? free : current;
                  });
                }}
              >
                Academia
              </button>
            </div>
            {state?.errors?.activityType ? (
              <p className={g.fieldError}>{state.errors.activityType}</p>
            ) : (
              <p className={styles.hint}>
                {gym.linkedPlan && isGym
                  ? `A ${gym.linkedPlan.title} está vinculada. Encerre ou desvincule a ficha para mudar para Comum.`
                  : "Objetivos de academia podem ter ficha, agenda de treinos e o treino do dia no Hoje."}
              </p>
            )}
          </fieldset>
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
              {WEEKDAYS.map((day) => {
                const takenBy = takenTitles.get(day.value);
                const blocked = Boolean(takenBy) && !weekdays.includes(day.value);
                return (
                  <label
                    key={day.value}
                    className={styles.day}
                    title={takenBy ? `${day.long}: Academia já está neste dia (${takenBy})` : day.long}
                  >
                    <input
                      className={styles.visuallyHidden}
                      type="checkbox"
                      name="weekdays"
                      value={day.value}
                      checked={weekdays.includes(day.value)}
                      disabled={blocked}
                      onChange={() => toggleDay(day.value)}
                      aria-label={takenBy ? `${day.long}, Academia já está neste dia` : day.long}
                    />
                    <span aria-hidden="true">{day.short}</span>
                  </label>
                );
              })}
            </div>
            {isGym && gym.linkedPlan && droppedScheduleDays.length > 0 && (
              <p className={g.fieldHint} role="status">
                Ao salvar, a agenda da {gym.linkedPlan.title} perde {formatWeekdays(droppedScheduleDays).toLowerCase()}.
              </p>
            )}
            {weekdaysError ? (
              <p className={g.fieldError}>{weekdaysError}</p>
            ) : (
              isGym &&
              takenSummary && (
                <p className={styles.hint}>
                  Já usados por outro objetivo de academia ({takenSummary}). Dois objetivos de academia não
                  podem cair no mesmo dia.
                </p>
              )
            )}
          </fieldset>
          {isGym && (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Ficha (opcional)</legend>
              <div className={styles.group}>
                <select
                  className={styles.input}
                  name="plan_id"
                  aria-label="Ficha"
                  value={planId}
                  onChange={(event) => setPlanId(event.target.value)}
                >
                  <option value="">Nenhuma</option>
                  {gym.plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title}
                    </option>
                  ))}
                </select>
              </div>
              {state?.errors?.plan ? (
                <p className={g.fieldError}>{state.errors.plan}</p>
              ) : (
                <p className={styles.hint}>
                  {gym.plans.length === 0
                    ? "Nenhuma ficha livre. Sem ficha, o objetivo funciona normalmente: só não mostra o treino no Hoje."
                    : "Mostra as fichas livres. Sem ficha, o objetivo funciona normalmente: só não mostra o treino no Hoje."}
                </p>
              )}
            </fieldset>
          )}
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
          {alternatives.length > 0 && (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Pode ser trocado por</legend>
              <div className={styles.presets}>
                {alternatives.map((alternative) => (
                  <label key={alternative.id} className={styles.goalOption}>
                    <input
                      className={styles.visuallyHidden}
                      type="checkbox"
                      name="alternative_ids"
                      value={alternative.id}
                      checked={alternativeIds.includes(alternative.id)}
                      onChange={() => toggleAlternative(alternative.id)}
                    />
                    {alternative.title}
                  </label>
                ))}
              </div>
              <p className={styles.hint}>
                Ex.: futebol na terça. No dia em que não rolar, troque por corrida em Hoje.
              </p>
            </fieldset>
          )}
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
          {goals.length > 0 && (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Metas</legend>
              <div className={styles.presets}>
                {goals.map((goal) => (
                  <label key={goal.id} className={styles.goalOption}>
                    <input
                      className={styles.visuallyHidden}
                      type="checkbox"
                      name="goal_ids"
                      value={goal.id}
                      checked={goalIds.includes(goal.id)}
                      onChange={() => toggleGoal(goal.id)}
                    />
                    {goal.title}
                  </label>
                ))}
              </div>
              <p className={styles.hint}>Os checks deste objetivo contam para as metas marcadas.</p>
            </fieldset>
          )}
        </div>
      </div>

      <button className={styles.button} type="submit" disabled={pending || conflictDays.length > 0}>
        {pending ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
