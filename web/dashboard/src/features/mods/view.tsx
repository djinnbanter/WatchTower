import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { asArray, asRecord, bool, get, num, str } from '@/lib/utils';
import { FadeIn, HeroWatermark, PageEnter } from '@/ui/motion';
import { ErrorState, HeroCard, StatusPill, VitalTile } from '@/ui/patterns';
import { Boxes } from '@/ui/icons';
import { buildBadgeMaps, enrichedFactsMods } from './catalog';
import { ChangesTab } from './changes-tab';
import { ConflictsTab } from './conflicts-tab';
import { guessModIdFromConfigPath } from './config-paths';
import { ForensicsTab } from './forensics-tab';
import { LibraryTab } from './library-tab';
import { LogErrorsTab } from './log-errors-tab';
import { ModProjectPage } from './mod-project-page';
import { ModUpdateDetailPage } from './mod-update-detail-page';
import { ModrinthOverviewBanner, ModrinthTab } from './modrinth-tab';
import { parseCatalogFilter } from './side';
import type { CatalogFilter, CatalogSort, ModViewId, VerdictFilter } from './types';
import './mods.css';

const VALID = new Set<string>([
  'overview',
  'updates',
  'conflicts',
  'log-errors',
  'changes',
  'modrinth',
  'forensics',
]);

type IconCmp = ComponentType<{ size?: number; className?: string }>;
const BoxesIcon = Boxes as IconCmp;

export function PageView({ route }: { route: RouteState }) {
  const qc = useQueryClient();

  const rawView = (route.view as string) || 'overview';
  const view: ModViewId = VALID.has(rawView) ? (rawView as ModViewId) : 'overview';
  const initialModId = route.mod || null;
  const updatesView = view === 'updates';
  const catalogFilter: CatalogFilter = updatesView
    ? 'updates'
    : parseCatalogFilter(route.filter === 'updates' ? 'all' : route.filter);

  // Deep link ?filter=updates → Updates sidebar page
  useEffect(() => {
    if (route.view !== 'updates' && route.filter === 'updates') {
      navigate(
        { tab: 'mods', view: 'updates', filter: null, mod: route.mod || null, panel: null },
        true,
      );
    }
  }, [route.view, route.filter, route.mod]);

  // Legacy ?view=configs → open mod project page + config popup when possible
  useEffect(() => {
    if (route.view !== 'configs') return;
    const path = route.panel && String(route.panel).startsWith('config/') ? String(route.panel) : null;
    const guessed = path ? guessModIdFromConfigPath(path) : null;
    navigate(
      {
        tab: 'mods',
        view: 'overview',
        mod: route.mod || guessed,
        panel: path,
        filter: null,
      },
      true,
    );
  }, [route.view, route.panel, route.mod]);

  const opsQ = useQuery({ queryKey: ['ops-cache'], queryFn: api.opsCache });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const modrinthQ = useQuery({
    queryKey: ['modrinth-status'],
    queryFn: api.modrinthStatus,
    refetchInterval: (q) => (bool(asRecord(q.state.data).running) ? 1500 : false),
  });

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<CatalogSort>('name');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');
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

  function setCatalogFilter(next: CatalogFilter) {
    if (next === 'updates') {
      navigate({ tab: 'mods', view: 'updates', filter: null, mod: null });
      return;
    }
    navigate({
      tab: 'mods',
      view: 'overview',
      filter: next === 'all' ? null : next,
      mod: null,
    });
    setVerdictFilter('all');
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

  const isLibrary = view === 'overview' || view === 'updates';
  const showProject = isLibrary && !!initialModId;
  const showHero = view !== 'modrinth';

  return (
    <PageEnter className="md-page">
      {showHero ? (
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
              <VitalTile className="md-vital" label="Loaded" value={modCount} tone="default" />
              <VitalTile
                className="md-vital"
                label="Updates"
                value={modrinthUpdates.length}
                tone="default"
              />
              <VitalTile
                className="md-vital"
                label="Conflicts"
                value={conflictCount}
                tone={conflictCount ? 'warn' : 'default'}
              />
              <VitalTile
                className="md-vital"
                label="Log errors"
                value={logErrorCount}
                tone={logErrorCount ? 'warn' : 'default'}
              />
            </div>
          </div>
        </HeroCard>
      </FadeIn>
      ) : null}

      <div className="md-suite">
        {isLibrary && !showProject ? (
          <LibraryTab
            runningMods={runningMods}
            showTechNames={showTechNames}
            search={search}
            onSearch={setSearch}
            badgeMaps={badgeMaps}
            factsMods={factsMods}
            filter={catalogFilter}
            onFilter={setCatalogFilter}
            sort={sort}
            onSort={setSort}
            modrinthUpdates={modrinthUpdates}
            verdictFilter={verdictFilter}
            onVerdictFilter={setVerdictFilter}
            chromeMode={updatesView ? 'updates' : 'library'}
          />
        ) : null}

        {showProject && initialModId && updatesView ? (
          <ModUpdateDetailPage
            modId={initialModId}
            runningMods={runningMods}
            factsMods={factsMods}
            badgeMaps={badgeMaps}
            showTechNames={showTechNames}
            search={search}
            onSearch={setSearch}
            filter={catalogFilter}
            onFilter={setCatalogFilter}
            sort={sort}
            onSort={setSort}
            modrinthUpdates={modrinthUpdates}
            verdictFilter={verdictFilter}
            onVerdictFilter={setVerdictFilter}
          />
        ) : null}

        {showProject && initialModId && !updatesView ? (
          <ModProjectPage
            modId={initialModId}
            runningMods={runningMods}
            factsMods={factsMods}
            badgeMaps={badgeMaps}
            showTechNames={showTechNames}
            search={search}
            onSearch={setSearch}
            filter={catalogFilter}
            onFilter={setCatalogFilter}
            sort={sort}
            onSort={setSort}
            modrinthUpdates={modrinthUpdates}
            verdictFilter={verdictFilter}
            onVerdictFilter={setVerdictFilter}
            chromeMode="library"
            initialConfigPath={
              route.panel && String(route.panel).startsWith('config/') ? String(route.panel) : null
            }
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
      </div>
    </PageEnter>
  );
}
