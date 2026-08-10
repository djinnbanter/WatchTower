import type { CSSProperties } from 'react';
import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/** Chunk industrial meter — Base UI Progress + diagonal hash fill. */
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
    <ProgressPrimitive.Root value={pct} className={cn('w-full', className)}>
      <ProgressTrack
        className={cn(
          'relative flex h-3.5 w-full items-center overflow-hidden border border-border bg-background',
          trackClassName,
        )}
        aria-label={ariaLabel}
      >
        <ProgressIndicator
          className="wt-bar-hash h-full bg-transparent"
          style={
            {
              '--wt-bar-ink': ink ?? 'var(--primary)',
            } as CSSProperties
          }
        />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}
