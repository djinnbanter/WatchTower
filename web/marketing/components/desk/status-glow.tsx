'use client';

import type { ReactNode } from 'react';

/**
 * Flat status stripe for marketing desks — solid tone bar, no blur or glow wash.
 */
export function StatusGlow({
  tone = 'danger',
  children,
  className = '',
}: {
  tone?: 'ok' | 'warn' | 'danger' | 'info';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`desk-status-bar desk-status-bar--${tone} ${className}`}>
      <div className="desk-status-bar__stripe" aria-hidden />
      {children}
    </div>
  );
}
