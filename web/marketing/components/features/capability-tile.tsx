'use client';

import { InstrumentPlate } from '@/components/instrument-plate';
import { Reveal } from '@/components/reveal';
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
  return (
    <Reveal kind="lift" delay={delay} className={`h-full ${className}`}>
      <InstrumentPlate elevation="flat" className="group h-full transition-[border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[color:color-mix(in_srgb,var(--wt-accent)_45%,var(--wt-line))]">
        <div className="flex h-full flex-col gap-3 p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--wt-text-low)]">
              {feature.tag}
            </span>
            {feature.alpha ? (
              <span
                className="border border-[color:var(--wt-line)] px-1.5 py-0.5 font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-lantern)]"
                style={{ borderRadius: 'var(--wt-radius-sm)' }}
              >
                Alpha
              </span>
            ) : null}
          </div>
          <h2 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-[color:var(--wt-text)] md:text-[1.125rem]">
            {feature.title}
          </h2>
          <p className="m-0 text-[0.875rem] leading-relaxed text-[color:var(--wt-text-mid)] md:text-[0.9375rem]">
            {feature.blurb}
          </p>
        </div>
      </InstrumentPlate>
    </Reveal>
  );
}
