import type { ReactNode } from 'react';

/** Gutter / field-manual mono note. Always >= 12px. Never lantern in light for body size. */
export function MarginNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)] ${className}`}
    >
      {children}
    </p>
  );
}
