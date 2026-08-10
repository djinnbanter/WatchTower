import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Bordered industrial plate — shared section shell across POC pages. */
export function Plate({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('wt-plate border border-border', className)}>{children}</div>
  );
}
