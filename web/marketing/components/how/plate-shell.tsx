'use client';

import type { ReactNode } from 'react';
import { InstrumentPlate } from '@/components/instrument-plate';
import '@/components/desk/desk.css';

/** Shared status pill matching ProductDesk / dashboard StatusPill craft. */
export function HowPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
}) {
  return <span className={`desk-pill desk-pill--${tone}`}>{children}</span>;
}

/** Instrument plate with a desk title bar (matches ProductDesk chrome--bar). */
export function HowDeskShell({
  title,
  badge,
  className = '',
  children,
}: {
  title: string;
  badge?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <InstrumentPlate className={className} elevation="flat">
      <div className="desk-chrome desk-chrome--bar">
        <div className="desk-chrome__main">
          <div className="desk-chrome__bar">
            <span className="desk-chrome__title">{title}</span>
            {badge}
          </div>
          {children}
        </div>
      </div>
    </InstrumentPlate>
  );
}
