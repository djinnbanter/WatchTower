import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { FadeIn, HeroWatermark } from '@/ui/motion';
import { Button, EmptyState, ErrorState, StatusPill } from '@/ui/patterns';
import { Calendar } from '@/ui/icons';
import { PanelShell, openTabLink, severityTone } from '../shared';
import {
  formatDigestPeriod,
  parseDigestHistory,
  trendLabel,
  trendTone,
  type DigestRow,
} from '../weekly-digest';

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">
        {label}
      </div>
      <div className="mt-1.5 font-mono text-xl font-semibold leading-none tabular-nums text-wt-text">
        {value}
      </div>
      {detail ? (
        <div className="mt-1.5 truncate text-xs text-wt-text-mid" title={detail}>
          {detail}
        </div>
      ) : (
        <div className="mt-1.5 text-xs text-transparent select-none">·</div>
      )}
    </div>
  );
}

function formatDiskGrowth(row: DigestRow): string {
  if (row.diskGrowthGb == null) return '—';
  const sign = row.diskGrowthGb >= 0 ? '+' : '';
  return `${sign}${row.diskGrowthGb.toFixed(1)} GB`;
}

function formatMsptDelta(row: DigestRow): string {
  if (row.perfTrend === 'insufficient' || row.msptDeltaPct == null) return '—';
  const sign = row.msptDeltaPct >= 0 ? '+' : '';
  return `${sign}${row.msptDeltaPct.toFixed(0)}%`;
}

export function WeeklyDigestPanel() {
  const queryClient = useQueryClient();
  const digestQ = useQuery({ queryKey: ['weekly-digest'], queryFn: api.weeklyDigest });
  const [genError, setGenError] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: api.weeklyDigestGenerate,
    onSuccess: () => {
      setGenError(null);
      void queryClient.invalidateQueries({ queryKey: ['weekly-digest'] });
      void queryClient.invalidateQueries({ queryKey: ['ops-cache'] });
    },
    onError: (e: Error) => {
      setGenError(e?.message || 'Generate failed');
    },
  });

  if (digestQ.isLoading) {
    return (
      <PanelShell>
        <div className="h-40 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </PanelShell>
    );
  }
  if (digestQ.isError) {
    return (
      <PanelShell>
        <ErrorState title="Couldn't load weekly digest">
          {(digestQ.error as Error)?.message}
        </ErrorState>
      </PanelShell>
    );
  }

  const rows = parseDigestHistory(digestQ.data);
  const latest = rows[0] ?? null;
  const older = rows.slice(1);

  return (
    <PanelShell>
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Weekly ops digest</h2>
            <p className="text-sm text-wt-text-mid">
              One-week rollup of grade, crashes, disk, MSPT trend, and the top action.
            </p>
          </div>
          <Button
            kind="primary"
            disabled={generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? 'Generating…' : 'Generate digest now'}
          </Button>
        </div>
        {genError ? <p className="mt-2 text-sm text-wt-danger">{genError}</p> : null}
      </FadeIn>

      {!latest ? (
        <EmptyState title="No digest yet">
          One is generated automatically each week, or generate one now.
        </EmptyState>
      ) : (
        <FadeIn>
          <div className="wt-hero-shell wt-plate p-4">
            <HeroWatermark icon={Calendar} tone="accent" size="card" />
            <div className="relative z-[1] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  {latest.gradeWord} · {formatDigestPeriod(latest)}
                </h3>
              </div>
              <StatusPill tone={trendTone(latest.gradeTrend)}>
                Grade {trendLabel(latest.gradeTrend).toLowerCase()}
              </StatusPill>
            </div>

            <div className="relative z-[1] mt-4 grid gap-4 border-y border-wt-line/70 py-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-wt-line/70">
              <div className="lg:px-4 lg:first:pl-0 lg:last:pr-0">
                <Stat
                  label="Crashes"
                  value={String(latest.crashCount)}
                  detail={latest.crashTopMod ? `top: ${latest.crashTopMod}` : 'none'}
                />
              </div>
              <div className="lg:px-4 lg:first:pl-0 lg:last:pr-0">
                <Stat
                  label="Disk growth"
                  value={formatDiskGrowth(latest)}
                  detail={
                    latest.daysUntilFull != null
                      ? `≈${Math.round(latest.daysUntilFull)} days until full`
                      : undefined
                  }
                />
              </div>
              <div className="lg:px-4 lg:first:pl-0 lg:last:pr-0">
                <Stat
                  label="MSPT delta"
                  value={formatMsptDelta(latest)}
                  detail={trendLabel(latest.perfTrend)}
                />
              </div>
              <div className="lg:px-4 lg:first:pl-0 lg:last:pr-0">
                <Stat
                  label="Mod changes"
                  value={`${latest.modsAdded}/${latest.modsRemoved}/${latest.modsChanged}`}
                  detail="added / removed / changed"
                />
              </div>
            </div>

            {latest.topAction ? (
              <button
                type="button"
                onClick={() => openTabLink(latest.topAction!.tabLink)}
                className="relative z-[1] mt-4 flex w-full items-start justify-between gap-3 rounded-[calc(var(--radius-wt)-4px)] border border-wt-line/80 bg-wt-bg2/70 px-3.5 py-3 text-left transition hover:border-wt-accent/40 hover:bg-wt-bg2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">
                    Do this next
                  </div>
                  <div className="mt-1 text-sm font-medium text-wt-text">
                    {latest.topAction.message}
                  </div>
                </div>
                <StatusPill tone={severityTone[latest.topAction.severity] ?? 'info'}>
                  {latest.topAction.severity}
                </StatusPill>
              </button>
            ) : null}
          </div>
        </FadeIn>
      )}

      {older.length > 0 ? (
        <FadeIn>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold tracking-tight">Prior weeks</h3>
            <ul className="space-y-2">
              {older.map((row) => (
                <li
                  key={row.id}
                  className="rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/80 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {row.gradeWord} · {formatDigestPeriod(row)}
                    </div>
                    <StatusPill tone={trendTone(row.gradeTrend)}>
                      {trendLabel(row.gradeTrend)}
                    </StatusPill>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-wt-text-mid">
                    <span>
                      <span className="text-wt-text-low">Crashes</span>{' '}
                      <span className="font-mono tabular-nums text-wt-text">{row.crashCount}</span>
                    </span>
                    <span>
                      <span className="text-wt-text-low">Disk</span>{' '}
                      <span className="font-mono tabular-nums text-wt-text">
                        {formatDiskGrowth(row)}
                      </span>
                    </span>
                    <span>
                      <span className="text-wt-text-low">MSPT</span>{' '}
                      <span className="font-mono tabular-nums text-wt-text">
                        {formatMsptDelta(row)}
                      </span>
                    </span>
                    <span>
                      <span className="text-wt-text-low">Mods</span>{' '}
                      <span className="font-mono tabular-nums text-wt-text">
                        {row.modsAdded}/{row.modsRemoved}/{row.modsChanged}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      ) : null}
    </PanelShell>
  );
}
