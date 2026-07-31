'use client';

import { InstrumentPlate } from '@/components/instrument-plate';
import { LINKS } from '@/content/product';

/** Optional DR CLI plate when the game will not boot. */
export function CliPlate({ className = '' }: { className?: string }) {
  return (
    <InstrumentPlate className={className} elevation="flat">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-low)]">
          Optional · when the game will not boot
        </div>
        <code
          className="block break-all border border-[color:var(--wt-line)] bg-[color:var(--wt-bg2)]/50 px-3 py-3 font-mono text-[0.8125rem] leading-relaxed text-[color:var(--wt-text)]"
          style={{ borderRadius: 'var(--wt-radius-sm)' }}
        >
          {'java -jar watchtower-cli-<version>.jar dr'}
        </code>
        <p className="m-0 text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          Match the CLI jar version from Releases. Full flags and bundle steps:{' '}
          <a
            href={LINKS.wikiDisasterRecovery}
            className="text-[color:var(--wt-text)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Disaster Recovery wiki
          </a>
          .
        </p>
      </div>
    </InstrumentPlate>
  );
}
