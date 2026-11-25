import styles from "./ProgressBar.module.css";

const toPercent = (value: number) => Math.min(Math.max(value, 0), 1) * 100;

export type ProgressSegment = { end: number; label: string };

export function ProgressBar({
  value,
  expected,
  marks = [],
  segments,
  completedUntil = 0,
  label,
  className,
}: {
  value: number;
  expected?: number;
  /** Fractions (0..1) where intermediate checkpoints sit, e.g. the end of each goal stage. */
  marks?: number[];
  /**
   * Labeled checkpoints (e.g. each stage's target). The bar gets taller, shows each label at the
   * end of its segment and splits the segments with notches (`marks` is then ignored).
   */
  segments?: ProgressSegment[];
  /** Fraction already completed (e.g. through the last reached stage), painted green. */
  completedUntil?: number;
  label: string;
  className?: string;
}) {
  const percent = toPercent(value);
  const ticks = segments ? segments.slice(0, -1).map((segment) => segment.end) : marks;
  return (
    <div
      className={`${styles.track} ${className ?? ""}`}
      data-size={segments ? "large" : undefined}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <span className={styles.fill} style={{ width: `${percent}%` }} />
      {completedUntil > 0 && (
        <span
          className={styles.fillDone}
          style={{ width: `${Math.min(percent, toPercent(completedUntil))}%` }}
        />
      )}
      {segments?.map((segment, index) => {
        const start = index === 0 ? 0 : segments[index - 1].end;
        return (
          <span
            key={segment.end}
            className={styles.segmentLabel}
            data-filled={value >= segment.end || undefined}
            style={{ left: `${toPercent(start)}%`, width: `${toPercent(segment.end) - toPercent(start)}%` }}
            aria-hidden="true"
          >
            {segment.label}
          </span>
        );
      })}
      {ticks.map((mark) => (
        <span key={mark} className={styles.tick} style={{ left: `${toPercent(mark)}%` }} />
      ))}
      {expected !== undefined && (
        <span className={styles.marker} style={{ left: `${toPercent(expected)}%` }} />
      )}
    </div>
  );
}
