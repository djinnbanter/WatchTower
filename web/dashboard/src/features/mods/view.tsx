import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { asArray, asRecord, bool, get, num, str } from '@/lib/utils';
import { FadeIn, HeroWatermark, PageEnter } from '@/ui/motion';
import { ErrorState, HeroCard, HeroTabNav, MetricReadout, StatusPill } from '@/ui/patterns';
import { Boxes } from '@/ui/icons';
import { buildBadgeMaps, enrichedFactsMods } from './catalog';
import { ChangesTab } from './changes-tab';
import { ConfigsTab } from './configs-tab';
import { ConflictsTab } from './conflicts-tab';
import { ForensicsTab } from './forensics-tab';
import { LogErrorsTab } from './log-errors-tab';
import { ModrinthOverviewBanner, ModrinthTab } from './modrinth-tab';
import { OverviewTab } from './overview-tab';
import { UpdatesTab } from './updates-tab';
import type { ModViewId } from './types';
import './mods.css';

const VIEWS: { id: ModViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'updates', label: 'Updates' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'log-errors', label: 'Log errors' },
  { id: 'changes', label: 'Changes' },
  { id: 'configs', label: 'Configs' },
  { id: 'modrinth', label: 'Modrinth' },
  { id: 'forensics', label: 'Forensics' },
];

const VALID = new Set(VIEWS.map((v) => v.id));

type IconCmp = ComponentType<{ size?: number; className?: string }>;
const BoxesIcon = Boxes as IconCmp;

function VitalTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'ok' | 'warn' | 'danger' | 'info';
}) {
  return (
    <div className="md-vital">
      <MetricReadout
        label={label}
        value={value}
        format={(n) => String(Math.round(n))}
        size="md"
        tone={tone === 'info' ? 'default' : tone}
      />
    </div>
  );
}

