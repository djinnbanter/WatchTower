import type { ReactNode } from 'react';

function padIndex(index: number | string): string {
  if (typeof index === 'string') return index.padStart(2, '0');
  return String(index).padStart(2, '0');
}

/**
 * Numbered board compartment: stamp, display title, optional lead, body plate.
 * `label` drives the stamp; `title` (optional) drives the h2 — falls back to label.
 * `fullViewport` — home snap panel (transparent shell so shared HomeAmbient shows in margins).
 */
export function BoardSection({
  index,
  label,
  title,
  metaRight,
  lead,
  children,
  id,
  fullViewport = false,
}: {
  index: number | string;
  label: string;
  /** Display headline. Defaults to `label` when omitted. */
  title?: string;
  metaRight?: string;
  lead?: ReactNode;
  children: ReactNode;
  id?: string;
  fullViewport?: boolean;
}) {
  const nn = padIndex(index);
  const stamp = `[ ${nn} · ${label.toUpperCase()} ]`;
  const headline = title ?? label;

  return (
    <section
      id={id}
      className={
        fullViewport
          ? 'wt-snap-panel wt-snap-natural relative flex min-h-0 flex-col border-t border-[color:var(--wt-line)] bg-transparent'
          : 'border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)]'
      }
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      <div
        className={
          fullViewport
            ? 'relative z-10 flex h-full min-h-0 w-full flex-1 flex-col'
            : undefined
        }
      >
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-4 py-2.5 md:gap-3 md:px-6 md:py-3">
          <p className="wt-meta text-[color:var(--wt-accent)]">{stamp}</p>
          {metaRight ? (
            <p className="wt-meta text-[color:var(--wt-text-low)]">{metaRight}</p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 bg-[color:var(--wt-bg1)] px-4 py-3 md:space-y-3 md:px-6 md:py-5 lg:space-y-4 lg:py-6">
          <h2
            id={id ? `${id}-title` : undefined}
            className="wt-display max-w-[28ch] text-[clamp(1.45rem,5.5vw,2.75rem)] text-[color:var(--wt-text)]"
          >
            {headline}
          </h2>
          {lead ? (
            <p className="max-w-[62ch] text-[0.9375rem] font-normal normal-case leading-relaxed tracking-normal text-[color:var(--wt-text-mid)] md:text-base">
              {lead}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] lg:overflow-y-auto lg:overscroll-y-contain">
          {children}
        </div>
      </div>
    </section>
  );
}
