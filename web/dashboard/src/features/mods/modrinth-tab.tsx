import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import AnimatedList from '@/components/animated-list/AnimatedList';
import { api } from '@/api/client';
import { navigate } from '@/app/router';
import { asArray, asRecord, num, str, timeAgo } from '@/lib/utils';
import { WtBarChart, WtRing } from '@/ui/charts';
import { Check, Gauge, Network, Package, RefreshCw, Timer } from '@/ui/icons';
import { FadeIn, useCountUp } from '@/ui/motion';
import { Button, EmptyState } from '@/ui/patterns';
import { ModIcon, ModrinthMark } from './components';
import {
  MODRINTH_SCAN_STAGES,
  formatElapsed,
  formatEta,
  formatWhen,
  pct,
  stageStatus,
} from './modrinth';

function KpiPlate({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string | null;
  tone?: 'default' | 'ok' | 'warn' | 'danger' | 'info';
}) {
  const numeric = typeof value === 'number' ? value : Number.NaN;
  const counted = useCountUp(Number.isFinite(numeric) ? numeric : 0);
  const display = typeof value === 'number' && Number.isFinite(value) ? counted : value;
  return (
    <div className={`md-mr-kpi md-mr-kpi--${tone}`}>
      <span className="md-mr-kpi__label">{label}</span>
      <span className="md-mr-kpi__value">{display}</span>
      {hint ? <span className="md-mr-kpi__hint">{hint}</span> : null}
    </div>
  );
}

function OpsStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: typeof Package;
  label: string;
  value: number | null;
  hint?: string | null;
  tone?: 'default' | 'ok' | 'warn' | 'danger' | 'info';
}) {
  const counted = useCountUp(value ?? 0);
  return (
    <div className={`md-mr-ops__tile md-mr-ops__tile--${tone}`}>
      <span className="md-mr-ops__icon" aria-hidden>
        <Icon size={22} />
      </span>
      <div className="md-mr-ops__body">
        <span className="md-mr-ops__value">{value == null ? '—' : counted}</span>
        <span className="md-mr-ops__label">{label}</span>
        {hint ? <span className="md-mr-ops__hint">{hint}</span> : null}
      </div>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 md-mr-panel${className ? ` ${className}` : ''}`}>
      <header className="md-mr-panel__head">
        <h3>{title}</h3>
        {hint ? <p>{hint}</p> : null}
      </header>
      <div className="md-mr-panel__body">{children}</div>
    </div>
  );
}

function ModrinthStageChecklist({ status }: { status: Record<string, unknown> }) {
  if (!status.running && status.success == null && !status.last_run) return null;

  const activeId = str(status.stage, MODRINTH_SCAN_STAGES[0].id);
  const activeLabel =
    str(status.stage_label) ||
    MODRINTH_SCAN_STAGES.find((s) => s.id === activeId)?.label ||
    activeId;
  const detail = str(status.stage_detail) || null;
  const lastRun = asRecord(status.last_run);
  const startedMs = lastRun.started_at
    ? Date.parse(str(lastRun.started_at))
    : num(status.startedAt, NaN);
  const elapsed = status.running
    ? formatElapsed(Number.isFinite(startedMs) ? startedMs : null, Date.now())
    : null;
  const stepNum = Math.max(1, MODRINTH_SCAN_STAGES.findIndex((s) => s.id === activeId) + 1);
  const progress = asRecord(status.progress);
  const batch = asRecord(status.batch);
  const done = num(progress.done);
  const total = num(progress.total);
  const pctDone = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const eta = formatEta(status.eta_seconds as number | undefined);
  const batchLabel =
    num(batch.count) > 0
      ? `Batch ${num(batch.index)}/${num(batch.count)}${batch.size ? ` (${batch.size} hashes)` : ''}`
      : null;
  const failed = !status.running && (status.success === false || lastRun.success === false);
  const complete = !status.running && !failed && (status.success === true || lastRun.success === true);
  const durationLabel = lastRun.duration_ms
    ? `${Math.round(num(lastRun.duration_ms) / 1000)}s`
    : null;
  const finishedAt = str(lastRun.finished_at);

  return (
    <div className="md-mr-stages" role="status" aria-live="polite">
      <div className="md-mr-stages__meta">
        {status.running ? (
          <>
            <span>
              Step {stepNum} of {MODRINTH_SCAN_STAGES.length}
            </span>
            {elapsed ? <span>Elapsed {elapsed}</span> : null}
            {eta ? <span>ETA {eta}</span> : null}
          </>
        ) : complete ? (
          <>
            <span className="md-mr-stages__meta-pill md-mr-stages__meta-pill--ok">Complete</span>
            {durationLabel ? <span>{durationLabel}</span> : null}
            {finishedAt ? <span>{timeAgo(finishedAt)}</span> : null}
          </>
        ) : failed ? (
          <>
            <span className="md-mr-stages__meta-pill md-mr-stages__meta-pill--warn">Failed</span>
            {durationLabel ? <span>{durationLabel}</span> : null}
          </>
        ) : null}
      </div>

      <ol className="md-mr-stages__list">
        {MODRINTH_SCAN_STAGES.map((stage, i) => {
          const st = stageStatus(stage.id, activeId, !!status.running, status.success as boolean | null);
          return (
            <li key={stage.id} className={`md-mr-stages__item md-mr-stages__item--${st}`}>
              <span className="md-mr-stages__marker" aria-hidden>
                {st === 'done' ? (
                  <Check size={13} />
                ) : st === 'active' ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <span className="md-mr-stages__idx">{i + 1}</span>
                )}
              </span>
              <span className="md-mr-stages__label">{stage.label}</span>
              <span className="md-mr-stages__state">
                {st === 'done' ? 'Done' : st === 'active' ? 'Now' : 'Queued'}
              </span>
            </li>
          );
        })}
      </ol>

      {status.running ? (
        <>
          <div className="md-mr-progress">
            <div
              className="md-mr-progress__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total || 100}
              aria-valuenow={done}
            >
              <span style={{ ['--pct' as string]: pctDone / 100 }} />
            </div>
            <p className="md-mr-progress__meta">
              {total > 0 ? <span>{done}/{total}</span> : null}
              {batchLabel ? <span>{batchLabel}</span> : null}
            </p>
          </div>
          <div className="md-mr-stages__live">
            <p>
              <RefreshCw size={14} className="inline animate-spin" /> Currently: {activeLabel}
            </p>
            <p className="md-mr-stages__detail">
              {detail || 'Hashing and Modrinth lookups can take a minute on large packs.'}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ModrinthTab({
  status,
  modrinthLookupEnabled,
  factsMods = [],
  modrinthUpdates = [],
}: {
  status: Record<string, unknown>;
  hasReport?: boolean;
  modrinthLookupEnabled?: boolean;
  factsMods?: Record<string, unknown>[];
  modrinthUpdates?: Record<string, unknown>[];
}) {
  const qc = useQueryClient();
  const gated = modrinthLookupEnabled === false || status.enabled === false;
  const scanM = useMutation({
    mutationFn: () => api.modrinthScanStart(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['modrinth-status'] });
      void qc.invalidateQueries({ queryKey: ['ops-cache'] });
      void qc.invalidateQueries({ queryKey: ['facts'] });
    },
  });

  const stats = asRecord(status.stats);
  const lastRun = asRecord(status.last_run);
  const sideMix = asRecord(stats.side_tag_mix);
  const topOutdated = asArray<Record<string, unknown>>(stats.top_outdated).slice(0, 5);
  const running = !!status.running || scanM.isPending;
  const failed = lastRun.success === false;
  const outdatedCount = num(stats.outdated);

  const iconByModId = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of modrinthUpdates) {
      const id = str(u.mod_id ?? u.id);
      const icon = str(u.icon_url ?? u.modrinth_icon_url);
      if (id && icon) map.set(id, icon);
    }
    for (const m of factsMods) {
      const id = str(m.id ?? m.mod_id);
      const icon = str(m.modrinth_icon_url ?? m.icon_url);
      if (id && icon && !map.has(id)) map.set(id, icon);
    }
    return map;
  }, [factsMods, modrinthUpdates]);

  if (gated) {
    return (
      <div className="md-empty">
        <EmptyState title="Modrinth lookup is off">
          Enable Modrinth lookup in Settings → Monitoring, then run a scan from this tab. Watchtower
          only sends jar SHA-512 hashes for identity and update hints. Assisted jar changes need mods.mutate permission and an explicit confirm — never silent downloads.
        </EmptyState>
        <Button kind="default" onClick={() => navigate({ tab: 'settings', panel: 'integrations' })}>
          Open Settings
        </Button>
      </div>
    );
  }

  const scanned = !!(lastRun.finished_at || (stats.matched != null && num(stats.jars_considered) > 0));
  const coveragePct = stats.coverage_pct != null ? num(stats.coverage_pct) : null;
  const coverage = coveragePct != null ? pct(coveragePct) : '—';
  const hitRate = stats.cache_hit_rate != null ? pct(num(stats.cache_hit_rate)) : '—';
  const heroTone = failed ? 'warn' : running ? 'info' : outdatedCount > 0 ? 'warn' : 'ok';
  const sideServer = num(sideMix.server_required);
  const sideClient = num(sideMix.client_only);
  const sideBoth = num(sideMix.both);
  const sideOther = num(sideMix.other);
  const sideBarData = [
    { name: 'Server', server: sideServer, client: 0, both: 0, other: 0 },
    { name: 'Client', server: 0, client: sideClient, both: 0, other: 0 },
    { name: 'Both', server: 0, client: 0, both: sideBoth, other: 0 },
    { name: 'Other', server: 0, client: 0, both: 0, other: sideOther },
  ];
  const sideBarSeries = [
    { dataKey: 'server', color: 'var(--wt-ok)', label: 'Server' },
    { dataKey: 'client', color: 'var(--wt-danger)', label: 'Client' },
    { dataKey: 'both', color: 'var(--wt-info, var(--wt-accent))', label: 'Both' },
    { dataKey: 'other', color: 'var(--wt-text-low)', label: 'Other' },
  ];
  const hasSideTags = sideServer + sideClient + sideBoth + sideOther > 0;

  const showProgress = running || status.success != null || !!lastRun.finished_at;

  return (
    <div className="md-modrinth">
      <FadeIn>
        <div className={`md-mr-hero md-mr-hero--${heroTone}`}>
          <div className="md-mr-hero__body">
            <div className="md-mr-hero__main">
              <div className="md-mr-hero__head">
                <div className="md-mr-hero__title-block">
                  <div className="md-mr-hero__title">
                    <ModrinthMark size={40} className="md-mr-hero__logo" />
                    <h2>Modrinth scan</h2>
                  </div>
                  <p className="md-mr-hero__hint">
                    Hash installed jars and look them up on Modrinth (batched, rate-limited). Results land
                    in ops-cache so Overview, Updates, and Crashes stay in sync. Lookup is the default; assisted jar mutate (when granted) is a separate confirm-gated action.
                  </p>
                </div>
              </div>
              <div className="md-mr-hero__actions">
                <Button
                  kind="primary"
                  size="md"
                  disabled={running}
                  onClick={() => scanM.mutate()}
                  className="ov-specular-cta md-mr-hero__cta"
                >
                  {running ? 'Scanning…' : 'Run Modrinth scan'}
                </Button>
              </div>
            </div>

            <div className="md-modrinth__kpis" aria-label="Scan vitals">
              <KpiPlate
                label="Coverage"
                value={coverage}
                hint={stats.matched != null ? `${stats.matched} matched` : null}
                tone={
                  coveragePct != null && coveragePct >= 80
                    ? 'ok'
                    : coveragePct != null
                      ? 'warn'
                      : 'default'
                }
              />
              <KpiPlate
                label="Outdated"
                value={stats.outdated != null ? outdatedCount : '—'}
                hint="Compatible updates"
                tone={outdatedCount > 0 ? 'warn' : 'ok'}
              />
              <KpiPlate
                label="Cache hit rate"
                value={hitRate}
                hint={stats.cache_entries != null ? `${stats.cache_entries} entries` : null}
                tone="info"
              />
              <KpiPlate
                label="Last scan"
                value={scanned ? timeAgo(str(lastRun.finished_at)) : 'Not yet'}
                hint={
                  lastRun.success === false
                    ? 'Last run failed'
                    : [
                        scanned ? formatWhen(str(lastRun.finished_at)) : null,
                        lastRun.duration_ms
                          ? `${Math.round(num(lastRun.duration_ms) / 1000)}s`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || null
                }
                tone={failed ? 'danger' : 'default'}
              />
            </div>
          </div>
        </div>
      </FadeIn>

      <div className={`md-modrinth__grid${showProgress ? '' : ' md-modrinth__grid--compact'}`}>
        {showProgress ? (
          <Panel title="Progress" hint="Scan pipeline stages" className="md-mr-panel--progress">
            <ModrinthStageChecklist status={status} />
            {!status.running && status.error ? (
              <p className="md-modrinth__error" role="alert">
                {str(status.error)}
              </p>
            ) : null}
          </Panel>
        ) : null}

        <Panel title="Coverage" hint="Match quality from the last scan" className="md-mr-panel--coverage">
          <div className="md-mr-coverage">
            {coveragePct != null ? (
              <WtRing
                value={coveragePct}
                label="Matched"
                color={coveragePct >= 80 ? 'var(--wt-ok)' : 'var(--wt-warn)'}
                className="md-mr-coverage__ring"
              />
            ) : (
              <p className="md-mr-muted md-mr-coverage__empty">Run a scan to measure coverage.</p>
            )}
            <div className="md-mr-coverage__stats">
              <div className="md-mr-coverage__stat">
                <span>Matched</span>
                <strong>{stats.matched != null ? String(stats.matched) : '—'}</strong>
              </div>
              <div className="md-mr-coverage__stat">
                <span>Unresolved</span>
                <strong>{stats.unresolved != null ? String(stats.unresolved) : '—'}</strong>
              </div>
              <div className="md-mr-coverage__stat">
                <span>Outdated</span>
                <strong>{stats.outdated != null ? String(stats.outdated) : '—'}</strong>
              </div>
              <div className="md-mr-coverage__stat">
                <span>Bytes hashed</span>
                <strong>
                  {stats.bytes_hashed != null
                    ? `${Math.round(num(stats.bytes_hashed) / 1024 / 1024)} MB`
                    : '—'}
                </strong>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Ops" hint="Rate limits and pack size" className="md-mr-panel--ops">
          <div className="md-mr-ops" aria-label="Scan ops vitals">
            <OpsStat
              icon={Package}
              label="Jars considered"
              value={stats.jars_considered != null ? num(stats.jars_considered) : null}
              hint={stats.truncated ? 'Capped by pack limit' : 'Whole pack scanned'}
              tone="info"
            />
            <OpsStat
              icon={Network}
              label="API requests"
              value={stats.api_requests != null ? num(stats.api_requests) : null}
              hint="Modrinth lookups"
              tone="default"
            />
            <OpsStat
              icon={Timer}
              label="429 waits"
              value={stats.rate_limit_waits != null ? num(stats.rate_limit_waits) : null}
              hint={
                num(stats.rate_limit_waits) > 0 ? 'Hit rate limit' : 'Smooth sailing'
              }
              tone={num(stats.rate_limit_waits) > 0 ? 'warn' : 'ok'}
            />
            <OpsStat
              icon={Gauge}
              label="RPS setting"
              value={stats.rps != null ? num(stats.rps) : null}
              hint="Requests / second"
              tone="info"
            />
          </div>
        </Panel>

        <Panel title="Side tags" hint="Modrinth environment labels" className="md-mr-panel--sides">
          {hasSideTags ? (
            <div className="md-mr-side-chart">
              <WtBarChart
                data={sideBarData}
                series={sideBarSeries}
                stacked
                xDataKey="name"
                className="md-mr-side-chart__plot"
              />
            </div>
          ) : (
            <p className="md-mr-muted">Side tags appear after a successful scan.</p>
          )}
        </Panel>

        <Panel title="Top outdated" hint="Jump to Updates" className="md-mr-panel--outdated">
          {topOutdated.length ? (
            <AnimatedList
              className="md-mr-outdated-list"
              items={topOutdated}
              getKey={(row, i) => str(row.mod_id, String(i))}
              showGradients={false}
              enableArrowNavigation
              displayScrollbar={false}
              onItemSelect={(row) =>
                navigate({ tab: 'mods', view: 'updates', filter: null, mod: str(row.mod_id) })
              }
              renderItem={(row, _i, selected) => {
                const id = str(row.mod_id);
                const name = str(row.title || row.mod_id) || 'Unknown';
                const icon =
                  str(row.icon_url ?? row.modrinth_icon_url) || (id ? iconByModId.get(id) : '') || null;
                return (
                  <div className={`md-mr-outdated__item${selected ? ' is-selected' : ''}`}>
                    <ModIcon url={icon} name={name} size={36} />
                    <div className="md-mr-outdated__text">
                      <span className="md-mr-outdated__name">{name}</span>
                      <span className="md-mr-outdated__meta">
                        {[id, str(row.current_version), str(row.latest_compatible)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
          ) : (
            <p className="md-mr-muted">No outdated titles from the last scan.</p>
          )}
          {outdatedCount > 0 ? (
            <div className="md-mr-panel__footer">
              <Button kind="default" onClick={() => navigate({ tab: 'mods', view: 'updates', filter: null })}>
                Open Updates ({outdatedCount})
              </Button>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}

export function ModrinthOverviewBanner({
  modrinthLookupEnabled,
  status,
  compact = false,
}: {
  modrinthLookupEnabled: boolean | undefined;
  status: Record<string, unknown>;
  compact?: boolean;
}) {
  const stats = asRecord(status.stats);
  const lastRun = asRecord(status.last_run);
  const running = !!status.running;
  const go = () => navigate({ tab: 'mods', view: 'modrinth' });
  const chip = compact ? 'md-status__chip' : 'md-banner';
  const labelCls = compact ? 'md-status__label' : 'md-banner__label';
  const textCls = compact ? 'md-status__text' : 'md-banner__text';
  const linkCls = compact ? '' : ' md-banner--link';

  if (modrinthLookupEnabled === false || status.enabled === false) {
    return (
      <button
        type="button"
        className={`${chip} ${chip}--neutral${linkCls}`}
        onClick={go}
      >
        <span className={labelCls}>Modrinth</span>
        <span className={textCls}>
          Lookup is off — enable in Settings, then scan from Mods → Modrinth
        </span>
      </button>
    );
  }

  if (running) {
    return (
      <button type="button" className={`${chip} ${chip}--info${linkCls}`} onClick={go}>
        <span className={labelCls}>Modrinth</span>
        <span className={textCls}>
          Scan in progress{status.stage_label ? ` · ${str(status.stage_label)}` : ''}…
        </span>
      </button>
    );
  }

  const hasSuccess = lastRun.success === true || (status.success === true && lastRun.finished_at);
  if (!hasSuccess && !lastRun.finished_at) {
    return (
      <button type="button" className={`${chip} ${chip}--warn${linkCls}`} onClick={go}>
        <span className={labelCls}>Modrinth</span>
        <span className={textCls}>Not scanned yet — run a scan to enrich mods</span>
      </button>
    );
  }

  if (lastRun.success === false) {
    return (
      <button type="button" className={`${chip} ${chip}--warn${linkCls}`} onClick={go}>
        <span className={labelCls}>Modrinth</span>
        <span className={textCls}>
          Last scan failed{status.error ? ` · ${str(status.error)}` : ''}
        </span>
      </button>
    );
  }

  return (
    <button type="button" className={`${chip} ${chip}--ok${linkCls}`} onClick={go}>
      <span className={labelCls}>Modrinth</span>
      <span className={textCls}>
        Last scan {formatWhen(str(lastRun.finished_at))} · {num(stats.matched)} matched ·{' '}
        {num(stats.outdated)} outdated
      </span>
    </button>
  );
}
