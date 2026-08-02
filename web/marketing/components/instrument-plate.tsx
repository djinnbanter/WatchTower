import type { ReactNode } from 'react';
import '@/components/desk/desk.css';

/**
 * Nested bezel at WatchTower radii: an outer tray holding an inner core.
 * Uses page theme tokens so mock cards follow light / dark.
 * elevation='flat' (default) uses hairlines only - no drop shadow on home.
 * elevation='shadow' keeps the legacy inset+drop for non-home surfaces.
 */
export function InstrumentPlate({
  className = '',
  elevation = 'flat',
  children,
}: {
  className?: string;
  elevation?: 'shadow' | 'flat';
  children: ReactNode;
}) {
  return (
    <div
      className={`wt-plate-stone flex flex-col border border-[color:var(--wt-line)] bg-[color:var(--wt-plate-outer)] p-[5px] ${className}`}
      style={{ borderRadius: 'var(--wt-radius-lg)' }}
    >
      <div
        className="relative min-h-0 flex-1 overflow-hidden bg-[color:var(--wt-bg1)]"
        style={{
          borderRadius: 'var(--wt-radius-sm)',
          ...(elevation === 'shadow' ? { boxShadow: 'var(--wt-shadow)' } : null),
        }}
      >
        {children}
      </div>
    </div>
  );
}
