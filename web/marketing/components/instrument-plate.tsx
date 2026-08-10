import type { ReactNode } from 'react';
import '@/components/desk/desk.css';

/**
 * Nested bezel. Pass flex-1 / min-h-0 via className when the plate should stretch.
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
      className={`flex flex-col border border-[color:var(--wt-line)] bg-[color:var(--wt-plate-outer)] p-[5px] ${className}`.trim()}
      style={{ borderRadius: 'var(--wt-radius-lg)' }}
    >
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[color:var(--wt-bg1)]"
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
