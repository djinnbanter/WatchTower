import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCanMutateMods, useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { navigate } from '@/app/router';
import { str } from '@/lib/utils';
import { Settings2 } from '@/ui/icons';
import { FadeIn } from '@/ui/motion';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { buildCatalogRows } from './catalog';
import {
  ModDepsSection,
  ModIcon,
  ModLinkCluster,
  ModSideCallout,
  modLinkEntries,
} from './components';
import { ConfigsModal } from './configs-modal';
import { modIconUrl } from './modrinth';
import { resolveNestedJars } from './nested-jars';
import { projectIdMetaLine, projectJarMetaLine } from './project-header-meta';
import { projectMainSections, projectRailCta, type ProjectMainSection } from './project-layout';
import { modDisplayName, sideSummaryForMod } from './side';
import { SuiteChrome } from './suite-chrome';
import { MutateConfirmSheet } from './mutate-confirm-sheet';
import { MutateJobProgress } from './mutate-job-progress';
import { jobIdFromAccepted } from './mutate-api';
import { ModUpdateImpactSection } from './updates-impact';
import type { BadgeMaps, CatalogFilter, CatalogRow, CatalogSort, VerdictFilter } from './types';

export function ModProjectPage({
  modId,
  runningMods,
  factsMods,
  badgeMaps,
  showTechNames,
  search,
  onSearch,
  filter,
  onFilter,
  sort,
  onSort,
  modrinthUpdates,
  verdictFilter,
  onVerdictFilter,
  chromeMode = 'library',
  initialConfigPath = null,
}: {
  modId: string;
  runningMods: Record<string, unknown> | null;
  factsMods: Record<string, unknown>[];
  badgeMaps: BadgeMaps;
  showTechNames: boolean;
  search: string;
  onSearch: (v: string) => void;
  filter: CatalogFilter;
  onFilter: (f: CatalogFilter) => void;
  sort: CatalogSort;
  onSort: (s: CatalogSort) => void;
  modrinthUpdates: Record<string, unknown>[];
  verdictFilter: VerdictFilter;
  onVerdictFilter: (v: VerdictFilter) => void;
  chromeMode?: 'library' | 'updates';
  initialConfigPath?: string | null;
}) {
  const canWrite = useCanWrite();
  const canMutate = useCanMutateMods();
  const qc = useQueryClient();
  const [confirmRisk, setConfirmRisk] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(() =>
    !!(initialConfigPath && initialConfigPath.startsWith('config/')),
  );
  const [quarantineOpen, setQuarantineOpen] = useState(false);
  const [quarantineBusy, setQuarantineBusy] = useState(false);
  const [quarantineError, setQuarantineError] = useState<string | null>(null);
  const [quarantineWorldRisk, setQuarantineWorldRisk] = useState(false);
  const [mutateJobId, setMutateJobId] = useState<string | null>(null);

  const catalog = useMemo(
    () => buildCatalogRows(runningMods, factsMods, badgeMaps),
    [runningMods, factsMods, badgeMaps],
  );
  const catalogById = useMemo(() => {
    const map = new Map<string, CatalogRow>();
    for (const r of catalog) map.set(r.id, r);
    return map;
  }, [catalog]);

  const mod = catalogById.get(modId) ?? null;
  const updateRow = useMemo(
    () => modrinthUpdates.find((u) => str(u.mod_id) === modId) ?? null,
    [modrinthUpdates, modId],
  );

  const jarName = mod ? String(mod.jar_file ?? mod.jar ?? '') : '';
  const disabled = mod?.disabled === true;
  const onUpdates = chromeMode === 'updates' || filter === 'updates';

  useEffect(() => {
    setConfirmRisk(false);
    setActionError(null);
  }, [mod?.id, jarName]);

  useEffect(() => {
    if (initialConfigPath && initialConfigPath.startsWith('config/')) {
      setConfigOpen(true);
    }
  }, [initialConfigPath, modId]);

  const invalidateMods = () => {
    void qc.invalidateQueries({ queryKey: ['ops-cache'] });
    void qc.invalidateQueries({ queryKey: ['facts'] });
    void qc.invalidateQueries({ queryKey: ['overview-meta'] });
  };

  const disableM = useMutation({
    mutationFn: (confirm: boolean) =>
      api.modsDisable({ jar: jarName, confirm_world_risk: confirm || undefined }),
    onSuccess: () => {
      setConfirmRisk(false);
      setActionError(null);
      invalidateMods();
    },
    onError: (e: Error) => {
      const msg = e?.message ?? 'Disable failed';
      if (msg.includes('world_risk_confirm_required') || msg.includes('400')) {
        setConfirmRisk(true);
        setActionError('This mod looks tied to the world. Confirm to disable anyway.');
      } else {
        setActionError(msg);
      }
    },
  });

  const enableM = useMutation({
    mutationFn: () => api.modsEnable({ jar: jarName }),
    onSuccess: () => {
      setActionError(null);
      invalidateMods();
    },
    onError: (e: Error) => setActionError(e?.message ?? 'Enable failed'),
  });

  function goBack() {
    navigate({
      tab: 'mods',
      view: onUpdates ? 'updates' : 'overview',
      mod: null,
      filter: onUpdates || filter === 'all' ? null : filter,
    });
  }

  function selectModById(id: string) {
    navigate({
      tab: 'mods',
      view: onUpdates ? 'updates' : 'overview',
      mod: id,
      filter: onUpdates || filter === 'all' ? null : filter,
    });
  }

  if (!mod) {
    return (
      <div className="md-project">
        <SuiteChrome
          filter={filter}
          onFilter={onFilter}
          search={search}
          onSearch={onSearch}
          sort={sort}
          onSort={onSort}
          verdictFilter={verdictFilter}
          onVerdictFilter={onVerdictFilter}
          mode={chromeMode}
        />
        <div className="md-empty">
          <EmptyState title="Mod not found">
            That id is not in the current catalog. Go back to the library and pick another mod.
          </EmptyState>
          <Button kind="primary" onClick={goBack}>
            Back to Library
          </Button>
        </div>
      </div>
    );
  }

  const name = modDisplayName(mod, showTechNames);
  const idMeta = projectIdMetaLine(mod);
  const jarMeta = projectJarMetaLine(jarName);
  const side = sideSummaryForMod(mod, badgeMaps);
  const hasLinks = modLinkEntries(mod).length > 0;
  const nestedJars = resolveNestedJars(mod, factsMods);
  const worldRisk =
    badgeMaps.worldRiskById.get(mod.id) ??
    (mod.world_risk && typeof mod.world_risk === 'object'
      ? (mod.world_risk as Record<string, unknown>)
      : null);
  const highWorldRisk = String(worldRisk?.level ?? '') === 'high';
  const riskReasons = Array.isArray(worldRisk?.reasons)
    ? (worldRisk!.reasons as unknown[]).map(String)
    : [];

  const aboutText = mod.modrinth_description ? String(mod.modrinth_description) : '';
  const sections = projectMainSections({
    hasUpdate: !!updateRow,
    highWorldRisk,
    hasAbout: !!aboutText,
    hasNested: nestedJars.length > 0,
  });
  const railCta = projectRailCta({
    outdated: !!mod.modrinth_outdated,
    hasUpdateRow: !!updateRow,
    modId: mod.id,
    modrinthUrl: String(mod.modrinth_url || ''),
  });

  const busy = disableM.isPending || enableM.isPending;
  const enabled = !disabled;
  const backLabel = onUpdates ? 'Back to updates' : 'Back to library';

  function onToggleEnabled(nextEnabled: boolean) {
    if (!canWrite || !jarName || busy) return;
    if (nextEnabled) {
      if (disabled) enableM.mutate();
      return;
    }
    if (highWorldRisk) {
      setConfirmRisk(true);
      return;
    }
    disableM.mutate(false);
  }

  function renderSection(id: ProjectMainSection): ReactNode {
    switch (id) {
      case 'update':
        return updateRow ? (
          <ModUpdateImpactSection
            key="update"
            row={updateRow}
            mod={mod ?? undefined}
            showTechNames={showTechNames}
            catalogById={catalogById}
            onSelectMod={selectModById}
            mods={factsMods}
          />
        ) : null;
      case 'world_risk':
        return (
          <div className="md-detail__block" key="world_risk">
            <h3>World risk</h3>
            <p className="md-drawer__desc text-wt-text-low">
              Disabling this mod may break the save. WatchTower checked world dimension folders and
              jar data paths — not full NBT.
            </p>
            {riskReasons.length ? (
              <ul className="md-nested">
                {riskReasons.map((r) => (
                  <li key={r} className="md-nested__item">
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      case 'about':
        return (
          <div className="md-detail__block" key="about">
            <h3>About</h3>
            <p className="md-drawer__desc">{aboutText}</p>
          </div>
        );
      case 'nested':
        return (
          <div className="md-detail__block" key="nested">
            <h3>Nested / embedded jars</h3>
            <p className="md-drawer__desc text-wt-text-low">
              These mods ship inside this jar (jar-in-jar). They are not separate files in mods/.
            </p>
            <ul className="md-nested">
              {nestedJars.map((j, i) => {
                const nid = String(j.id ?? j.mod_id ?? 'unknown');
                const label = String(j.display_name || nid);
                const ver = j.version ? ` · ${j.version}` : '';
                return (
                  <li className="md-nested__item" key={`${nid}-${i}`}>
                    <div className="md-nested__title">
                      {label}
                      <span className="text-wt-text-low">{ver}</span>
                    </div>
                    <div className="md-nested__id text-wt-text-low">{nid}</div>
                    {j.nested_path ? (
                      <div className="md-nested__path">{String(j.nested_path)}</div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      case 'deps':
        return (
          <ModDepsSection
            key="deps"
            modId={mod?.id ?? ''}
            factsMods={factsMods}
            onSelectMod={selectModById}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="md-project">
      <SuiteChrome
        filter={filter}
        onFilter={onFilter}
        search={search}
        onSearch={onSearch}
        sort={sort}
        onSort={onSort}
        verdictFilter={verdictFilter}
        onVerdictFilter={onVerdictFilter}
        mode={chromeMode}
      />

      <FadeIn>
        <article className="md-project__page" aria-label={name}>
          <div className="md-project__toolbar">
            <Button kind="ghost" onClick={goBack} aria-label={backLabel}>
              Back
            </Button>
          </div>

          <header className="md-detail__head md-project__head">
            <div className="md-project__head-row">
              <div className="md-detail__title-row">
                <ModIcon url={modIconUrl(mod)} name={name} size={72} />
                <div className="md-detail__titles">
                  <h2 className="md-detail__title md-project__title">{name}</h2>
                  <p className="md-project__meta-id">{idMeta}</p>
                  {jarMeta ? (
                    <p className="md-project__meta-jar" title={jarMeta}>
                      {jarMeta}
                    </p>
                  ) : null}
                  <div className="md-project__badges">
                    {highWorldRisk ? <StatusPill tone="warn">World risk</StatusPill> : null}
                    {mod.modrinth_outdated ? (
                      <StatusPill tone="warn">Update available</StatusPill>
                    ) : null}
                    {mod.meta?.is_mcreator ? <StatusPill tone="neutral">MCreator</StatusPill> : null}
                    {mod.meta?.loader_hint === 'fabric_in_neoforge_jar' ? (
                      <StatusPill tone="warn">Fabric jar</StatusPill>
                    ) : null}
                    {badgeMaps.connectorById.has(mod.id) ? (
                      <StatusPill tone="info">Connector</StatusPill>
                    ) : null}
                    {badgeMaps.securityById.has(mod.id) ? (
                      <StatusPill tone="danger">Security risk</StatusPill>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="md-project__head-actions">
                <Button
                  kind="default"
                  className="md-project__config-btn"
                  onClick={() => setConfigOpen(true)}
                >
                  <Settings2 size={16} aria-hidden />
                  Config
                </Button>
                {jarName ? (
                  <div className="md-detail__enable">
                    <div className="md-detail__enable-copy">
                      <div className="md-detail__enable-label">
                        {busy
                          ? enabled
                            ? 'Disabling…'
                            : 'Enabling…'
                          : enabled
                            ? 'Enabled'
                            : 'Disabled'}
                      </div>
                      <div className="md-detail__enable-hint">
                        {enabled
                          ? 'Jar loads from mods/ on next boot'
                          : 'Renamed to .disabled — skipped on next boot'}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={enabled ? 'Disable mod jar' : 'Enable mod jar'}
                      disabled={!canWrite || busy}
                      title={canWrite ? undefined : VIEW_ONLY_TITLE}
                      onClick={() => onToggleEnabled(!enabled)}
                      className={`md-detail__switch${enabled ? ' is-on' : ''}${busy ? ' is-busy' : ''}`}
                    >
                      <span className="md-detail__switch-knob" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {confirmRisk ? (
              <div className="md-detail__enable-confirm" role="alert">
                <p>
                  High world risk. Disable anyway? Jar becomes{' '}
                  <code>{jarName.endsWith('.jar') ? `${jarName}.disabled` : jarName}</code>.
                </p>
                <div className="md-action-row">
                  <Button
                    kind="primary"
                    disabled={!canWrite || disableM.isPending || !jarName}
                    title={canWrite ? undefined : VIEW_ONLY_TITLE}
                    onClick={() => disableM.mutate(true)}
                  >
                    {disableM.isPending ? 'Disabling…' : 'Disable anyway'}
                  </Button>
                  <Button kind="default" onClick={() => setConfirmRisk(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {actionError ? <p className="md-detail__enable-error">{actionError}</p> : null}

            {canMutate && jarName ? (
              <div className="md-project__quarantine">
                <p className="md-drawer__desc">
                  Soft Disable (switch above) renames to .disabled. Quarantine moves the jar aside
                  with an undo backup — use that when a jar is bad or client-only.
                </p>
                <Button
                  kind="default"
                  className="md-project__quarantine-btn"
                  disabled={quarantineBusy || !!mutateJobId}
                  onClick={() => {
                    setQuarantineError(null);
                    setQuarantineWorldRisk(false);
                    setQuarantineOpen(true);
                  }}
                >
                  Quarantine jar
                </Button>
                {mutateJobId ? <MutateJobProgress jobId={mutateJobId} /> : null}
              </div>
            ) : null}

            <MutateConfirmSheet
              open={quarantineOpen}
              kind="quarantine"
              items={[{ mod_id: mod.id, label: name }]}
              worldRisk={highWorldRisk}
              confirmWorldRisk={quarantineWorldRisk}
              onConfirmWorldRiskChange={highWorldRisk ? setQuarantineWorldRisk : undefined}
              busy={quarantineBusy}
              error={quarantineError}
              onCancel={() => {
                if (!quarantineBusy) setQuarantineOpen(false);
              }}
              onConfirm={() => {
                void (async () => {
                  setQuarantineBusy(true);
                  setQuarantineError(null);
                  try {
                    const body = await api.modsMutateQuarantine({
                      mod_id: mod.id,
                      jar: jarName || undefined,
                      confirm: true,
                      confirm_world_risk: highWorldRisk ? true : undefined,
                    });
                    setQuarantineOpen(false);
                    setMutateJobId(jobIdFromAccepted(body) || null);
                    invalidateMods();
                  } catch (e) {
                    setQuarantineError((e as Error)?.message || 'Quarantine failed');
                  } finally {
                    setQuarantineBusy(false);
                  }
                })();
              }}
            />

          </header>

          <div className="md-project__layout">
            <aside className="md-project__rail" aria-label="Links and actions">
              <div>
                <h3>Links</h3>
                {hasLinks ? (
                  <ModLinkCluster mod={mod} layout="stack" />
                ) : (
                  <p className="md-project__rail-empty">No external links</p>
                )}
              </div>
              {railCta.kind !== 'none' ? (
                <div className="md-project__rail-cta">
                  {railCta.kind === 'update_detail' ? (
                    <Button
                      kind="primary"
                      className="md-project__rail-cta-btn"
                      onClick={() =>
                        navigate({
                          tab: 'mods',
                          view: 'updates',
                          mod: railCta.modId,
                          filter: null,
                        })
                      }
                    >
                      View update details
                    </Button>
                  ) : (
                    <Button
                      kind="primary"
                      className="md-project__rail-cta-btn"
                      onClick={() => window.open(railCta.url, '_blank', 'noopener')}
                    >
                      Open on Modrinth
                    </Button>
                  )}
                </div>
              ) : null}
              {side ? (
                <div className="md-detail__block md-detail__block--status md-project__rail-side">
                  <h3>Client / server</h3>
                  <ModSideCallout summary={side} />
                </div>
              ) : null}
            </aside>

            <div className="md-project__main">{sections.map((id) => renderSection(id))}</div>
          </div>
        </article>
      </FadeIn>

      <ConfigsModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        modId={mod.id}
        modSlug={mod.modrinth_slug ? String(mod.modrinth_slug) : null}
        displayName={name}
        initialPath={
          initialConfigPath && initialConfigPath.startsWith('config/') ? initialConfigPath : null
        }
      />
    </div>
  );
}
