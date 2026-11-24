"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { PendingLink, usePendingKey } from "@/app/components/PendingNavigation";

export function StripScroller({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    const selected = nav?.querySelector<HTMLElement>('[aria-current="date"]');
    if (!nav || !selected) return;
    nav.scrollLeft = selected.offsetLeft - (nav.clientWidth - selected.clientWidth) / 2;
  }, []);

  return (
    <nav ref={ref} className={className} aria-label={label}>
      {children}
    </nav>
  );
}

export function StripDayLink({
  day,
  href,
  selected,
  className,
  label,
  children,
}: {
  day: string;
  href: string;
  selected: boolean;
  className: string;
  label: string;
  children: ReactNode;
}) {
  const pendingDay = usePendingKey();
  const current = pendingDay === null ? selected : pendingDay === day;

  return (
    <PendingLink
      href={href}
      pendingKey={day}
      className={className}
      aria-current={current ? "date" : undefined}
      aria-label={label}
      onClick={(event) => {
        if (current) event.preventDefault();
      }}
    >
      {children}
    </PendingLink>
  );
}
