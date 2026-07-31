'use client';

import { Check } from 'lucide-react';
import { HowDeskShell, HowPill } from '@/components/how/plate-shell';

/** Matches dashboard wizard step titles (welcome → security). */
const STEPS = [
  { id: 'welcome', title: 'Set up WatchTower' },
  { id: 'options', title: 'Options' },
  { id: 'audit', title: 'Initial discovery' },
  { id: 'backups', title: 'Backups' },
  { id: 'security', title: 'Security' },
] as const;

/** First-run wizard chrome - progress bar + step list, no fake forms. */
export function WizardSteps({
  current = 0,
  className = '',
}: {
  /** 0-based index of the highlighted step. */
  current?: number;
  className?: string;
}) {
  const active = Math.min(Math.max(0, current), STEPS.length - 1);
  const progress = (active + 1) / STEPS.length;

  return (
    <HowDeskShell
      title="First-run wizard"
      badge={<HowPill tone="info">{`Step ${active + 1} of ${STEPS.length}`}</HowPill>}
      className={className}
    >
      <div className="flex flex-col gap-4 px-3 pb-4 pt-1">
        <div
          className="h-1.5 w-full overflow-hidden bg-[color:var(--wt-bg2)]"
          style={{ borderRadius: 'var(--wt-radius-sm)' }}
          aria-hidden
        >
          <div
            className="h-full origin-left bg-[color:var(--wt-accent)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `scaleX(${progress})`, borderRadius: 'var(--wt-radius-sm)' }}
          />
        </div>

        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 flex-1 ${
                i <= active ? 'bg-[color:var(--wt-accent)]' : 'bg-[color:var(--wt-bg3)]'
              }`}
              style={{ borderRadius: 'var(--wt-radius-sm)' }}
            />
          ))}
        </div>

        <ol className="m-0 list-none p-0">
          {STEPS.map((step, i) => {
            const isActive = i === active;
            const done = i < active;
            return (
              <li
                key={step.id}
                className="flex items-center gap-3 border-b border-[color:var(--wt-line)] py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span
                  aria-hidden
                  className={`grid h-6 w-6 shrink-0 place-items-center font-mono text-[0.75rem] font-semibold ${
                    isActive
                      ? 'bg-[color:var(--wt-accent)] text-[color:var(--wt-accent-ink)]'
                      : done
                        ? 'border border-[color:var(--wt-ok)]/45 text-[color:var(--wt-ok)]'
                        : 'border border-[color:var(--wt-line)] text-[color:var(--wt-text-low)]'
                  }`}
                  style={{ borderRadius: 'var(--wt-radius-sm)' }}
                >
                  {done ? <Check size={12} strokeWidth={2.5} /> : i + 1}
                </span>
                <span
                  className={`min-w-0 flex-1 text-[0.9375rem] leading-snug ${
                    isActive
                      ? 'font-semibold text-[color:var(--wt-text)]'
                      : done
                        ? 'text-[color:var(--wt-text-mid)]'
                        : 'text-[color:var(--wt-text-low)]'
                  }`}
                >
                  {step.title}
                </span>
                {isActive ? <HowPill tone="ok">Now</HowPill> : null}
                {done ? <HowPill tone="neutral">Done</HowPill> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </HowDeskShell>
  );
}
