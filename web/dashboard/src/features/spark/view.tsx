import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { ChevronRight, ExternalLink, FileText, HardDriveDownload, RefreshCw, Send, Zap } from '@/ui/icons';
import { FadeIn, HeroWatermark, PageEnter } from '@/ui/motion';
import { Button, EmptyState, ErrorState, HeroCard, HeroTabNav, StatusPill } from '@/ui/patterns';
import { fmtDate } from '@/lib/utils';
import {
  gradeGlowTone,
  numeric,
  profileSummaries,
  record,
  text,
  unwrapProfile,
  type SparkSummary,
} from './model';
import {
  CallPathsView,
  CompareView,
  FindingsView,
  OverviewView,
  SourcesView,
  TechnicalView,
  TimelineView,
  WorldView,
} from './tabs';
import { MapView } from './map-view';

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'findings', label: 'Findings' },
  { id: 'world', label: 'World' },
  { id: 'map', label: 'Map' },
  { id: 'sources', label: 'Sources' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'calls', label: 'Call paths' },
  { id: 'technical', label: 'Technical' },
  { id: 'compare', label: 'Compare' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

function gradePillTone(grade: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  const glow = gradeGlowTone(grade);
  if (glow === 'danger') return 'danger';
  if (glow === 'warn') return 'warn';
  if (glow === 'ok') return 'ok';
  return 'neutral';
}

function normalizedView(value: string | undefined): ViewId {
  return VIEWS.some((view) => view.id === value) ? (value as ViewId) : 'overview';
}

function routeProfile(route: RouteState): string {
  const withParams = route as RouteState & { params?: { profile?: string } };
  return withParams.params?.profile || route.profile || '';
}

function shortProfileLabel(fileName: string): string {
  const base = fileName.replace(/\.sparkprofile$/i, '');
  const stamped = /^(.*?)(?:_profile)?-?(\d{4}-\d{2}-\d{2})[_-](\d{2}[.:]\d{2}[.:]\d{2})$/.exec(base);
  if (stamped) {
    const prefix = stamped[1]?.replace(/[_-]+$/g, '') || 'profile';
    return `${prefix} · ${stamped[3]?.replaceAll(':', '.')}`;
  }
  if (base.length <= 44) return base;
  return `${base.slice(0, 22)}…${base.slice(-16)}`;
}

function WorkflowBar({
  onImport,
  onUpload,
}: {
  onImport: (url: string) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      await onImport(url.trim());
      setUrl('');
      setMessage('Imported');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      await onUpload(file);
      setMessage('Uploaded');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sp-workflow" aria-label="Spark profile workflow">
      <form onSubmit={(event) => void submit(event)}>
        <Send size={14} />
        <input
          value={url}
          type="url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste spark.lucko.me profile URL"
          aria-label="Spark profile URL"
        />
        <Button kind="primary" disabled={busy || !url.trim()}>Import</Button>
      </form>
      <label className="sp-file-button">
        <HardDriveDownload size={14} /> Upload file
        <input
          type="file"
          accept=".sparkprofile,application/octet-stream"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </label>
      {message ? <span className="sp-workflow__message" role="status">{message}</span> : null}
    </div>
  );
}

function ProfileRow({
  item,
  selected,
  onSelect,
}: {
  item: SparkSummary;
  selected: boolean;
  onSelect: (path: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`sp-profile-row${selected ? ' is-selected' : ''}${item.autoCaptured ? ' is-auto' : ''}`}
      onClick={() => onSelect(item.sourcePath)}
    >
      <span className={`sp-profile-row__icon${item.autoCaptured ? '' : ' is-muted'}`} aria-hidden>
        {item.autoCaptured ? <Zap size={14} /> : <FileText size={14} />}
      </span>
      <span className="sp-profile-row__body">
        <span className="sp-profile-row__name" title={item.sourceFile}>{shortProfileLabel(item.sourceFile)}</span>
        <span className="sp-profile-row__meta">
          {[
            item.capturedAt ? fmtDate(item.capturedAt) : null,
            item.sourceKind ? item.sourceKind.replaceAll('_', ' ') : null,
            item.fresh ? null : 'Stale',
          ].filter(Boolean).join(' · ') || 'Ready profile'}
        </span>
      </span>
      {item.autoCaptured ? <span className="sp-profile-row__badge">Auto</span> : null}
    </button>
  );
}

function ProfilePicker({
  profiles,
  selectedPath,
  onSelect,
}: {
  profiles: SparkSummary[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = profiles.find((item) => item.sourcePath === selectedPath) ?? profiles[0];
  const automatic = profiles.filter((item) => item.autoCaptured);
  const manual = profiles.filter((item) => !item.autoCaptured);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (path: string) => {
    onSelect(path);
    setOpen(false);
  };

  return (
    <div className={`sp-profile-picker${open ? ' is-open' : ''}`} ref={rootRef}>
      <div className="sp-profile-picker__head">
        <span className="sp-profile-picker__label">Profile</span>
        <span className="sp-profile-picker__count">{profiles.length}</span>
      </div>
      <button
        type="button"
        className="sp-profile-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select Spark profile"
        onClick={() => setOpen((value) => !value)}
      >
        {selected ? (
          <>
            <span className={`sp-profile-row__icon${selected.autoCaptured ? '' : ' is-muted'}`} aria-hidden>
              {selected.autoCaptured ? <Zap size={14} /> : <FileText size={14} />}
            </span>
            <span className="sp-profile-row__body">
              <span className="sp-profile-row__name" title={selected.sourceFile}>
                {shortProfileLabel(selected.sourceFile)}
              </span>
              <span className="sp-profile-row__meta">
                {[
                  selected.capturedAt ? fmtDate(selected.capturedAt) : null,
                  selected.autoCaptured ? 'Auto' : selected.sourceKind.replaceAll('_', ' '),
                  selected.fresh ? null : 'Stale',
                ].filter(Boolean).join(' · ')}
              </span>
            </span>
          </>
        ) : (
          <span className="sp-profile-row__body">
            <span className="sp-profile-row__name">Choose a profile</span>
            <span className="sp-profile-row__meta">No ready captures yet</span>
          </span>
        )}
        <ChevronRight size={15} className="sp-profile-picker__chevron" aria-hidden />
      </button>
      {open ? (
        <div className="sp-profile-picker__menu" role="listbox" aria-label="Available profiles">
          {automatic.length ? (
            <div className="sp-profile-picker__section">
              <div className="sp-profile-picker__group">
                Automatic
                <span>{automatic.length}</span>
              </div>
              {automatic.map((item) => (
                <ProfileRow
                  key={item.sourcePath}
                  item={item}
                  selected={item.sourcePath === selectedPath}
                  onSelect={choose}
                />
              ))}
            </div>
          ) : null}
          {manual.length ? (
            <div className="sp-profile-picker__section">
              <div className="sp-profile-picker__group">
                Manual & imported
                <span>{manual.length}</span>
              </div>
              {manual.map((item) => (
                <ProfileRow
                  key={item.sourcePath}
                  item={item}
                  selected={item.sourcePath === selectedPath}
                  onSelect={choose}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PageView({ route }: { route: RouteState }) {
  const sparkQ = useQuery({ queryKey: ['spark-profiles'], queryFn: api.sparkProfiles });
  const index = record(sparkQ.data);
  const profiles = profileSummaries(index);
  const requestedPath = routeProfile(route);
  const readyProfiles = profiles.filter((item) => item.status === 'ready');
  const reportPath = text(index.report_profile_path);
  const defaultPath =
    (readyProfiles.some((item) => item.sourcePath === reportPath) ? reportPath : '') ||
    readyProfiles[0]?.sourcePath ||
    '';
  const selectedPath = requestedPath || defaultPath;
  const selectedSummary = profiles.find((item) => item.sourcePath === selectedPath);
  const view = normalizedView(route.view);
  const profileQ = useQuery({
    queryKey: ['spark-profile', selectedPath],
    queryFn: () => api.sparkProfile(selectedPath),
    enabled: Boolean(selectedPath),
  });

  useEffect(() => {
    if (!sparkQ.isSuccess || requestedPath || !defaultPath) return;
    navigate({ tab: 'spark', profile: defaultPath, view }, true);
  }, [defaultPath, requestedPath, sparkQ.isSuccess, view]);

  const selectProfile = (path: string) => {
    navigate({ tab: 'spark', profile: path, view });
  };

  const importProfile = async (url: string) => {
    const result = record(await api.importSparkProfile(url));
    const path = text(result.source_path ?? result.profile_path ?? record(result.profile).source_path);
    await sparkQ.refetch();
    if (path) navigate({ tab: 'spark', profile: path, view: 'overview' });
  };

  const uploadProfile = async (file: File) => {
    const result = record(await api.uploadSparkProfile(file));
    const path = text(result.source_path ?? result.profile_path ?? record(result.profile).source_path);
    await sparkQ.refetch();
    if (path) navigate({ tab: 'spark', profile: path, view: 'overview' });
  };

  const refresh = async () => {
    await Promise.all([sparkQ.refetch(), selectedPath ? profileQ.refetch() : Promise.resolve()]);
  };

  if (sparkQ.isLoading) {
    return (
      <PageEnter className="sp-stack">
        <div className="sp-skeleton sp-skeleton--hero" />
        <div className="sp-skeleton" />
      </PageEnter>
    );
  }
  if (sparkQ.isError) {
    return <ErrorState title="Couldn't load spark profiles">{(sparkQ.error as Error)?.message}</ErrorState>;
  }

  const enabled = index.spark_enabled !== false && index.enabled !== false;
  const loadedProfile = unwrapProfile(profileQ.data);
  const loadedVerdict = record(loadedProfile.verdict);
  const loadedDuration = numeric(record(loadedProfile.window).duration_sec);
  const glowTone = gradeGlowTone(text(loadedVerdict.grade));

  if (!enabled) {
    return (
      <PageEnter className="sp-stack">
        <HeroCard className="sp-disabled" tone="info">
          <Zap size={24} />
          <div>
            <h2>Spark integration is disabled</h2>
            <p>Install and enable Spark, then capture a 30–60 second profile while the server is lagging.</p>
          </div>
          <code>/spark profiler start --timeout 60</code>
        </HeroCard>
      </PageEnter>
    );
  }

  return (
    <PageEnter className="sp-stack">
      <HeroCard
        className={`sp-hero sp-hero--${glowTone}`}
        tone={glowTone}
        glowRadius={22}
        coneSpread={20}
      >
        <div className="sp-hero__surface wt-hero-shell">
          <HeroWatermark
            icon={Zap}
            tone={glowTone === 'ok' ? 'ok' : glowTone === 'danger' ? 'danger' : glowTone === 'warn' ? 'warn' : 'accent'}
          />
          <div className="sp-hero__head">
            <div className="sp-hero__identity">
              <div className="sp-hero__copy">
                <div className="sp-eyebrow">Current profile</div>
                <h2 title={selectedSummary?.sourceFile || undefined}>
                  {selectedSummary?.sourceFile
                    ? shortProfileLabel(selectedSummary.sourceFile)
                    : 'Choose a profile'}
                </h2>
                <p className="sp-hero__meta">
                  {selectedSummary?.capturedAt
                    ? [
                        fmtDate(selectedSummary.capturedAt),
                        selectedSummary.sourceKind.replaceAll('_', ' '),
                        text(loadedProfile.mode) || null,
                        loadedDuration > 0 ? `${loadedDuration.toFixed(0)}s` : null,
                      ].filter(Boolean).join(' · ')
                    : 'Select, import, or capture a profile to begin analysis.'}
                </p>
              </div>
            </div>
            <div className="sp-hero__actions">
              {text(loadedVerdict.grade) ? (
                <StatusPill tone={gradePillTone(text(loadedVerdict.grade))}>
                  {text(loadedVerdict.grade)}
                </StatusPill>
              ) : null}
              {selectedSummary?.autoCaptured ? <StatusPill tone="warn">Auto</StatusPill> : null}
              {selectedSummary && !selectedSummary.fresh ? <StatusPill tone="neutral">Stale</StatusPill> : null}
              <Button onClick={() => void refresh()} disabled={sparkQ.isFetching || profileQ.isFetching}>
                <RefreshCw size={14} /> Refresh
              </Button>
              {text(loadedProfile.spark_viewer_url ?? record(loadedProfile.links).viewer) ? (
                <a className="sp-link-button" href={text(loadedProfile.spark_viewer_url ?? record(loadedProfile.links).viewer)} target="_blank" rel="noreferrer">
                  Spark viewer <ExternalLink size={13} />
                </a>
              ) : null}
            </div>
          </div>

          <HeroTabNav
            layoutGroupId="sp-views"
            aria-label="Spark profile views"
            value={view}
            items={VIEWS.map((item) => ({ id: item.id, label: item.label }))}
            onChange={(id) =>
              navigate({
                tab: 'spark',
                profile: selectedPath,
                view: id,
                finding: id === 'findings' ? route.finding || null : null,
              })
            }
          />
        </div>
      </HeroCard>

      <div className="sp-chrome">
        <div className="sp-chrome__zone sp-chrome__zone--import">
          <div className="sp-chrome__label">Import</div>
          <WorkflowBar onImport={importProfile} onUpload={uploadProfile} />
        </div>
        {readyProfiles.length ? (
          <div className="sp-chrome__zone sp-chrome__zone--profile">
            <ProfilePicker
              profiles={readyProfiles}
              selectedPath={selectedPath}
              onSelect={selectProfile}
            />
          </div>
        ) : null}
      </div>

      {!profiles.length ? (
        <EmptyState title="No Spark profiles found">
          <HardDriveDownload size={17} className="mx-auto mb-2" />
          Capture a profile on the server or import a Spark URL.
        </EmptyState>
      ) : (
        <main className="sp-content">
          {profileQ.isLoading ? <div className="sp-skeleton" /> : null}
          {profileQ.isError ? (
            <ErrorState title="Couldn't load selected profile">{(profileQ.error as Error).message}</ErrorState>
          ) : null}
          {profileQ.data ? (() => {
            const profile = {
              ...loadedProfile,
              size_bytes: loadedProfile.size_bytes ?? selectedSummary?.sizeBytes,
            };
            return (
              <FadeIn key={view}>
                {view === 'overview' ? <OverviewView profile={profile} profilePath={selectedPath} /> : null}
                {view === 'findings' ? (
                  <FindingsView
                    profile={profile}
                    profilePath={selectedPath}
                    initialFindingId={route.finding || ''}
                  />
                ) : null}
                {view === 'world' ? <WorldView profile={profile} /> : null}
                {view === 'map' ? <MapView profile={profile} /> : null}
                {view === 'sources' ? (
                  <SourcesView
                    profile={profile}
                    profilePath={selectedPath}
                    onImport={importProfile}
                    onUpload={uploadProfile}
                  />
                ) : null}
                {view === 'timeline' ? <TimelineView profile={profile} /> : null}
                {view === 'calls' ? (
                  <CallPathsView
                    profile={profile}
                    profilePath={selectedPath}
                    initialSource={route.source || ''}
                  />
                ) : null}
                {view === 'technical' ? <TechnicalView profile={profile} /> : null}
                {view === 'compare' ? <CompareView profile={profile} currentPath={selectedPath} profiles={profiles} /> : null}
              </FadeIn>
            );
          })() : null}
        </main>
      )}
    </PageEnter>
  );
}
