"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  startTransition,
  useContext,
  useOptimistic,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import styles from "./PendingNavigation.module.css";

type PendingNavigationValue = {
  pendingKey: string | null;
  navigate: (href: string, key: string) => void;
};

const PendingNavigationContext = createContext<PendingNavigationValue>({
  pendingKey: null,
  navigate: () => {},
});

/**
 * Search-param navigations keep the old screen until the server answers, so the tap looks ignored.
 * The optimistic key lives for the whole navigation transition and lets the page react right away.
 */
export function PendingNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useOptimistic<string | null>(null);

  function navigate(href: string, key: string) {
    startTransition(() => {
      setPendingKey(key);
      router.push(href, { scroll: false });
    });
  }

  return (
    <PendingNavigationContext.Provider value={{ pendingKey, navigate }}>
      {children}
    </PendingNavigationContext.Provider>
  );
}

export function usePendingKey() {
  return useContext(PendingNavigationContext).pendingKey;
}

export function PendingLink({
  href,
  pendingKey,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string; pendingKey: string }) {
  const { navigate } = useContext(PendingNavigationContext);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    const opensElsewhere =
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || opensElsewhere) return;
    event.preventDefault();
    navigate(href, pendingKey);
  }

  return <Link href={href} scroll={false} onClick={handleClick} {...props} />;
}

export function PendingSwap({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return usePendingKey() === null ? children : fallback;
}

export function PendingRegion({ className, children }: { className?: string; children: ReactNode }) {
  const pending = usePendingKey() !== null;
  return (
    <div
      className={`${styles.region} ${className ?? ""}`}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
    >
      {children}
    </div>
  );
}
