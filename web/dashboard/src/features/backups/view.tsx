import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Check, CheckCircle2, Circle, FolderOpen, RefreshCw, Search, Settings, ShieldAlert, XCircle } from '@/ui/icons';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { FadeIn, HeroWatermark, PageEnter, useCountUp } from '@/ui/motion';
import { Button, EmptyState, ErrorState, HeroCard, StatusPill } from '@/ui/patterns';
import { WtLinearDualGauge } from '@/ui/charts';
import { asArray, asRecord, bool, fmtDate, num, str, timeAgo } from '@/lib/utils';
import './backups.css';

const ARCHIVE_CAP = 25;
/** Keep verifying chrome visible even when light-verify finishes instantly. */
const VERIFY_MIN_MS = 900;

const VERIFY_SCAN_STEPS = [
  'Opening archive…',
  'Checking world metadata…',
  'Looking for region chunks…',
] as const;

type FindingTone = 'ok' | 'warn' | 'danger' | 'neutral';

function findingMeta(code: string): { label: string; tone: FindingTone } {
  const c = code.trim();
  if (c === 'archive_ok') return { label: 'Archive opens', tone: 'ok' };
  if (c === 'has_level.dat') return { label: 'World metadata present', tone: 'ok' };
  if (c === 'has_region_mca') return { label: 'Region chunks present', tone: 'ok' };
  if (c === 'missing:level.dat') return { label: 'Missing level.dat', tone: 'warn' };
  if (c === 'missing:region_mca') return { label: 'No region/*.mca files', tone: 'warn' };
  if (c === 'truncated_or_unreadable') return { label: 'Can’t open archive', tone: 'danger' };
  if (c === 'unsupported_format') return { label: 'not checked', tone: 'neutral' };
  if (c === 'missing_path') return { label: 'Path missing', tone: 'danger' };
  if (c === 'not_a_file') return { label: 'Not a file or folder', tone: 'danger' };
  return { label: c.replace(/_/g, ' '), tone: 'neutral' };
}

type KpiTone = 'default' | 'ok' | 'warn' | 'danger' | 'info';

type ArchiveRow = {
  id: string;
  file: string;
  sizeMb: number | null;
  ageHours: number | null;
  mtime: number | null;
  path: string | null;
  newest: boolean;
  verifyStatus: string | null;
  verifyFindings: string[];
};

function verifyTone(status: string | null): 'ok' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (status === 'verified') return 'ok';
  if (status === 'suspicious' || status === 'pending') return 'warn';
  if (status === 'broken') return 'danger';
  if (status === 'not_checked') return 'neutral';
  return 'neutral';
}

function verifyLabel(status: string | null): string {
  if (status === 'verified') return 'Verified';
  if (status === 'suspicious') return 'Suspicious';
  if (status === 'broken') return 'Broken';
  if (status === 'pending') return 'Checking…';
  if (status === 'not_checked') return 'Not checked';
  return 'Not checked';
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
  const display = typeof value === 'number' && Number.isFinite(value) ? counted : value;
  return (
    <div className={`bu-kpi bu-kpi--${tone}`}>
      <span className="bu-kpi__label">{label}</span>
      <span className="bu-kpi__value">{display}</span>
      {hint ? <span className="bu-kpi__hint">{hint}</span> : null}
    </div>
  );
}

/** Fresh ≈ staleHours/4, Aging ≤ staleHours, Stale > staleHours. */
function resolveStaleHours(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 24;
  return Math.max(1, Math.min(720, n));
}

function freshnessTone(ageHours: number | null, staleHours = 24): KpiTone {
  if (ageHours == null || !Number.isFinite(ageHours)) return 'default';
  const gate = resolveStaleHours(staleHours);
  const freshGate = gate / 4;
  if (ageHours <= freshGate) return 'ok';
  if (ageHours <= gate) return 'warn';
  return 'danger';
}

function freshnessLabel(ageHours: number | null, staleHours = 24): string {
  if (ageHours == null || !Number.isFinite(ageHours)) return 'Unknown';
  const gate = resolveStaleHours(staleHours);
  const freshGate = gate / 4;
  if (ageHours <= freshGate) return 'Fresh';
  if (ageHours <= gate) return 'Aging';
  return 'Stale';
}

