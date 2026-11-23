import Link from "next/link";
import styles from "./BackLink.module.css";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className={styles.back} href={href}>
      <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true">
        <path d="m15 5-7 7 7 7" />
      </svg>
      {label}
    </Link>
  );
}
