import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared page frame — chrome lives in DeskShell; pages only render content here. */
export function DeskPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-transparent', className)}>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-5 md:gap-6 md:px-6 md:py-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
