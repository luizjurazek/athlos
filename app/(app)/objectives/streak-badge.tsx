import styles from "./objectives.module.css";

/** A streak only shows from two days in a row; a single check is not a streak yet. */
const STREAK_MIN = 2;

/** Orange flame with the current streak (orange is the streak color across the app). */
export function StreakBadge({ count }: { count: number }) {
  if (count < STREAK_MIN) return null;
  const label = `${count} dias seguidos cumpridos`;
  return (
    <span className={styles.streakBadge} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5c.8 3.2 4.8 5.2 4.8 10.3a4.8 4.8 0 0 1-9.6 0c0-2.4 1.2-3.8 2.4-4.8 0 2 1 3.2 2.1 3.2-.3-3.3-.9-5.7.3-8.7Z" />
      </svg>
      {count}
    </span>
  );
}
