"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  className,
  pendingLabel,
  children,
}: {
  className: string;
  pendingLabel: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-disabled={pending || undefined}>
      {pending ? pendingLabel : children}
    </button>
  );
}
