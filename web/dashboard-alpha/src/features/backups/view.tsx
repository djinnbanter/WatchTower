import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Check, Circle, FolderOpen, Search, Settings } from '@/ui/icons';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { FadeIn, GlareIcon, PageEnter, useCountUp } from '@/ui/motion';
import { Button, EmptyState, ErrorState, StatusPill } from '@/ui/patterns';
import { WtRing } from '@/ui/charts';
import { asArray, asRecord, bool, fmtDate, num, str, timeAgo } from '@/lib/utils';
import './backups.css';

const ARCHIVE_CAP = 25;

type KpiTone = 'default' | 'ok' | 'warn' | 'danger' | 'info';

type ArchiveRow = {
  id: string;
  file: string;
  sizeMb: number | null;
  ageHours: number | null;
  mtime: number | null;
  path: string | null;
  newest: boolean;
};

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

function freshnessTone(ageHours: number | null): KpiTone {
  if (ageHours == null || !Number.isFinite(ageHours)) return 'default';
  if (ageHours <= 6) return 'ok';
  if (ageHours <= 24) return 'warn';
  return 'danger';
}

function freshnessLabel(ageHours: number | null): string {
  if (ageHours == null || !Number.isFinite(ageHours)) return 'Unknown';
  if (ageHours <= 6) return 'Fresh';
  if (ageHours <= 24) return 'Aging';
  return 'Stale';
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

function ringColor(tone: KpiTone): string {
  if (tone === 'ok') return 'var(--wt-ok)';
  if (tone === 'warn') return 'var(--wt-warn)';
  if (tone === 'danger') return 'var(--wt-danger)';
  return 'var(--wt-accent)';
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
  return {
    id: path ? `${path}::${file}` : file,
    file,
    sizeMb,
    ageHours,
    mtime,
    path,
    newest: !!newestFile && file === newestFile,
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
  const opsQ = useQuery({ queryKey: ['ops-cache'], queryFn: api.opsCache, refetchInterval: 15_000 });
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAllArchives, setShowAllArchives] = useState(false);

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

  const ageHours = lastBackup.age_hours != null ? num(lastBackup.age_hours) : null;
  const freshnessPct =
    ageHours != null && Number.isFinite(ageHours)
      ? Math.max(0, Math.min(100, Math.round(100 - (ageHours / 24) * 100)))
      : null;
  const tone = freshnessTone(ageHours);
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
  const selectedTone = freshnessTone(selected?.ageHours ?? null);
  const selectedFreshness =
    selected?.ageHours != null && Number.isFinite(selected.ageHours)
      ? Math.max(0, Math.min(100, Math.round(100 - (selected.ageHours / 24) * 100)))
      : null;
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
        <div className={`bu-hero bu-hero--${heroTone}`}>
          <div className="bu-hero__body">
            <div className="bu-hero__main">
              <div className="bu-hero__title">
                <GlareIcon
                  icon={Archive}
                  tone={tone === 'default' ? 'info' : tone}
                  size={16}
                  className="h-8 w-8 rounded-lg"
                />
                <h2>Backup health</h2>
                <StatusPill tone={heroTone === 'info' ? 'neutral' : heroTone}>
                  {hasBackupSignal ? freshnessLabel(ageHours) : 'Waiting'}
                </StatusPill>
              </div>
              <p className="bu-hero__hint">
                {hasBackupSignal
                  ? 'Browse tracked archives, check freshness, and finish setup for offsite + alerts.'
                  : 'Ops cache will fill this once backup tracking scans your configured directories.'}
              </p>
              <div className="bu-hero__actions">
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
        </div>
      </FadeIn>

      <FadeIn>
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
                      const rowTone = freshnessTone(row.ageHours);
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
                            <StatusPill
                              tone={
                                rowTone === 'default'
                                  ? 'neutral'
                                  : (rowTone as 'ok' | 'warn' | 'danger')
                              }
                            >
                              {freshnessLabel(row.ageHours)}
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
                      <div className="bu-detail__file-name">{selected.file}</div>
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

                    <div className="bu-detail__viz">
                      {selectedFreshness != null ? (
                        <WtRing
                          value={selectedFreshness}
                          label="Freshness"
                          color={ringColor(selectedTone)}
                          className="bu-detail__ring"
                        />
                      ) : (
                        <p className="bu-muted">No age signal for this file.</p>
                      )}

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
                          <strong>{freshnessLabel(selected.ageHours)}</strong>
                        </div>
                        <div className="bu-detail__stat">
                          <span>Rank</span>
                          <strong>
                            {selected.newest
                              ? 'Newest'
                              : `#${filtered.findIndex((a) => a.id === selected.id) + 1}`}
                          </strong>
                        </div>
                      </div>
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
            title="Setup checklist"
            hint="Recommended tracking & notification setup"
            action={
              <StatusPill tone={doneCount === steps.length ? 'ok' : 'warn'}>
                {doneCount}/{steps.length} complete
              </StatusPill>
            }
          >
            <ol className="bu-checklist">
              {steps.map((s) => (
                <li
                  key={s.id}
                  className={`bu-check${s.done ? ' bu-check--done' : ' bu-check--todo'}${
                    nextStep?.id === s.id ? ' bu-check--next' : ''
                  }`}
                >
                  <span className="bu-check__mark" aria-hidden>
                    {s.done ? <Check size={13} /> : <Circle size={13} />}
                  </span>
                  <div className="bu-check__copy">
                    <span className="bu-check__label">{s.label}</span>
                    {!s.done && nextStep?.id === s.id ? (
                      <span className="bu-check__hint">{s.hint}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            {nextStep ? (
              <div className="bu-next">
                <div className="bu-next__top">Do this next</div>
                <p className="bu-next__fix">{nextStep.hint}</p>
                <div className="bu-next__actions">
                  <Button kind="default" onClick={openSettings}>
                    <Settings size={14} />
                    Fix in Settings
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bu-next bu-next--ok">
                <div className="bu-next__top">All set</div>
                <p className="bu-next__text">Backup tracking checklist is complete.</p>
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
