"use client";

import { usePendingKey } from "@/app/components/PendingNavigation";
import { addDays, formatLongDate, getWeekday } from "@/app/utils/dates";
import { WEEKDAYS } from "@/app/utils/weekdays";
import styles from "./dashboard.module.css";

function getDayTitle(day: string, today: string) {
  if (day === today) return "Hoje";
  if (day === addDays(today, -1)) return "Ontem";
  if (day === addDays(today, 1)) return "Amanhã";
  return WEEKDAYS[getWeekday(day)].long;
}

export function DayHeading({ day, today }: { day: string; today: string }) {
  const shown = usePendingKey() ?? day;
  return (
    <div>
      <h1 className={styles.title}>{getDayTitle(shown, today)}</h1>
      <p className={styles.subtitle}>{formatLongDate(shown)}</p>
    </div>
  );
}
