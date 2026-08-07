import { useMemo } from 'react';
import { useCanMutateMods } from '@/app/permissions';
import { navigate } from '@/app/router';
import { str } from '@/lib/utils';
import { FadeIn } from '@/ui/motion';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { renderMarkdown } from '@/wiki/render';
import { buildCatalogRows } from './catalog';
import {
  ModIcon,
  ModLinkCluster,
  ModSideCallout,
  modLinkEntries,
} from './components';
import { MutateApplyPanel } from './mutate-apply-panel';
import { modIconUrl } from './modrinth';
import { projectIdMetaLine, projectJarMetaLine } from './project-header-meta';
import { modDisplayName, sideSummaryForMod } from './side';
import { SuiteChrome } from './suite-chrome';
import type { BadgeMaps, CatalogFilter, CatalogRow, CatalogSort, VerdictFilter } from './types';
import { updateDetailRelatedTarget } from './update-detail-nav';
import { updatesModrinthUrl, updatesVersionSides } from './updates-catalog-columns';
import { normalizeChangelogMarkdown } from './changelog-format';
import { ModUpdateImpactSection } from './updates-impact';

export function ModUpdateDetailPage({
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
}) {
  const canMutate = useCanMutateMods();
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

  const updateModIds = useMemo(() => {
    const s = new Set<string>();
    for (const u of modrinthUpdates) {
      const id = str(u.mod_id);
      if (id) s.add(id);
    }
    return s;
  }, [modrinthUpdates]);

  function goBack() {
    navigate({ tab: 'mods', view: 'updates', mod: null, filter: null });
  }

  function selectRelatedMod(id: string) {
    const target = updateDetailRelatedTarget(id, updateModIds);
    navigate({
      tab: 'mods',
      view: target.view,
      mod: target.mod,
      filter: null,
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
          mode="updates"
        />
        <div className="md-empty">
          <EmptyState title="Mod not found">
            That id is not in the current catalog. Go back to updates and pick another mod.
          </EmptyState>
          <Button kind="primary" onClick={goBack}>
            Back to updates
          </Button>
        </div>
      </div>
    );
  }

  const name = modDisplayName(mod, showTechNames);
  const jarName = String(mod.jar_file ?? mod.jar ?? '');
  const idMeta = projectIdMetaLine(mod);
  const jarMeta = projectJarMetaLine(jarName);
  const side = sideSummaryForMod(mod, badgeMaps);
  const hasLinks = modLinkEntries(mod).length > 0;
  const showUpdateBadge = !!updateRow || !!mod.modrinth_outdated;
  const modrinthUrl = updatesModrinthUrl(updateRow, {
    modrinth_compatible_url: str(mod.modrinth_compatible_url) || undefined,
    modrinth_cta_url: str(mod.modrinth_cta_url) || undefined,
  });
  const sides = updatesVersionSides(updateRow);
  const currentVersion = sides.current || str(mod.version) || '—';
  const latestVersion = sides.latest || '—';
  const changelog = normalizeChangelogMarkdown(
    str(updateRow?.changelog) || str(mod.modrinth_compatible_changelog) || '',
  );

  return (
    <div className="md-project md-project--update">
      <SuiteChrome
        filter={filter}
        onFilter={onFilter}
        search={search}
        onSearch={onSearch}
        sort={sort}
        onSort={onSort}
        verdictFilter={verdictFilter}
        onVerdictFilter={onVerdictFilter}
        mode="updates"
      />

      <FadeIn className="md-project__fill">
        <article className="md-project__page" aria-label={name}>
          <div className="md-project__toolbar">
            <Button kind="ghost" onClick={goBack} aria-label="Back to updates">
              Back
            </Button>
          </div>

          <header className="md-detail__head md-project__head">
            <div className="md-project__head-row">
              <div className="md-detail__title-row">
                <ModIcon url={modIconUrl(mod)} name={name} size={80} />
                <div className="md-detail__titles">
                  <h2 className="md-detail__title md-project__title">{name}</h2>
                  <p className="md-project__meta-id">{idMeta}</p>
                  {jarMeta ? (
                    <p className="md-project__meta-jar" title={jarMeta}>
                      {jarMeta}
                    </p>
                  ) : null}
                  {showUpdateBadge ? (
                    <div className="md-project__badges">
                      <StatusPill tone="warn">Update available</StatusPill>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="md-project__head-actions md-update-versions md-update-versions--head">
                <div className="md-update-versions__card">
                  <span className="md-update-versions__label">Installed</span>
                  <span className="md-update-versions__value" title={currentVersion}>
                    {currentVersion}
                  </span>
                </div>
                <span className="md-update-versions__arrow" aria-hidden>
                  →
                </span>
                <div className="md-update-versions__card md-update-versions__card--latest">
                  <span className="md-update-versions__label">Latest compatible</span>
                  <span className="md-update-versions__value" title={latestVersion}>
                    {latestVersion}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div className="md-project__layout md-project__layout--update">
            <aside className="md-project__rail" aria-label="Links and actions">
              <div>
                <h3>Links</h3>
                {hasLinks ? (
                  <ModLinkCluster mod={mod} layout="stack" />
                ) : (
                  <p className="md-project__rail-empty">No external links</p>
                )}
              </div>
              <div className="md-project__rail-cta">
                {canMutate ? (
                  <MutateApplyPanel
                    mod={mod}
                    updateRow={updateRow}
                    showTechNames={showTechNames}
                  />
                ) : (
                  <p className="md-drawer__desc md-mutate-perm-hint">
                    Owner must grant mod mutate permission before WatchTower can change jars from
                    this desk.
                  </p>
                )}
                {modrinthUrl ? (
                  <Button
                    kind={canMutate ? 'default' : 'primary'}
                    className="md-project__rail-cta-btn"
                    onClick={() => window.open(modrinthUrl, '_blank', 'noopener')}
                  >
                    Open on Modrinth
                  </Button>
                ) : null}
                <Button
                  kind="default"
                  className="md-project__rail-cta-btn"
                  onClick={() =>
                    navigate({ tab: 'mods', view: 'overview', mod: mod.id, filter: null })
                  }
                >
                  Open full mod page
                </Button>
              </div>

              {updateRow ? (
                <ModUpdateImpactSection
                  row={updateRow}
                  mod={mod}
                  showTechNames={showTechNames}
                  catalogById={catalogById}
                  onSelectMod={selectRelatedMod}
                  omitVersionDelta
                  mods={factsMods}
                />
              ) : (
                <div className="md-detail__block">
                  <h3>Update impact</h3>
                  <p className="md-drawer__desc">
                    No Modrinth update impact is available for this mod in the current scan.
                  </p>
                </div>
              )}

              {side ? (
                <div className="md-detail__block md-detail__block--status">
                  <h3>Client / server</h3>
                  <ModSideCallout summary={side} />
                </div>
              ) : null}
            </aside>

            <div className="md-project__main">
              <div className="md-detail__block md-detail__block--changelog">
                <h3>Changelog</h3>
                {changelog ? (
                  <div className="md-update-changelog">{renderMarkdown(changelog)}</div>
                ) : (
                  <p className="md-drawer__desc md-update-changelog-empty text-wt-text-low">
                    No changelog cached for this update yet. Run a Modrinth scan to pull notes from
                    the latest compatible build
                    {modrinthUrl ? ', or open the update on Modrinth.' : '.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </article>
      </FadeIn>
    </div>
  );
}
