// 0 = Sunday, the same index as JS getDay() and Postgres extract(dow). Weeks also start on
// Sunday in every view (RN-17), so storage order and display order match.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: readonly { value: Weekday; short: string; long: string }[] = [
  { value: 0, short: "Dom", long: "Domingo" },
  { value: 1, short: "Seg", long: "Segunda" },
  { value: 2, short: "Ter", long: "Terça" },
  { value: 3, short: "Qua", long: "Quarta" },
  { value: 4, short: "Qui", long: "Quinta" },
  { value: 5, short: "Sex", long: "Sexta" },
  { value: 6, short: "Sáb", long: "Sábado" },
];

export const EVERY_DAY: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
export const WORKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5];

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

/** Deduplicates, drops invalid values and sorts in week order. */
export function normalizeWeekdays(values: readonly number[]): Weekday[] {
  return [...new Set(values.filter(isWeekday))].sort((a, b) => a - b);
}

function sameDays(a: readonly Weekday[], b: readonly Weekday[]) {
  return a.length === b.length && a.every((day) => b.includes(day));
}

export function formatWeekdays(values: readonly number[]) {
  const days = normalizeWeekdays(values);
  if (sameDays(days, EVERY_DAY)) return "Todos os dias";
  if (sameDays(days, WORKDAYS)) return "Dias úteis";
  if (sameDays(days, [0, 6])) return "Fim de semana";
  return days.map((day) => WEEKDAYS[day].short).join(", ");
}
