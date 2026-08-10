'use client';

import { DeskDotGrid } from '@/components/desk-dot-grid';

/**
 * Single viewport-sized square-dot field for the whole home page.
 * Fixed — do not mount one canvas per section (that blew RAM to ~11GB).
 */
export function HomeAmbient({ opacity = 0.4 }: { opacity?: number }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity }}
      aria-hidden
    >
      <DeskDotGrid />
    </div>
  );
}
