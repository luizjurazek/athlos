import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

export function Skeleton({
  width = "100%",
  height = "var(--space-4)",
  radius,
  className,
}: {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
}) {
  const style: CSSProperties = { width, height, borderRadius: radius };
  return <span className={`${styles.block} ${className ?? ""}`} style={style} aria-hidden="true" />;
}

export function LoadingStatus({ label = "Carregando" }: { label?: string }) {
  return (
    <span role="status" className={styles.visuallyHidden}>
      {label}
    </span>
  );
}

export function SkeletonList({ rows, badge = true }: { rows: number; badge?: boolean }) {
  return (
    <ul className={styles.list} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className={styles.row}>
          {badge && <Skeleton width="var(--space-8)" height="var(--space-8)" radius="var(--radius-full)" />}
          <span className={styles.rowText}>
            <Skeleton width={index % 2 ? "45%" : "60%"} />
            <Skeleton width="35%" height="var(--space-3)" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SkeletonCard({ lines = 2, height }: { lines?: number; height?: string }) {
  return (
    <div className={styles.card} style={height ? { minHeight: height } : undefined} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={index === 0 ? "50%" : "80%"} height={index === 0 ? "var(--space-5)" : "var(--space-3)"} />
      ))}
    </div>
  );
}

export function SkeletonSectionTitle() {
  return <Skeleton className={styles.sectionTitle} width="30%" height="var(--space-3)" />;
}

export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className={styles.stack}>
      <LoadingStatus />
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className={styles.field}>
          <Skeleton width="25%" height="var(--space-3)" />
          <Skeleton height="var(--control-height)" radius="var(--radius-md)" />
        </div>
      ))}
    </div>
  );
}
