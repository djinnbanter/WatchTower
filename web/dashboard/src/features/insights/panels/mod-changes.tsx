import { useMemo, useState, type ReactNode } from 'react';
import { navigate } from '@/app/router';
import { ChartStatFlow } from '@/components/charts/chart-stat-flow';
import { FadeIn, GlareIcon, HeroWatermark } from '@/ui/motion';
import { Button, EmptyState, Section, StatusPill } from '@/ui/patterns';
import { ArrowDownRight, ArrowUpRight, Boxes, Package, RefreshCw } from '@/ui/icons';
import { asArray, asRecord, num, str } from '@/lib/utils';
import { PanelShell } from '../shared';

type ChangeKind = 'added' | 'removed' | 'updated';
type Filter = 'all' | ChangeKind;

type ChangeRow = Record<string, unknown> & { kind: ChangeKind };

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSignedBytes(delta: number): string {
  const abs = formatBytes(Math.abs(delta));
  if (delta > 0) return `+${abs}`;
  if (delta < 0) return `−${abs}`;
  return abs;
}

function formatWhen(isoOrEpoch: unknown): string {
  if (isoOrEpoch == null || isoOrEpoch === '') return '';
  let ms: number;
  if (typeof isoOrEpoch === 'number') {
    ms = isoOrEpoch > 1e12 ? isoOrEpoch : isoOrEpoch * 1000;
  } else {
    const raw = String(isoOrEpoch);
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      ms = n > 1e12 ? n : n * 1000;
    } else {
      ms = Date.parse(raw);
    }
  }
  if (!Number.isFinite(ms)) return '';
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindTone(kind: ChangeKind): 'ok' | 'danger' | 'warn' {
  if (kind === 'added') return 'ok';
  if (kind === 'removed') return 'danger';
  return 'warn';
}

function kindLabel(kind: ChangeKind): string {
  if (kind === 'added') return 'Added';
  if (kind === 'removed') return 'Removed';
  return 'Updated';
}

function changeDetail(m: ChangeRow): string {
  const bits: string[] = [];
  const prev = m.prev_size != null ? num(m.prev_size) : NaN;
  const next = m.size != null ? num(m.size) : NaN;
  if (Number.isFinite(prev) && Number.isFinite(next)) {
    if (prev !== next) {
      bits.push(`${formatBytes(prev)} → ${formatBytes(next)} (${formatSignedBytes(next - prev)})`);
    } else if (m.kind === 'updated') {
      bits.push(formatBytes(next));
    }
  } else if (Number.isFinite(next) && m.kind === 'added') {
    bits.push(formatBytes(next));
  }
  if (m.kind === 'updated' && str(m.prev_jar) && str(m.jar) && str(m.prev_jar) !== str(m.jar)) {
    bits.push('jar renamed');
  }
  const when = formatWhen(m.mtime);
  if (when && m.kind === 'updated') bits.push(`touched ${when}`);
  return bits.join(' · ');
}

function versionLabel(row: ChangeRow): ReactNode {
  const next = str(row.version);
  if (row.kind === 'updated') {
    const prev = str(row.prev_version);
    if (prev && next && prev !== next) {
      return (
        <span className="font-mono">
          <span className="text-wt-text-low">{prev}</span>
          <span className="mx-1 text-wt-text-low">→</span>
          <span className="text-wt-text">{next}</span>
        </span>
      );
    }
    if (next) return <span className="font-mono">{next}</span>;
    if (prev) {
      return (
        <span className="font-mono">
          <span className="text-wt-text-low">{prev}</span>
          <span className="mx-1 text-wt-text-low">→</span>
          <span>?</span>
        </span>
      );
    }
    return '—';
  }
  if (!next) return '—';
  return <span className="font-mono">{next}</span>;
}

