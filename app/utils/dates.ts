import { WEEKDAYS, type Weekday } from "./weekdays";

// Days are plain "YYYY-MM-DD" strings (Postgres `date`). All arithmetic runs in UTC so the server's
// own timezone never shifts a day; the user's timezone only matters when deciding what "today" is.

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function getUserToday(
  timezone: string | null | undefined,
  now: Date = new Date(),
): string {
  const timeZone =
    timezone && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    toDay(parseDay(value)) === value
  );
}

export function getWeekday(day: string): Weekday {
  return parseDay(day).getUTCDay() as Weekday;
}

export function addDays(day: string, amount: number): string {
  const date = parseDay(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDay(date);
}

export function formatLongDate(day: string) {
  const date = parseDay(day);
  return `${WEEKDAYS[date.getUTCDay()].long}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`;
}

export function formatShortDate(day: string) {
  const date = parseDay(day);
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS[date.getUTCDay()].short.toLowerCase()}, ${dd}/${mm}`;
}
