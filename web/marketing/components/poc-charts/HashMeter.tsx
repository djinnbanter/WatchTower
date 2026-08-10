'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Chunk industrial meter — diagonal hash fill (POC HashMeter look). */
export function HashMeter({
  value,
  ink,
  className,
  trackClassName,
  'aria-label': ariaLabel,
}: {
  /** 0–100 */
  value: number;
  ink?: string;
  className?: string;
  trackClassName?: string;
  'aria-label'?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('w-full', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'relative flex h-3.5 w-full items-center overflow-hidden border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)]',
          trackClassName,
        )}
      >
        <div
          className="wt-bar-hash h-full"
          style={
            {
              width: `${pct}%`,
              '--wt-bar-ink': ink ?? 'var(--wt-accent)',
            } as CSSProperties
          }
        />
      </div>
    </div>
  );
}