export function PageView({ route }: { route: RouteState }) {
  const rawView = (route.view as ModViewId) || 'overview';
  const view = VALID.has(rawView) ? rawView : 'overview';
  const initialModId = route.mod || null;
  const qc = useQueryClient();

  const opsQ = useQuery({ queryKey: ['ops-cache'], queryFn: api.opsCache });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const modrinthQ = useQuery({
    queryKey: ['modrinth-status'],
    queryFn: api.modrinthStatus,
    refetchInterval: (q) => (bool(asRecord(q.state.data).running) ? 1500 : false),
  });

  const [search, setSearch] = useState('');
  const [showTechNames, setShowTechNames] = useState(() => {
    try {
      return localStorage.getItem('wt.techNames') === 'true';
    } catch {
      return false;
    }
  });

  const ops = asRecord(opsQ.data);
  const factsRoot = asRecord(factsQ.data);
  const factsOptional = asRecord(factsRoot.optional ?? factsRoot);
  const settings = asRecord(settingsQ.data);
  const modrinthStatus = asRecord(modrinthQ.data);
  const runningMods = asRecord(get(ops, 'running_mods'));
  const modsInventory = asRecord(get(ops, 'mods_inventory'));
  const modLogErrors = asRecord(get(ops, 'mod_log_errors'));
  const modIssues = asArray<Record<string, unknown>>(get(ops, 'mod_issues', 'entries'));
  const recommendations = asArray<Record<string, unknown>>(factsOptional.mod_recommendations);
  const factsMods = useMemo(
    () => enrichedFactsMods(ops, factsOptional),
    [ops, factsOptional],
  );
  const modrinthUpdates = asArray<Record<string, unknown>>(
    factsOptional.modrinth_updates ?? get(ops, 'modrinth_scan', 'updates'),
  );
  const modrinthRunning = bool(modrinthStatus.running);
  const prevModrinthRunning = useRef(modrinthRunning);
  useEffect(() => {
    if (prevModrinthRunning.current && !modrinthRunning && modrinthStatus.success !== false) {
      void qc.invalidateQueries({ queryKey: ['facts'] });
      void qc.invalidateQueries({ queryKey: ['ops-cache'] });
    }
    prevModrinthRunning.current = modrinthRunning;
  }, [modrinthRunning, modrinthStatus.success, qc]);
  const modrinthLookupEnabled = settings.modrinth_lookup as boolean | undefined;
  const hasReport = !!factsQ.data;

  const conflictCount = recommendations.length || modIssues.length;
  const logErrorCount = Math.max(
    num(modLogErrors.count),
    asArray(modLogErrors.entries).length,
    asArray(factsOptional.mod_log_errors).length,
  );

  const badgeMaps = useMemo(
    () => buildBadgeMaps(ops, factsOptional),
    [ops, factsOptional],
  );

  const securityIds = badgeMaps.securityFlags
    .map((f) => str(f.mod_id ?? f.id))
    .filter(Boolean);
  const connectorWarnings = badgeMaps.connectorWarnings;
  const connectorIds = connectorWarnings
    .map((w) => str(w.mod_id ?? w.id))
    .filter(Boolean);

  function connectorChipSummary(warnings: Record<string, unknown>[]): string {
    const first = warnings[0];
    if (!first) return '';
    const msg = str(first.message).trim();
    if (msg) {
      return warnings.length === 1 ? msg : `${msg} · +${warnings.length - 1} more`;
    }
    return 'Sinytra Connector loaded — Fabric mods can be unstable.';
  }

  function handleTechNames(next: boolean) {
    setShowTechNames(next);
    try {
      localStorage.setItem('wt.techNames', String(next));
    } catch {
      /* ignore */
    }
  }

  if (opsQ.isLoading) {
    return (
      <PageEnter className="md-page">
        <div className="md-skeleton">
          <div className="md-skeleton__bar" />
          <div className="md-skeleton__bar" style={{ width: '60%' }} />
          <div className="md-skeleton__panel" />
        </div>
      </PageEnter>
    );
  }
  if (opsQ.isError) {
    return <ErrorState title="Couldn't load mod data">{(opsQ.error as Error)?.message}</ErrorState>;
  }

  const modCount = Math.max(num(runningMods.count), asArray(runningMods.mods).length, factsMods.length);
  const heroTone =
    securityIds.length > 0
      ? 'danger'
      : conflictCount > 0
        ? 'warn'
        : modrinthUpdates.length > 0
          ? 'info'
          : 'ok';
  const heroHint =
    securityIds.length > 0
      ? 'Security flags need attention before you dig into updates.'
      : conflictCount > 0
        ? 'Conflicts and log errors are ready to triage — catalog stays fully searchable.'
        : modrinthUpdates.length > 0
          ? 'Catalog, updates, and Modrinth status in one place.'
          : 'Running mods, side scores, and Modrinth context — pick a row for the full detail.';

  return (
    <PageEnter className="md-page">
      <FadeIn className="md-hero-wrap">
        <HeroCard
          className={`md-hero md-hero--${heroTone}`}
          tone={heroTone}
          glowRadius={16}
          coneSpread={18}
        >
          <div className="md-hero__body wt-hero-shell">
            <HeroWatermark
              icon={BoxesIcon}
              tone={
                heroTone === 'danger'
                  ? 'danger'
                  : heroTone === 'warn'
                    ? 'warn'
                    : heroTone === 'ok'
                      ? 'ok'
                      : 'info'
              }
            />
            <div className="md-hero__main">
              <div className="md-hero__head">
                <div className="md-hero__title-block">
                  <div className="md-hero__title">
                    <h2>Mods</h2>
                    <StatusPill tone={heroTone === 'ok' ? 'ok' : heroTone === 'info' ? 'info' : heroTone}>
                      {modCount} loaded
                    </StatusPill>
                  </div>
                  <p className="md-hero__hint">{heroHint}</p>
                </div>
                <label className="md-tech-toggle">
                  <input
                    type="checkbox"
                    checked={showTechNames}
                    onChange={(e) => handleTechNames(e.target.checked)}
                  />
                  <span>Tech names</span>
                </label>
              </div>

              <div className="md-status" role="status">
                {securityIds.length ? (
                  <div className="md-status__chip md-status__chip--danger" role="alert">
                    <span className="md-status__label">Security</span>
                    <span className="md-status__text">Denylisted: {securityIds.join(', ')}</span>
                  </div>
                ) : null}
                {connectorWarnings.length ? (
                  <button
                    type="button"
                    className="md-status__chip md-status__chip--warn"
                    onClick={() => {
                      if (connectorIds[0]) {
                        navigate({ tab: 'mods', view: 'overview', mod: connectorIds[0] });
                      }
                    }}
                  >
                    <span className="md-status__label">Connector</span>
                    <span className="md-status__text">
                      {connectorChipSummary(connectorWarnings)}
                    </span>
                  </button>
                ) : null}
                <ModrinthOverviewBanner
                  compact
                  modrinthLookupEnabled={modrinthLookupEnabled}
                  status={modrinthStatus}
                />
              </div>
            </div>

            <div className="md-vitals" aria-label="Mod catalog vitals">
              <VitalTile label="Loaded" value={modCount} tone="default" />
              <VitalTile
                label="Updates"
                value={modrinthUpdates.length}
                tone={modrinthUpdates.length ? 'info' : 'default'}
              />
              <VitalTile
                label="Conflicts"
                value={conflictCount}
                tone={conflictCount ? 'warn' : 'default'}
              />
              <VitalTile
                label="Log errors"
                value={logErrorCount}
                tone={logErrorCount ? 'warn' : 'default'}
              />
            </div>

            <HeroTabNav
              layoutGroupId="md-views"
              aria-label="Mods sections"
              stretch={false}
              className="md-hero__tabs"
              value={view}
              items={VIEWS.map((v) => ({
                id: v.id,
                label: v.label,
                count:
                  v.id === 'updates' && modrinthUpdates.length
                    ? modrinthUpdates.length
                    : v.id === 'conflicts' && conflictCount
                      ? conflictCount
                      : v.id === 'log-errors' && logErrorCount
                        ? logErrorCount
                        : null,
              }))}
              onChange={(id) =>
                navigate({
                  tab: 'mods',
                  view: id,
                  mod: null,
                  panel: id === 'configs' ? route.panel || null : null,
                })
              }
            />
          </div>
        </HeroCard>
      </FadeIn>

      {view === 'overview' ? (
        <OverviewTab
          runningMods={runningMods}
          modsInventory={modsInventory}
          showTechNames={showTechNames}
          search={search}
          onSearch={setSearch}
          badgeMaps={badgeMaps}
          factsMods={factsMods}
          initialModId={initialModId}
          updateCount={modrinthUpdates.length}
        />
      ) : null}
      {view === 'updates' ? (
        <UpdatesTab
          modrinthUpdates={modrinthUpdates}
          factsMods={factsMods}
          runningMods={runningMods}
          badgeMaps={badgeMaps}
          showTechNames={showTechNames}
          search={search}
          onSearch={setSearch}
          initialModId={initialModId}
          modrinthLookupEnabled={modrinthLookupEnabled}
        />
      ) : null}
      {view === 'conflicts' ? (
        <ConflictsTab
          recommendations={recommendations}
          modIssues={modIssues}
          factsMods={factsMods}
          search={search}
          onSearch={setSearch}
        />
      ) : null}
      {view === 'log-errors' ? (
        <LogErrorsTab
          modLogErrors={modLogErrors}
          factsErrors={factsOptional.mod_log_errors}
          recommendations={recommendations}
          modIssues={modIssues}
          hasReport={hasReport}
          search={search}
          onSearch={setSearch}
        />
      ) : null}
      {view === 'changes' ? (
        <ChangesTab
          modsInventory={modsInventory}
          search={search}
          onSearch={setSearch}
          factsMods={factsMods}
        />
      ) : null}
      {view === 'configs' ? (
        <ConfigsTab search={search} onSearch={setSearch} initialPath={route.panel || null} />
      ) : null}
      {view === 'modrinth' ? (
        <ModrinthTab
          status={modrinthStatus}
          modrinthLookupEnabled={modrinthLookupEnabled}
          hasReport={hasReport}
          factsMods={factsMods}
          modrinthUpdates={modrinthUpdates}
        />
      ) : null}
      {view === 'forensics' ? (
        <ForensicsTab
          factsOptional={factsOptional}
          search={search}
          onSearch={setSearch}
          hasReport={hasReport}
        />
      ) : null}
    </PageEnter>
  );
}