export function ModChangesPanel({ ops }: { ops: Record<string, unknown> }) {
  const inv = asRecord(ops.mods_inventory);
  const [filter, setFilter] = useState<Filter>('all');

  const diff = asRecord(inv.diff);
  const added = asArray<Record<string, unknown>>(diff.added);
  const removed = asArray<Record<string, unknown>>(diff.removed);
  const changed = asArray<Record<string, unknown>>(diff.changed);
  const hasChanges = diff.has_changes === true || added.length + removed.length + changed.length > 0;

  const rows = useMemo<ChangeRow[]>(() => {
    const list: ChangeRow[] = [
      ...added.map((m) => ({ ...m, kind: 'added' as const })),
      ...removed.map((m) => ({ ...m, kind: 'removed' as const })),
      ...changed.map((m) => ({ ...m, kind: 'updated' as const })),
    ];
    const rank = { added: 0, updated: 1, removed: 2 };
    return list.sort((a, b) => {
      const rk = rank[a.kind] - rank[b.kind];
      if (rk !== 0) return rk;
      return str(a.display_name, str(a.mod_id)).localeCompare(str(b.display_name, str(b.mod_id)));
    });
  }, [added, removed, changed]);

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.kind === filter);
  const scanned = formatWhen(inv.scanned_at);
  const jarCount = num(inv.jar_count);
  const tldr = str(inv.tldr);

  if (!Object.keys(inv).length) {
    return (
      <PanelShell>
        <EmptyState title="No mod inventory yet">
          Waiting for Scanning to populate the mods folder — check Mods after the next scan.
        </EmptyState>
      </PanelShell>
    );
  }

  if (!hasChanges) {
    return (
      <PanelShell>
        <FadeIn>
          <div className="in-mod-hero wt-hero-shell wt-plate relative p-5">
            <HeroWatermark icon={Package} tone="ok" size="card" />
            <div className="relative z-[1] flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">Mods folder unchanged</h3>
                </div>
                <p className="mt-1 text-sm text-wt-text-mid">
                  Current jars match the last report snapshot — nothing to review here.
                </p>
                <p className="mt-2 text-xs text-wt-text-low">
                  {jarCount > 0 ? `${Math.round(jarCount)} jars` : 'Inventory ready'}
                  {scanned ? ` · scanned ${scanned}` : ''}
                </p>
              </div>
              <Button kind="default" onClick={() => navigate({ tab: 'mods', view: 'overview', panel: null })}>
                Open Mods inventory
              </Button>
            </div>
          </div>
        </FadeIn>
      </PanelShell>
    );
  }

  const counts = {
    all: rows.length,
    added: added.length,
    removed: removed.length,
    updated: changed.length,
  };

  return (
    <PanelShell>
      <FadeIn>
        <div className="in-mod-hero wt-hero-shell wt-plate relative p-5">
          <HeroWatermark icon={Package} tone="accent" size="card" />
          <div className="relative z-[1] flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">Since last report</h3>
                <StatusPill tone="info">{counts.all} change{counts.all === 1 ? '' : 's'}</StatusPill>
              </div>
              <p className="mt-2 text-sm text-wt-text-mid">
                {tldr ||
                  `${counts.added} added, ${counts.removed} removed, ${counts.updated} updated`}
              </p>
              <p className="mt-1 text-xs text-wt-text-low">
                {jarCount > 0 ? `${Math.round(jarCount)} jars in folder` : null}
                {jarCount > 0 && scanned ? ' · ' : null}
                {scanned ? `scanned ${scanned}` : null}
              </p>
            </div>
            <Button kind="default" onClick={() => navigate({ tab: 'mods', view: 'overview', panel: null })}>
              Open Mods inventory
            </Button>
          </div>

          <div className="in-mod-stat-grid mt-4">
            {(
              [
                { id: 'added' as const, label: 'Added', count: counts.added, icon: ArrowUpRight, tone: 'ok' as const },
                {
                  id: 'removed' as const,
                  label: 'Removed',
                  count: counts.removed,
                  icon: ArrowDownRight,
                  tone: 'danger' as const,
                },
                {
                  id: 'updated' as const,
                  label: 'Updated',
                  count: counts.updated,
                  icon: RefreshCw,
                  tone: 'warn' as const,
                },
              ] as const
            ).map((s) => {
              const active = filter === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`in-mod-stat in-mod-stat--${s.tone}${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setFilter(active ? 'all' : s.id)}
                >
                  <div className="in-mod-stat__top">
                    <GlareIcon icon={s.icon} tone={s.tone} size={13} className="h-6 w-6 rounded-md" />
                    <span className="in-mod-stat__label">{s.label}</span>
                  </div>
                  <div className="in-mod-stat__value">
                    <ChartStatFlow
                      value={s.count}
                      label={s.label}
                      labelClassName="sr-only"
                      valueClassName="in-mod-stat__flow"
                      formatOptions={{ maximumFractionDigits: 0, minimumFractionDigits: 0 }}
                    />
                  </div>
                  <div className="in-mod-stat__hint">{active ? 'Showing only these' : 'Click to filter'}</div>
                </button>
              );
            })}
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <Section
          title={filter === 'all' ? 'Change log' : `${kindLabel(filter)} changes`}
          icon={Boxes}
          hint="Mods folder vs last report snapshot — version bumps, jar size, and mtime."
          actions={
            filter !== 'all' ? (
              <Button kind="ghost" onClick={() => setFilter('all')}>
                Show all ({counts.all})
              </Button>
            ) : null
          }
        >
          {filtered.length ? (
            <div className="in-table-scroll">
              <table className="in-table">
                <thead>
                  <tr>
                    <th>Mod</th>
                    <th>ID</th>
                    <th>Version</th>
                    <th>Detail</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => {
                    const detail = changeDetail(row);
                    return (
                      <tr key={`${row.kind}-${str(row.jar, str(row.mod_id))}-${i}`}>
                        <td>
                          <div className="font-medium text-wt-text">
                            {str(row.display_name, str(row.mod_id, 'Unknown'))}
                          </div>
                          {str(row.jar) ? (
                            <div className="text-xs text-wt-text-low font-mono truncate" title={str(row.jar)}>
                              {str(row.jar)}
                            </div>
                          ) : null}
                        </td>
                        <td className="font-mono">{str(row.mod_id, '—')}</td>
                        <td>{versionLabel(row)}</td>
                        <td className="text-wt-text-mid">{detail || '—'}</td>
                        <td>
                          <StatusPill tone={kindTone(row.kind)}>{kindLabel(row.kind)}</StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={`No ${filter} changes`}>Try another filter.</EmptyState>
          )}
        </Section>
      </FadeIn>
    </PanelShell>
  );
}
