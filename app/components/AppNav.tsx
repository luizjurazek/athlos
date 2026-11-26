"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import styles from "./AppNav.module.css";

const TABS: readonly { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/dashboard",
    label: "Hoje",
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" />
      </>
    ),
  },
  {
    href: "/objectives",
    label: "Objetivos",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
  },
  {
    href: "/goals",
    label: "Metas",
    icon: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  },
  {
    href: "/workouts",
    label: "Treinos",
    icon: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
];

function TabBar({ activeIndex }: { activeIndex: number }) {
  const style: CSSProperties & Record<`--${string}`, number> = {
    "--tab-count": TABS.length,
    "--active-index": Math.max(activeIndex, 0),
  };

  return (
    <nav className={styles.nav} aria-label="Navegação principal">
      <span className={styles.brand}>Athlos</span>
      <div className={styles.bar} style={style}>
        {activeIndex >= 0 && <span className={styles.indicator} aria-hidden="true" />}
        {TABS.map((tab, index) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.tab}
            aria-current={index === activeIndex ? "page" : undefined}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
              {tab.icon}
            </svg>
            <span className={styles.label}>{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function ActiveTabBar() {
  const pathname = usePathname();
  const activeIndex = TABS.findIndex(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );
  return <TabBar activeIndex={activeIndex} />;
}

export function AppNav() {
  // usePathname suspends on routes with unknown dynamic params (e.g. /objectives/[id]/edit) under
  // Cache Components; the fallback keeps the bar in the prerendered shell, just without the highlight.
  return (
    <Suspense fallback={<TabBar activeIndex={-1} />}>
      <ActiveTabBar />
    </Suspense>
  );
}
