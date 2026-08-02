import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Archive,
  ClipboardList,
  Database,
  Gauge,
  Layers,
  RadioTower,
  Settings,
  Shield,
  Wrench,
} from '@/ui/icons';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { FadeIn, HeroWatermark, PageEnter, Stagger, useCountUp } from '@/ui/motion';
import { Button, ErrorState, HeroCard, StatusPill } from '@/ui/patterns';
import { asRecord, get, num, str, timeAgo } from '@/lib/utils';
import './sources.css';

type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
type KpiTone = 'default' | 'ok' | 'warn' | 'danger' | 'info';

function toKpiTone(tone: Tone): KpiTone {
  if (tone === 'ok' || tone === 'warn' || tone === 'danger' || tone === 'info') return tone;
  return 'default';
}

function freshnessTone(iso: string | null, warnMinutes: number): Tone {
  if (!iso) return 'danger';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'danger';
  const minutes = (Date.now() - t) / 60_000;
  if (minutes < warnMinutes) return 'ok';
  if (minutes < warnMinutes * 3) return 'warn';
  return 'danger';
}

function freshnessLabel(tone: Tone, connected: boolean): string {
  if (!connected) return 'Not connected';
  if (tone === 'ok') return 'Fresh';
  if (tone === 'warn') return 'Aging';
  return 'Stale';
}

function formatCountdown(sec: number | null, mode: 'countdown' | 'idle' | 'waiting' | 'on_request'): string {
  if (mode === 'idle') return 'Idle';
  if (mode === 'waiting') return 'Waiting';
  if (mode === 'on_request') return 'On request';
  if (sec == null || !Number.isFinite(sec)) return '—';
  if (sec <= 0) return 'Due now';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function secondsUntil(lastIso: string | null, intervalSec: number | null, nowMs: number): number | null {
  if (!lastIso || intervalSec == null || !Number.isFinite(intervalSec) || intervalSec <= 0) return null;
  const last = Date.parse(lastIso);
  if (!Number.isFinite(last)) return null;
  return Math.max(0, Math.round((last + intervalSec * 1000 - nowMs) / 1000));
}

function formatCadenceSeconds(sec: number | null | undefined, fallback = 'From server config'): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return fallback;
  if (sec < 60) return `~${Math.round(sec)}s`;
  if (sec % 60 === 0) return `~${sec / 60}m`;
  return `~${Math.round(sec)}s`;
}

function pickIso(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    const s = str(c).trim();
    if (s && Number.isFinite(Date.parse(s))) return s;
  }
  return null;
}

function Kpi({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string | null;
  tone?: KpiTone;
}) {
  const numeric = typeof value === 'number' ? value : Number.NaN;
  const counted = useCountUp(Number.isFinite(numeric) ? numeric : 0);
  const display = typeof value === 'number' && Number.isFinite(value) ? Math.round(counted) : value;
  return (
    <div className={`src-kpi src-kpi--${tone}`}>
      <span className="src-kpi__label">{label}</span>
      <span className="src-kpi__value">{display}</span>
      {hint ? <span className="src-kpi__hint">{hint}</span> : null}
    </div>
  );
}

type JobCard = {
  key: string;
  icon: typeof Activity;
  label: string;
  updatedAt: string | null;
  warnMinutes: number;
  active: boolean | null;
  detail: string;
  countdownSec: number | null;
  countdownMode: 'countdown' | 'idle' | 'waiting' | 'on_request';
};

