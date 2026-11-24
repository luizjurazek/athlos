import styles from "./ProgressBar.module.css";

const toPercent = (value: number) => Math.min(Math.max(value, 0), 1) * 100;

export function ProgressBar({
  value,
  expected,
  label,
  className,
}: {
  value: number;
  expected?: number;
  label: string;
  className?: string;
}) {
  const percent = toPercent(value);
  return (
    <div
      className={`${styles.track} ${className ?? ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <span className={styles.fill} style={{ width: `${percent}%` }} />
      {expected !== undefined && (
        <span className={styles.marker} style={{ left: `${toPercent(expected)}%` }} />
      )}
    </div>
  );
}
