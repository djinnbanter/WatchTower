'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { HowDeskShell, HowPill } from '@/components/how/plate-shell';
import { LINKS } from '@/content/product';

const COMMAND = 'java -jar watchtower-cli-1.1.9.jar dr';

/** Optional DR CLI plate - Spark-style command tray when the game will not boot. */
export function CliPlate({ className = '' }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <HowDeskShell
      title="Disaster recovery CLI"
      badge={<HowPill tone="warn">Optional</HowPill>}
      className={className}
    >
      <div className="flex flex-col gap-3 px-3 pb-4 pt-1">
        <p className="m-0 text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-mid)]">
          When Minecraft will not stay up, run the CLI on the host. Match the jar version from
          Releases.
        </p>

        <div
          className="flex flex-wrap items-center gap-2 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] px-3 py-2.5"
          style={{ borderRadius: 'var(--wt-radius-sm)' }}
        >
          <code className="min-w-0 flex-1 break-all font-mono text-[0.8125rem] leading-relaxed text-[color:var(--wt-ok)]">
            {COMMAND}
          </code>
          <button
            type="button"
            onClick={copyCommand}
            className="inline-flex shrink-0 items-center gap-1.5 border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] px-2.5 py-1.5 text-[0.75rem] font-semibold text-[color:var(--wt-text)] transition-colors hover:border-[color:var(--wt-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wt-accent)]"
            style={{ borderRadius: 'var(--wt-radius-sm)' }}
            aria-label={copied ? 'Copied' : 'Copy command'}
          >
            {copied ? <Check size={12} strokeWidth={2.5} aria-hidden /> : <Copy size={12} strokeWidth={2} aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <HowPill tone="neutral">Host only</HowPill>
          <a
            href={LINKS.wikiDisasterRecovery}
            className="text-[0.8125rem] font-medium text-[color:var(--wt-text)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Disaster Recovery wiki
          </a>
        </div>
      </div>
    </HowDeskShell>
  );
}