export function PageView({ route: _route }: { route: RouteState }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dsQ = useQuery({
    queryKey: ['data-sources'],
    queryFn: api.dataSources,
    refetchInterval: 10_000,
  });
  const metaQ = useQuery({
    queryKey: ['overview-meta'],
    queryFn: api.overviewMeta,
    refetchInterval: 10_000,
  });
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const opsQ = useQuery({
    queryKey: ['ops-cache'],
    queryFn: api.opsCache,
    refetchInterval: 15_000,
  });
  const liveQ = useQuery({
    queryKey: ['live'],
    queryFn: api.live,
    refetchInterval: 5_000,
  });
  const modrinthQ = useQuery({
    queryKey: ['modrinth-status'],
    queryFn: api.modrinthStatus,
    refetchInterval: 15_000,
  });

  const loading =
    dsQ.isLoading || metaQ.isLoading || settingsQ.isLoading || opsQ.isLoading || liveQ.isLoading;

  if (loading) {
    return (
      <PageEnter className="src-stack">
        <div className="h-36 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
          <div className="h-28 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
          <div className="h-28 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        </div>
        <div className="h-56 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </PageEnter>
    );
  }

  if (dsQ.isError && metaQ.isError) {
    return (
      <ErrorState title="Couldn't load Watchtower sources">
        {(dsQ.error as Error)?.message || (metaQ.error as Error)?.message}
      </ErrorState>
    );
  }

  const ds = asRecord(dsQ.data);
  const meta = asRecord(metaQ.data);
  const settings = asRecord(settingsQ.data ?? {});
  const ops = asRecord(opsQ.data);
  const live = asRecord(liveQ.data);
  const modrinth = asRecord(modrinthQ.data);
  const lastRun = asRecord(modrinth.last_run);

  const liveAt = pickIso(
    get(live, 'latest', 'polled_at'),
    get(live, 'latest', 'time'),
    ds.live_at,
  );
  const scanAt = pickIso(ds.ops_scan_at, meta.ops_cache_updated_at, ops.updated_at);
  const issuesAt = pickIso(ds.issues_live_at, ops.issues_live_updated_at, scanAt);
  const supportAt = pickIso(ds.support_compose_at, ops.last_support_compose_at);
  const reportAt = pickIso(ds.full_report_at, meta.last_report_at);
  const activityAt = pickIso(meta.activity_scanned_at, get(ops, 'activity', 'scanned_at'));
  const modsAt = pickIso(meta.mods_scanned_at, get(ops, 'mods_inventory', 'scanned_at'));
  const backupsAt = pickIso(meta.backups_scanned_at, get(ops, 'backups_live', 'scanned_at'));
  const modrinthAt = pickIso(lastRun.finished_at, get(ops, 'modrinth_scan', 'finished_at'));

  const liveSec =
    settings.live_sample_interval_seconds != null
      ? num(settings.live_sample_interval_seconds)
      : settings.live_sample_interval_sec != null
        ? num(settings.live_sample_interval_sec)
        : 1;
  const opsPollSec =
    ds.ops_poll_sec != null ? num(ds.ops_poll_sec) : settings.ops_poll_sec != null ? num(settings.ops_poll_sec) : 60;
  const opsLogScanSec =
    ds.ops_log_scan_sec != null
      ? num(ds.ops_log_scan_sec)
      : settings.ops_log_scan_sec != null
        ? num(settings.ops_log_scan_sec)
        : 60;
  const backupPollMin =
    settings.backup_poll_min != null ? num(settings.backup_poll_min) : null;
  const backupPollSec = backupPollMin != null && backupPollMin > 0 ? backupPollMin * 60 : null;

  const opsPollActive = meta.ops_poll_active === true;
  const opsLogScanActive = meta.ops_log_scan_active === true;
  const backupPollActive = meta.backup_poll_active === true;
  const modrinthRunning = !!modrinth.running;

  const liveCountdown = secondsUntil(liveAt, liveSec, nowMs);
  const logCountdown = opsLogScanActive
    ? secondsUntil(activityAt ?? scanAt, opsLogScanSec, nowMs)
    : null;
  const opsCountdown = opsPollActive ? secondsUntil(scanAt, opsPollSec, nowMs) : null;
  const backupCountdown =
    backupPollActive && backupPollSec != null ? secondsUntil(backupsAt, backupPollSec, nowMs) : null;

  const nextCandidates = [
    { key: 'live', sec: liveCountdown, label: 'Live sample' },
    { key: 'log', sec: logCountdown, label: 'Log scan' },
    { key: 'ops', sec: opsCountdown, label: 'Ops poll' },
    { key: 'backup', sec: backupCountdown, label: 'Backup poll' },
  ].filter((c) => c.sec != null) as { key: string; sec: number; label: string }[];

  const nextPull = nextCandidates.sort((a, b) => a.sec - b.sec)[0] ?? null;

  const pollerActiveCount =
    1 + (opsLogScanActive ? 1 : 0) + (opsPollActive ? 1 : 0) + (backupPollActive ? 1 : 0);

  const staleJobs = [
    freshnessTone(liveAt, 1),
    freshnessTone(scanAt, 5),
    freshnessTone(activityAt, 5),
  ];
  const hasDanger = staleJobs.includes('danger') || (!opsLogScanActive && !opsPollActive);
  const hasWarn = staleJobs.includes('warn') || !opsLogScanActive;
  const heroTone: Tone = hasDanger ? 'danger' : hasWarn ? 'warn' : 'ok';
  const heroVerdict =
    heroTone === 'ok'
      ? 'All systems polling'
      : heroTone === 'warn'
        ? 'Degraded'
        : 'Stale';

  const openMonitoring = () => navigate({ tab: 'settings', panel: 'monitoring' });

  const layers = [
    {
      key: 'watching',
      name: 'Watching',
      desc: 'Live vitals and charts — sample tick from the mod runtime.',
      at: liveAt,
      warn: 1,
      cadence: formatCadenceSeconds(liveSec, '~1–5s'),
      detail: null as string | null,
    },
    {
      key: 'scanning',
      name: 'Scanning',
      desc: 'Background ops: log tail, activity, Issues live, crashes, mods.',
      at: scanAt,
      warn: 5,
      cadence: formatCadenceSeconds(opsLogScanSec || opsPollSec, '~60s'),
      detail: issuesAt
        ? `Issues live ${timeAgo(issuesAt)}`
        : 'Issues live waiting for first ops tick',
    },
    {
      key: 'support',
      name: 'Support compose',
      desc: 'On-demand zip for sharing a frozen snapshot — not day-to-day truth.',
      at: supportAt,
      warn: 24 * 60,
      cadence: 'On request',
      detail: reportAt ? `Last full report ${timeAgo(reportAt)}` : null,
    },
  ];

  const jobs: JobCard[] = [
    {
      key: 'live',
      icon: RadioTower,
      label: 'Live telemetry',
      updatedAt: liveAt,
      warnMinutes: 1,
      active: true,
      detail: `Sample every ${formatCadenceSeconds(liveSec)}`,
      countdownSec: liveCountdown,
      countdownMode: 'countdown',
    },
    {
      key: 'ops-cache',
      icon: Database,
      label: 'Ops cache',
      updatedAt: scanAt,
      warnMinutes: 5,
      active: opsPollActive,
      detail: opsPollActive
        ? `Session-gated poll every ${formatCadenceSeconds(opsPollSec)}`
        : 'Session-gated poller idle',
      countdownSec: opsCountdown,
      countdownMode: opsPollActive ? 'countdown' : 'idle',
    },
    {
      key: 'activity',
      icon: Activity,
      label: 'Activity / log scan',
      updatedAt: activityAt,
      warnMinutes: 5,
      active: opsLogScanActive,
      detail: `Always-on scan every ${formatCadenceSeconds(opsLogScanSec)}`,
      countdownSec: logCountdown,
      countdownMode: opsLogScanActive ? 'countdown' : 'idle',
    },
    {
      key: 'mods',
      icon: Wrench,
      label: 'Mod scan',
      updatedAt: modsAt,
      warnMinutes: 30,
      active: null,
      detail: `${meta.running_mod_count ?? get(ops, 'running_mods', 'count') ?? 0} mods indexed`,
      countdownSec: null,
      countdownMode: 'waiting',
    },
    {
      key: 'backups',
      icon: Archive,
      label: 'Backup scan',
      updatedAt: backupsAt,
      warnMinutes: 60,
      active: backupPollActive,
      detail: backupPollSec
        ? `Folder poll every ${formatCadenceSeconds(backupPollSec)}`
        : 'Filesystem watcher for backup archives',
      countdownSec: backupCountdown,
      countdownMode: backupPollActive
        ? backupPollSec
          ? 'countdown'
          : 'waiting'
        : 'idle',
    },
    {
      key: 'modrinth',
      icon: Gauge,
      label: 'Modrinth lookup',
      updatedAt: modrinthAt,
      warnMinutes: 24 * 60,
      active: modrinthRunning,
      detail: modrinthRunning
        ? `Scan in progress${modrinth.stage_label ? ` · ${str(modrinth.stage_label)}` : ''}`
        : lastRun.success === false
          ? 'Last scan failed'
          : 'On-demand / after mod changes',
      countdownSec: null,
      countdownMode: modrinthRunning ? 'waiting' : 'on_request',
    },
    {
      key: 'issues',
      icon: Shield,
      label: 'Issues live',
      updatedAt: issuesAt,
      warnMinutes: 5,
      active: opsLogScanActive || opsPollActive,
      detail: 'Continuous issue evaluation from ops scans',
      countdownSec: logCountdown ?? opsCountdown,
      countdownMode:
        opsLogScanActive || opsPollActive
          ? (logCountdown ?? opsCountdown) != null
            ? 'countdown'
            : 'waiting'
          : 'idle',
    },
    {
      key: 'support',
      icon: ClipboardList,
      label: 'Support compose',
      updatedAt: supportAt,
      warnMinutes: 24 * 60,
      active: null,
      detail: 'Packaged when you build a support zip',
      countdownSec: null,
      countdownMode: 'on_request',
    },
  ];

  return (
    <PageEnter className="src-stack">
      <FadeIn>
        <HeroCard
          tone={heroTone === 'ok' || heroTone === 'warn' || heroTone === 'danger' || heroTone === 'info' ? heroTone : 'info'}
          className={`src-hero src-hero--${heroTone}`}
        >
          <div className="src-hero__body wt-hero-shell">
            <HeroWatermark icon={Layers} tone={heroTone} />
            <div className="src-hero__main">
              <div className="src-hero__title">
                <h2>Watchtower health</h2>
                <StatusPill tone={heroTone}>{heroVerdict}</StatusPill>
              </div>
              <p className="src-hero__hint">
                Pollers, feed freshness, and when the next data pull is due — so you can trust the
                dashboard is current.
              </p>
              <div className="src-hero__actions">
                <Button kind="primary" onClick={openMonitoring}>
                  <Settings size={14} />
                  Open monitoring settings
                </Button>
              </div>
            </div>

            <div className="src-kpis" aria-label="Watchtower vitals">
              <Kpi
                label="Next pull"
                value={
                  nextPull
                    ? formatCountdown(nextPull.sec, 'countdown')
                    : '—'
                }
                hint={nextPull ? nextPull.label : 'No scheduled tick'}
                tone={
                  nextPull == null
                    ? 'default'
                    : nextPull.sec <= 0
                      ? 'warn'
                      : nextPull.sec <= 15
                        ? 'info'
                        : 'ok'
                }
              />
              <Kpi
                label="Pollers"
                value={`${pollerActiveCount} on`}
                hint={
                  opsPollActive
                    ? 'Live + log scan + ops poll'
                    : backupPollActive
                      ? 'Live + log scan + backups'
                      : 'Live + log scan'
                }
                tone={opsLogScanActive ? 'ok' : 'warn'}
              />
              <Kpi
                label="Ops cache"
                value={scanAt ? timeAgo(scanAt) : '—'}
                hint={scanAt ? 'Last write' : 'No ops-cache yet'}
                tone={toKpiTone(freshnessTone(scanAt, 5))}
              />
              <Kpi
                label="Live sample"
                value={liveAt ? timeAgo(liveAt) : '—'}
                hint={formatCadenceSeconds(liveSec)}
                tone={toKpiTone(freshnessTone(liveAt, 1) === 'ok' ? 'info' : freshnessTone(liveAt, 1))}
              />
            </div>
          </div>
        </HeroCard>
      </FadeIn>

      <FadeIn>
        <div className="src-panel">
          <div className="src-panel__head">
            <div>
              <h3>Source layers</h3>
              <p>Watching, Scanning, and Support compose</p>
            </div>
          </div>
          <div className="src-layers">
            {layers.map((layer) => {
              const connected = !!layer.at;
              const tone = freshnessTone(layer.at, layer.warn);
              return (
                <div key={layer.key} className={`src-layer src-layer--${connected ? tone : 'danger'}`}>
                  <div className="src-layer__top">
                    <div className="src-layer__title">
                      <span
                        className={`src-layer__dot src-layer__dot--${connected ? tone : 'danger'}`}
                        aria-hidden
                      />
                      <h4 className="src-layer__name">{layer.name}</h4>
                    </div>
                    <StatusPill tone={connected ? tone : 'danger'}>
                      {freshnessLabel(tone, connected)}
                    </StatusPill>
                  </div>
                  <p className="src-layer__desc">{layer.desc}</p>
                  <div className="src-layer__meta">
                    <span className="src-layer__cadence">{layer.cadence}</span>
                    <span>
                      {connected ? `Last update ${timeAgo(layer.at)}` : 'Not connected'}
                    </span>
                  </div>
                  {layer.detail ? <div className="src-layer__meta">{layer.detail}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      <FadeIn>
        <div className="src-panel">
          <div className="src-panel__head">
            <div>
              <h3>Background jobs</h3>
              <p>Per-poller freshness and countdown to the next expected tick</p>
            </div>
            <StatusPill tone="info">{jobs.length} jobs</StatusPill>
          </div>
          <Stagger className="src-jobs">
            {jobs.map((job) => {
              const tone = freshnessTone(job.updatedAt, job.warnMinutes);
              const Icon = job.icon;
              const cd = formatCountdown(job.countdownSec, job.countdownMode);
              const due = job.countdownMode === 'countdown' && (job.countdownSec ?? 1) <= 0;
              return (
                <article key={job.key} className={`src-job src-job--${tone}`}>
                  <div className="src-job__top">
                    <div className="src-job__id">
                      <span className="src-job__icon" aria-hidden>
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0">
                        <h4 className="src-job__name">{job.label}</h4>
                        <div className="src-job__when">
                          {job.updatedAt ? `Updated ${timeAgo(job.updatedAt)}` : 'No timestamp yet'}
                        </div>
                      </div>
                    </div>
                    <StatusPill tone={tone}>{freshnessLabel(tone, !!job.updatedAt)}</StatusPill>
                  </div>
                  <p className="src-job__detail">{job.detail}</p>
                  <div className="src-job__footer">
                    {job.active != null ? (
                      <span className="src-job__poller">
                        <span
                          className={`src-job__poller-dot${job.active ? ' is-on' : ''}`}
                          aria-hidden
                        />
                        {job.active ? 'Poller active' : 'Poller idle'}
                      </span>
                    ) : (
                      <span className="src-job__poller">Scheduled / on demand</span>
                    )}
                    <span
                      className={`src-job__countdown${due ? ' is-due' : ''}${
                        job.countdownMode !== 'countdown' ? ' is-idle' : ''
                      }`}
                    >
                      {job.countdownMode === 'countdown'
                        ? due
                          ? 'Due now'
                          : `Next ${cd}`
                        : cd}
                    </span>
                  </div>
                </article>
              );
            })}
          </Stagger>
        </div>
      </FadeIn>
    </PageEnter>
  );
}