function freshnessPctForAge(ageHours: number | null, staleHours = 24): number | null {
  if (ageHours == null || !Number.isFinite(ageHours)) return null;
  const gate = resolveStaleHours(staleHours);
  return Math.max(0, Math.min(100, Math.round(100 - (ageHours / gate) * 100)));
}

function formatSizeMb(mb: number | null): string {
  if (mb == null || !Number.isFinite(mb) || mb <= 0) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function formatAge(ageHours: number | null): string {
  if (ageHours == null || !Number.isFinite(ageHours)) return '—';
  if (ageHours < 1) return `${Math.round(ageHours * 60)}m`;
  if (ageHours < 48) return `${ageHours.toFixed(1)}h`;
  return `${(ageHours / 24).toFixed(1)}d`;
}

function freshnessGaugeTone(pct: number | null): 'ok' | 'warn' | 'danger' | 'accent' {
  if (pct == null || !Number.isFinite(pct)) return 'accent';
  if (pct >= 75) return 'ok';
  if (pct >= 25) return 'warn';
  return 'danger';
}

function normalizeArchive(raw: unknown, newestFile: string | null): ArchiveRow | null {
  const f = asRecord(raw);
  const file = str(f.file || f.filename).trim();
  if (!file) return null;

  let sizeMb: number | null = f.size_mb != null ? num(f.size_mb) : null;
  if (sizeMb == null && f.size_gb != null) sizeMb = num(f.size_gb) * 1024;

  let ageHours: number | null = f.age_hours != null ? num(f.age_hours) : null;
  if (ageHours == null && f.age_days != null) ageHours = num(f.age_days) * 24;

  let mtime: number | null = f.mtime != null ? num(f.mtime) : null;
  if (mtime == null && f.time) {
    const ms = Date.parse(str(f.time));
    if (!Number.isNaN(ms)) mtime = ms / 1000;
  }
  if (ageHours == null && mtime != null) {
    ageHours = (Date.now() / 1000 - mtime) / 3600;
  }

  const path = str(f.path).trim() || null;
  const verify = asRecord(f.verify);
  const verifyStatus = str(verify.status).trim() || null;
  const verifyFindings = asArray(verify.findings).map((x) => String(x));
  return {
    id: path ? `${path}::${file}` : file,
    file,
    sizeMb,
    ageHours,
    mtime,
    path,
    newest: !!newestFile && file === newestFile,
    verifyStatus,
    verifyFindings,
  };
}

function Panel({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bu-panel${className ? ` ${className}` : ''}`}>
      <header className="bu-panel__head">
        <div>
          <h3>{title}</h3>
          {hint ? <p>{hint}</p> : null}
        </div>
        {action}
      </header>
      <div className="bu-panel__body">{children}</div>
    </div>
  );
}

export function PageView({ route: _route }: { route: RouteState }) {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite();
  const opsQ = useQuery({ queryKey: ['ops-cache'], queryFn: api.opsCache, refetchInterval: 15_000 });
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });
  const restoreStatusQ = useQuery({
    queryKey: ['backup-test-restore'],
    queryFn: api.backupsTestRestoreStatus,
    refetchInterval: (q) => {
      const job = asRecord(asRecord(q.state.data).job);
      return str(job.status) === 'running' ? 1500 : false;
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => api.backupsScan(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ops-cache'] });
      void queryClient.invalidateQueries({ queryKey: ['overview-meta'] });
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (path: string) => api.backupsVerify(path),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ops-cache'] });
      void queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (path: string) => api.backupsTestRestore(path),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backup-test-restore'] });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: (id?: string) => api.backupsTestRestoreCleanup(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backup-test-restore'] });
    },
  });

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAllArchives, setShowAllArchives] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [verifyingPath, setVerifyingPath] = useState<string | null>(null);
  const [verifyStep, setVerifyStep] = useState(0);

  useEffect(() => {
    if (!verifyingPath) {
      setVerifyStep(0);
      return;
    }
    setVerifyStep(0);
    const timers = [
      window.setTimeout(() => setVerifyStep(1), 280),
      window.setTimeout(() => setVerifyStep(2), 560),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [verifyingPath]);

  const ops = asRecord(opsQ.data);
  const settings = asRecord(settingsQ.data ?? {});
  const facts = asRecord(factsQ.data);
  const optional = asRecord(facts.optional);
  const backupsLive = asRecord(ops.backups_live);
  const lastBackup = asRecord(backupsLive.last_backup);
  const inventory = asRecord(backupsLive.inventory_summary);

  const dirs = useMemo(() => {
    const fromList = str(settings.backup_dirs)
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    const primary = str(settings.backup_dir).trim();
    if (primary && !fromList.includes(primary)) fromList.unshift(primary);
    return { primary, dirs: fromList };
  }, [settings.backup_dirs, settings.backup_dir]);

  const newestFile = str(lastBackup.file || lastBackup.filename).trim() || null;

  const archives = useMemo(() => {
    const liveList = asArray(backupsLive.inventory);
    const liveSummaryList = Array.isArray(backupsLive.inventory_summary)
      ? (backupsLive.inventory_summary as unknown[])
      : [];
    const factsList = asArray(optional.backup_inventory).length
      ? asArray(optional.backup_inventory)
      : asArray(optional.backups);
    const raw = liveList.length ? liveList : liveSummaryList.length ? liveSummaryList : factsList;

    const rows = raw
      .map((row) => normalizeArchive(row, newestFile))
      .filter((row): row is ArchiveRow => !!row);

    // Ensure newest live signal appears even if inventory is thin/stale.
    if (newestFile && !rows.some((r) => r.file === newestFile)) {
      rows.unshift(
        normalizeArchive(
          {
            file: newestFile,
            size_mb: lastBackup.size_mb,
            age_hours: lastBackup.age_hours,
            mtime: lastBackup.mtime,
            path: lastBackup.path || lastBackup.dir,
          },
          newestFile,
        )!,
      );
    }

    return rows.sort((a, b) => {
      const ah = a.ageHours ?? Number.POSITIVE_INFINITY;
      const bh = b.ageHours ?? Number.POSITIVE_INFINITY;
      if (ah !== bh) return ah - bh;
      return a.file.localeCompare(b.file);
    });
  }, [backupsLive, optional, newestFile, lastBackup]);

  const displayVerifyStatus = (row: ArchiveRow): string | null =>
    verifyingPath && row.path === verifyingPath ? 'pending' : row.verifyStatus;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return archives;
    return archives.filter(
      (a) => a.file.toLowerCase().includes(q) || (a.path ?? '').toLowerCase().includes(q),
    );
  }, [archives, search]);

  const visibleArchives = useMemo(
    () => (showAllArchives ? filtered : filtered.slice(0, ARCHIVE_CAP)),
    [filtered, showAllArchives],
  );
  const archivesTruncated = !showAllArchives && filtered.length > ARCHIVE_CAP;

  useEffect(() => {
    setShowAllArchives(false);
  }, [search]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && filtered.some((a) => a.id === selectedId)) return;
    const prefer = filtered.find((a) => a.newest) ?? filtered[0];
    setSelectedId(prefer.id);
  }, [filtered, selectedId]);

  if (opsQ.isLoading || settingsQ.isLoading) {
    return (
      <PageEnter className="bu-stack">
        <div className="h-44 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-72 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
          <div className="h-56 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        </div>
      </PageEnter>
    );
  }
  if (opsQ.isError) {
    return (
      <ErrorState title="Couldn't load backup status">{(opsQ.error as Error)?.message}</ErrorState>
    );
  }

  const staleHours = resolveStaleHours(settings.backup_stale_hours);
  const ageHours = lastBackup.age_hours != null ? num(lastBackup.age_hours) : null;
  const freshnessPct = freshnessPctForAge(ageHours, staleHours);
  const tone = freshnessTone(ageHours, staleHours);
  const heroTone = tone === 'default' ? 'info' : tone;

  const lastIso =
    ageHours != null
      ? new Date(Date.now() - ageHours * 3_600_000).toISOString()
      : lastBackup.mtime
        ? new Date(num(lastBackup.mtime) * 1000).toISOString()
        : null;
  const lastAgo = lastIso ? timeAgo(lastIso) : '—';
  const lastWhen = lastIso ? fmtDate(lastIso) : '—';
  const totalGb = inventory.total_gb != null ? num(inventory.total_gb) : null;
  const fileCount =
    inventory.file_count != null
      ? num(inventory.file_count)
      : archives.length
        ? archives.length
        : null;
  const scannedAt = backupsLive.scanned_at ? timeAgo(str(backupsLive.scanned_at)) : null;
  const trackingOn = bool(settings.backup_tracking_enabled);
  const trackingMode = str(settings.backup_tracking_mode, 'local');

  const selected = filtered.find((a) => a.id === selectedId) ?? null;
  const isVerifyingSelected = !!verifyingPath && !!selected?.path && selected.path === verifyingPath;
  const selectedVerifyStatus = selected
    ? displayVerifyStatus(selected)
    : null;
  const selectedTone = freshnessTone(selected?.ageHours ?? null, staleHours);
  const selectedFreshness = freshnessPctForAge(selected?.ageHours ?? null, staleHours);
  const selectedIso =
    selected?.mtime != null
      ? new Date(selected.mtime * 1000).toISOString()
      : selected?.ageHours != null
        ? new Date(Date.now() - selected.ageHours * 3_600_000).toISOString()
        : null;
  const maxSizeMb = Math.max(...archives.map((a) => a.sizeMb ?? 0), 1);
  const selectedSizePct =
    selected?.sizeMb != null ? Math.min(100, Math.round((selected.sizeMb / maxSizeMb) * 100)) : 0;

  const steps = [
    {
      id: 'tracking',
      label: 'Local tracking enabled',
      done: trackingOn,
      hint: 'Turn on tracking so Watchtower can spot fresh archives.',
    },
    {
      id: 'dir',
      label: 'Backup directory configured',
      done: !!str(settings.backup_dir) || dirs.dirs.length > 0,
      hint: 'Point Watchtower at the folder where zip archives land.',
    },
    {
      id: 'external',
      label: 'External storage configured',
      done: bool(settings.backup_external_configured),
      hint: 'Mark offsite / NAS copies so freshness isn’t judged on local alone.',
    },
    {
      id: 'webhook',
      label: 'Webhook notifications',
      done: bool(settings.backup_webhook_enabled),
      hint: 'Get pinged when a backup job finishes or fails.',
    },
    {
      id: 'suppress',
      label: 'Suppress local-missing warnings',
      done: bool(settings.backup_suppress_local_missing),
      hint: 'Only if backups live entirely off-box and local gaps are expected.',
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done) ?? null;
  const hasBackupSignal = !!(newestFile || fileCount || totalGb != null || archives.length);
  const openSettings = () => navigate({ tab: 'settings', panel: 'backups' });

  return (
    <PageEnter className="bu-stack">
      <FadeIn>
        <HeroCard
          tone={heroTone === 'ok' || heroTone === 'warn' || heroTone === 'danger' || heroTone === 'info' ? heroTone : 'info'}
          className={`bu-hero bu-hero--${heroTone}`}
        >
          <div className="bu-hero__body wt-hero-shell">
            <HeroWatermark icon={Archive} tone={tone === 'default' ? 'info' : tone} />
            <div className="bu-hero__main">
              <div className="bu-hero__title">
                <h2>Backup health</h2>
                <StatusPill tone={heroTone === 'info' ? 'neutral' : heroTone}>
                  {hasBackupSignal ? freshnessLabel(ageHours, staleHours) : 'Waiting'}
                </StatusPill>
              </div>
              <p className="bu-hero__hint">
                {hasBackupSignal
                  ? 'Browse tracked archives, check freshness, and finish setup for offsite + alerts.'
                  : 'Ops cache will fill this once backup tracking scans your configured directories.'}
              </p>
              <div className="bu-hero__actions">
                <Button
                  disabled={scanMutation.isPending}
                  onClick={() => scanMutation.mutate()}
                >
                  {scanMutation.isPending ? 'Scanning…' : 'Scan now'}
                </Button>
                <Button kind="primary" onClick={openSettings}>
                  <Settings size={14} />
                  Open backup settings
                </Button>
              </div>
            </div>

            <div className="bu-kpis" aria-label="Backup vitals">
              <Kpi
                label="Freshness"
                value={freshnessPct != null ? `${freshnessPct}%` : '—'}
                hint={lastAgo !== '—' ? lastAgo : 'No age signal'}
                tone={tone}
              />
              <Kpi
                label="Last backup"
                value={lastAgo}
                hint={lastWhen !== '—' ? lastWhen : null}
                tone={tone === 'ok' ? 'ok' : tone === 'danger' ? 'danger' : 'default'}
              />
              <Kpi
                label="Archives"
                value={fileCount != null ? fileCount : '—'}
                hint={
                  archives.length
                    ? `${archives.length} listed${fileCount != null && fileCount > archives.length ? ` of ${fileCount}` : ''}`
                    : null
                }
                tone="info"
              />
              <Kpi
                label="Total size"
                value={totalGb != null ? `${totalGb.toFixed(1)} GB` : '—'}
                hint={scannedAt ? `Scanned ${scannedAt}` : null}
                tone="default"
              />
            </div>
          </div>
        </HeroCard>
      </FadeIn>

      <FadeIn className="bu-archives-wrap">
        <Panel
          title="Archives"
          hint="All tracked backup zips — select one for details"
          className="bu-panel--archives"
          action={
            archives.length ? (
              <StatusPill tone="info">
                {filtered.length === archives.length
                  ? `${archives.length} files`
                  : `${filtered.length} / ${archives.length}`}
              </StatusPill>
            ) : null
          }
        >
          {archives.length ? (
            <div className="bu-viewer">
              <div className="bu-viewer__list">
                <label className="bu-search">
                  <Search size={14} aria-hidden />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search archives…"
                    aria-label="Search archives"
                  />
                </label>

                {filtered.length ? (
                  <div className="bu-catalog" role="listbox" aria-label="Backup archives">
                    {visibleArchives.map((row) => {
                      const active = row.id === selectedId;
                      const rowTone = freshnessTone(row.ageHours, staleHours);
                      return (
                        <button
                          key={row.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`bu-catalog__row${active ? ' is-selected' : ''} bu-catalog__row--${rowTone}`}
                          onClick={() => setSelectedId(row.id)}
                        >
                          <span className="bu-catalog__icon" aria-hidden>
                            <Archive size={15} />
                          </span>
                          <span className="bu-catalog__main">
                            <span className="bu-catalog__name">{row.file}</span>
                            <span className="bu-catalog__meta">
                              {[formatAge(row.ageHours), formatSizeMb(row.sizeMb)]
                                .filter((v) => v !== '—')
                                .join(' · ') || '—'}
                            </span>
                          </span>
                          <span className="bu-catalog__badges">
                            {row.newest ? <StatusPill tone="ok">Newest</StatusPill> : null}
                            <StatusPill tone={verifyTone(displayVerifyStatus(row))}>
                              {verifyLabel(displayVerifyStatus(row))}
                            </StatusPill>
                            <StatusPill
                              tone={
                                rowTone === 'default'
                                  ? 'neutral'
                                  : (rowTone as 'ok' | 'warn' | 'danger')
                              }
                            >
                              {freshnessLabel(row.ageHours, staleHours)}
                            </StatusPill>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bu-viewer__empty">
                    <EmptyState title="No matching archives">
                      Try another search — {archives.length} archive
                      {archives.length === 1 ? '' : 's'} still available.
                    </EmptyState>
                  </div>
                )}
                {archivesTruncated ? (
                  <Button
                    kind="ghost"
                    className="bu-show-more"
                    onClick={() => setShowAllArchives(true)}
                  >
                    Show more ({filtered.length - ARCHIVE_CAP} more)
                  </Button>
                ) : null}
              </div>

              <div className="bu-viewer__detail">
                {selected ? (
                  <>
                    <div className={`bu-detail__file bu-detail__file--${selectedTone}`}>
                      <div className="bu-detail__file-top">
                        <div className="bu-detail__file-name">{selected.file}</div>
                        <div className="bu-detail__file-pills">
                          <StatusPill
                            tone={
                              selectedTone === 'default'
                                ? 'neutral'
                                : (selectedTone as 'ok' | 'warn' | 'danger')
                            }
                          >
                            {freshnessLabel(selected.ageHours, staleHours)}
                          </StatusPill>
                          <StatusPill tone={verifyTone(selectedVerifyStatus)}>
                            {verifyLabel(selectedVerifyStatus)}
                          </StatusPill>
                          <StatusPill tone={selected.newest ? 'ok' : 'neutral'}>
                            {selected.newest
                              ? 'Newest'
                              : `#${filtered.findIndex((a) => a.id === selected.id) + 1}`}
                          </StatusPill>
                        </div>
                      </div>
                      <div className="bu-detail__file-meta">
                        {[
                          formatAge(selected.ageHours),
                          selectedIso ? fmtDate(selectedIso) : null,
                          formatSizeMb(selected.sizeMb),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {selected.path ? (
                        <div className="bu-detail__path" title={selected.path}>
                          {selected.path}
                        </div>
                      ) : null}
                    </div>

                    <div className={`bu-detail__fresh bu-detail__fresh--${selectedTone}`}>
                      <div className="bu-detail__fresh-row">
                        <span>Freshness</span>
                        <strong>
                          {selectedFreshness != null ? `${selectedFreshness}%` : 'No age signal'}
                        </strong>
                      </div>
                      <div className="bu-detail__fresh-gauge" aria-label="Backup freshness">
                        <WtLinearDualGauge
                          value={selectedFreshness ?? 0}
                          label="Freshness"
                          tone={freshnessGaugeTone(selectedFreshness)}
                          showLabel={false}
                        />
                      </div>
                    </div>

                    <div className="bu-detail__stats">
                      <div className="bu-detail__stat">
                        <span>Size</span>
                        <strong>{formatSizeMb(selected.sizeMb)}</strong>
                      </div>
                      <div className="bu-detail__stat">
                        <span>Age</span>
                        <strong>{formatAge(selected.ageHours)}</strong>
                      </div>
                      <div className="bu-detail__stat">
                        <span>Status</span>
                        <strong>{freshnessLabel(selected.ageHours, staleHours)}</strong>
                      </div>
                      <div className="bu-detail__stat">
                        <span>Integrity</span>
                        <strong>
                          <StatusPill tone={verifyTone(selectedVerifyStatus)}>
                            {verifyLabel(selectedVerifyStatus)}
                          </StatusPill>
                        </strong>
                      </div>
                    </div>

                    <div className="bu-detail__checks">
                      <div className="bu-detail__checks-label">Integrity checks</div>
                      {isVerifyingSelected ? (
                        <div className="bu-verify-progress" role="status" aria-live="polite">
                          <div className="bu-verify-progress__head">
                            <RefreshCw size={14} className="bu-verify-progress__spin" aria-hidden />
                            <span>
                              {VERIFY_SCAN_STEPS[Math.min(verifyStep, VERIFY_SCAN_STEPS.length - 1)]}
                            </span>
                          </div>
                          <div className="bu-verify-progress__bar" aria-hidden>
                            <span />
                          </div>
                          <ul className="bu-verify-findings bu-verify-findings--scanning">
                            {VERIFY_SCAN_STEPS.map((step, i) => {
                              const done = i < verifyStep;
                              const active = i === verifyStep;
                              return (
                                <li
                                  key={step}
                                  className={`bu-verify-finding${done ? ' bu-verify-finding--ok' : active ? ' bu-verify-finding--active' : ''}`}
                                >
                                  <span className="bu-verify-finding__icon" aria-hidden>
                                    {done ? (
                                      <Check size={13} />
                                    ) : active ? (
                                      <RefreshCw size={13} className="bu-verify-progress__spin" />
                                    ) : (
                                      <Circle size={13} />
                                    )}
                                  </span>
                                  <span className="bu-verify-finding__label">{step}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : selected.verifyFindings.length ? (
                        <ul className="bu-verify-findings" aria-label="Integrity checks">
                          {selected.verifyFindings.map((code) => {
                            const meta = findingMeta(code);
                            return (
                              <li
                                key={code}
                                className={`bu-verify-finding bu-verify-finding--${meta.tone}`}
                              >
                                <span className="bu-verify-finding__icon" aria-hidden>
                                  {meta.tone === 'ok' ? (
                                    <CheckCircle2 size={14} />
                                  ) : meta.tone === 'danger' ? (
                                    <XCircle size={14} />
                                  ) : meta.tone === 'warn' ? (
                                    <ShieldAlert size={14} />
                                  ) : (
                                    <Circle size={14} />
                                  )}
                                </span>
                                <span className="bu-verify-finding__label">{meta.label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="bu-detail__checks-empty">
                          No light-verify results yet — run Verify now.
                        </p>
                      )}
                    </div>

                    {actionError ? <p className="bu-action-error">{actionError}</p> : null}

                    <div className="bu-detail__footer">
                      <div className="bu-verify-actions">
                        <Button
                          kind="default"
                          disabled={!canWrite || !selected.path || !!verifyingPath}
                          title={canWrite ? undefined : VIEW_ONLY_TITLE}
                          onClick={() => {
                            if (!selected.path) return;
                            const path = selected.path;
                            setActionError(null);
                            setVerifyingPath(path);
                            const started = Date.now();
                            verifyMutation.mutate(path, {
                              onError: (e: Error) => setActionError(e.message || 'Verify failed'),
                              onSettled: () => {
                                const remain = Math.max(0, VERIFY_MIN_MS - (Date.now() - started));
                                window.setTimeout(() => setVerifyingPath(null), remain);
                              },
                            });
                          }}
                        >
                          {isVerifyingSelected ? 'Verifying…' : 'Verify now'}
                        </Button>
                        <Button
                          kind="default"
                          disabled={
                            !canWrite || !selected.path || restoreMutation.isPending || !!verifyingPath
                          }
                          title={canWrite ? undefined : VIEW_ONLY_TITLE}
                          onClick={() => {
                            if (!selected.path) return;
                            setActionError(null);
                            restoreMutation.mutate(selected.path, {
                              onError: (e: Error) =>
                                setActionError(e.message || 'Test restore failed'),
                            });
                          }}
                        >
                          {restoreMutation.isPending ? 'Starting…' : 'Test restore'}
                        </Button>
                        {(() => {
                          const job = asRecord(asRecord(restoreStatusQ.data).job);
                          const jobId = str(job.id);
                          const jobStatus = str(job.status);
                          if (!jobId && !jobStatus) return null;
                          return (
                            <>
                              <StatusPill
                                tone={
                                  jobStatus === 'ok'
                                    ? 'ok'
                                    : jobStatus === 'error'
                                      ? 'danger'
                                      : 'info'
                                }
                              >
                                Restore: {jobStatus || '—'}
                                {job.progress_pct != null ? ` ${num(job.progress_pct)}%` : ''}
                              </StatusPill>
                              {jobId ? (
                                <Button
                                  kind="ghost"
                                  disabled={!canWrite || cleanupMutation.isPending}
                                  title={canWrite ? undefined : VIEW_ONLY_TITLE}
                                  onClick={() => cleanupMutation.mutate(jobId)}
                                >
                                  Cleanup
                                </Button>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>

                      {selected.sizeMb != null ? (
                        <div className="bu-footprint">
                          <div className="bu-footprint__row">
                            <span>Size vs largest tracked archive</span>
                            <strong>
                              {formatSizeMb(selected.sizeMb)} / {formatSizeMb(maxSizeMb)}
                            </strong>
                          </div>
                          <div
                            className="bu-footprint__bar"
                            role="meter"
                            aria-valuenow={selected.sizeMb}
                            aria-valuemin={0}
                            aria-valuemax={maxSizeMb}
                            aria-label="Archive size relative to largest"
                          >
                            <span style={{ width: `${selectedSizePct}%` }} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="bu-viewer__empty">
                    <EmptyState title="Select an archive">
                      Pick a zip from the list to inspect size, age, and freshness.
                    </EmptyState>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bu-empty">
              <EmptyState title="No archives listed yet">
                Configure a backup directory and enable tracking — Watchtower will list every zip it
                finds here.
              </EmptyState>
              <Button kind="default" onClick={openSettings}>
                Configure backups
              </Button>
            </div>
          )}
        </Panel>
      </FadeIn>

      <FadeIn>
        <div className="bu-grid">
          <Panel
            className="bu-panel--checklist"
            title="Setup checklist"
            hint="Recommended tracking & notification setup"
            action={
              <StatusPill
                tone={doneCount === steps.length ? 'ok' : doneCount === 0 ? 'neutral' : 'info'}
              >
                {doneCount}/{steps.length} complete
              </StatusPill>
            }
          >
            <ol className="bu-checklist">
              {steps.map((s, i) => {
                const isNext = nextStep?.id === s.id;
                return (
                  <li
                    key={s.id}
                    className={`bu-check${s.done ? ' bu-check--done' : ''}${
                      isNext ? ' bu-check--next' : !s.done ? ' bu-check--todo' : ''
                    }`}
                    aria-current={isNext ? 'step' : undefined}
                  >
                    <span className="bu-check__mark" aria-hidden>
                      {s.done ? <Check size={12} strokeWidth={2.5} /> : null}
                    </span>
                    <div className="bu-check__copy">
                      <span className="bu-check__index">{String(i + 1).padStart(2, '0')}</span>
                      <span className="bu-check__label">{s.label}</span>
                    </div>
                  </li>
                );
              })}
            </ol>

            {nextStep ? (
              <div className="bu-next">
                <div className="bu-next__copy">
                  <div className="bu-next__top">Next up</div>
                  <p className="bu-next__text">{nextStep.hint}</p>
                </div>
                <div className="bu-next__actions">
                  <Button kind="primary" onClick={openSettings}>
                    <Settings size={14} />
                    Fix in Settings
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bu-next bu-next--ok">
                <div className="bu-next__copy">
                  <div className="bu-next__top">All set</div>
                  <p className="bu-next__text">Backup tracking checklist is complete.</p>
                </div>
              </div>
            )}
          </Panel>

          <div className="bu-panel">
            <div className="bu-storage">
              <div className="bu-storage__head">
                <div>
                  <h3>Storage locations</h3>
                  <p>Directories Watchtower scans for backup archives</p>
                </div>
                <div className="bu-storage__head-actions">
                  <StatusPill tone={trackingOn ? 'ok' : 'warn'}>
                    {trackingOn ? `Tracking · ${trackingMode}` : 'Tracking off'}
                  </StatusPill>
                  <Button kind="ghost" onClick={openSettings}>
                    Edit paths
                  </Button>
                </div>
              </div>

              {dirs.dirs.length ? (
                <>
                  <div className="bu-storage__summary">
                    <span>
                      <strong>{dirs.dirs.length}</strong> path{dirs.dirs.length === 1 ? '' : 's'}
                    </span>
                    <span>
                      External{' '}
                      <strong>
                        {bool(settings.backup_external_configured) ? 'configured' : 'not set'}
                      </strong>
                    </span>
                    {scannedAt ? (
                      <span>
                        Last scan <strong>{scannedAt}</strong>
                      </span>
                    ) : null}
                  </div>
                  <div className="bu-storage__list bu-storage__list--stack">
                    {dirs.dirs.map((dir) => (
                      <div key={dir} className="bu-storage__row">
                        <span className="bu-storage__icon" aria-hidden>
                          <FolderOpen size={16} />
                        </span>
                        <span className="bu-storage__path" title={dir}>
                          {dir}
                        </span>
                        <span
                          className={`bu-storage__tag${
                            dirs.primary && dir === dirs.primary ? ' bu-storage__tag--primary' : ''
                          }`}
                        >
                          {dirs.primary && dir === dirs.primary ? 'Primary' : 'Tracked'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="bu-empty">
                  <EmptyState title="No directories configured">
                    Add one or more backup folders in Settings so freshness and inventory can
                    populate.
                  </EmptyState>
                  <Button kind="default" onClick={openSettings}>
                    Add directories
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeIn>
    </PageEnter>
  );
}
