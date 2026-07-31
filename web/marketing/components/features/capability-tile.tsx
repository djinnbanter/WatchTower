'use client';

import type { CSSProperties } from 'react';
import { InstrumentPlate } from '@/components/instrument-plate';
import { Reveal } from '@/components/reveal';
import { CAPABILITY_MARKS, TONE_CSS } from '@/components/features/capability-marks';
import type { FeatureCapability } from '@/content/features';

export function CapabilityTile({
  feature,
  className = '',
  delay = 0,
}: {
  feature: FeatureCapability;
  className?: string;
  delay?: number;
}) {
  const tone = TONE_CSS[feature.tone];
  const mark = CAPABILITY_MARKS[feature.id];
  const lead = feature.weight === 'lead';

  return (
    <Reveal kind="lift" delay={delay} className={`h-full ${className}`}>
      <div
        className="group h-full transition-[transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5"
        style={{ ['--ft-tone' as string]: tone } as CSSProperties}
      >
        <InstrumentPlate
          elevation="flat"
          className="h-full transition-[border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-[color:color-mix(in_srgb,var(--ft-tone)_55%,var(--wt-line))]"
        >
          <div
            className={`relative flex h-full flex-col overflow-hidden ${lead ? 'gap-4 p-5 md:p-6' : 'gap-3 p-4 md:p-5'}`}
            style={{
              background: lead
                ? `linear-gradient(145deg, color-mix(in srgb, ${tone} 14%, var(--wt-bg1)) 0%, var(--wt-bg1) 52%)`
                : `linear-gradient(180deg, color-mix(in srgb, ${tone} 7%, var(--wt-bg1)) 0%, var(--wt-bg1) 40%)`,
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-px"
              style={{ background: `color-mix(in srgb, ${tone} 70%, transparent)` }}
            />

            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center border"
                  style={{
                    borderRadius: 'var(--wt-radius-md)',
                    borderColor: `color-mix(in srgb, ${tone} 40%, var(--wt-line))`,
                    background: `color-mix(in srgb, ${tone} 16%, var(--wt-bg0))`,
                    color: tone,
                    boxShadow: `inset 0 1px 0 color-mix(in srgb, ${tone} 25%, transparent)`,
                  }}
                >
                  {mark}
                </span>
                <span
                  className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: `color-mix(in srgb, ${tone} 75%, var(--wt-text-low))` }}
                >
                  {feature.tag}
                </span>
              </div>
              {feature.alpha ? (
                <span
                  className="shrink-0 border px-1.5 py-0.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-lantern)]"
                  style={{
                    borderRadius: 'var(--wt-radius-sm)',
                    borderColor: 'color-mix(in srgb, var(--wt-lantern) 45%, var(--wt-line))',
                    background: 'color-mix(in srgb, var(--wt-lantern) 12%, transparent)',
                  }}
                >
                  Alpha
                </span>
              ) : null}
            </div>

            <h2
              className={`font-semibold leading-snug tracking-[-0.01em] text-[color:var(--wt-text)] ${
                lead ? 'text-[1.2rem] md:text-[1.35rem]' : 'text-[1.0625rem] md:text-[1.125rem]'
              }`}
            >
              {feature.title}
            </h2>
            <p
              className={`m-0 leading-relaxed text-[color:var(--wt-text-mid)] ${
                lead ? 'text-[0.9375rem] md:text-[1rem]' : 'text-[0.875rem] md:text-[0.9375rem]'
              }`}
            >
              {feature.blurb}
            </p>
          </div>
        </InstrumentPlate>
      </div>
    </Reveal>
  );
}
