"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
