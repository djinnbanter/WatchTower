'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';
import { LogProgressProvider } from '@/components/shift-log/use-log-progress';
import { LivePulseProvider } from '@/components/shift-log/live-pulse-context';
import { SparkProvider } from '@/components/motion/spark-context';

/**
 * Ordered desk tour: entry list only (no timeline rail).
 */
export function ShiftLog({
  children,
  ariaLabel = 'Desk tour',
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  const rootRef = useRef<HTMLElement>(null);

  return (
    <LogProgressProvider rootRef={rootRef}>
      <LivePulseProvider>
        <SparkProvider>
          <section ref={rootRef} className="relative" aria-label={ariaLabel}>
            <ol className="m-0 list-none p-0">{children}</ol>
          </section>
        </SparkProvider>
      </LivePulseProvider>
    </LogProgressProvider>
  );
}
