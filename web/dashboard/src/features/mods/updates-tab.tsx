import { useEffect, useMemo, useState } from 'react';
import { navigate } from '@/app/router';
import { str } from '@/lib/utils';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { buildCatalogRows } from './catalog';
import {
  ActionRow,
  ModDepsSection,
  ModIcon,
  ModLinkChip,
  ModLinkCluster,
  ModsSearch,
  Segmented,
  modLinkEntries,
} from './components';
import { modIconUrl } from './modrinth';
import { UPDATE_VERDICT_FILTERS, VERDICT_LABEL, VERDICT_TONE, modDisplayName } from './side';
import type { BadgeMaps, CatalogRow, VerdictFilter } from './types';

function VersionDelta({ current, latest }: { current?: string; latest?: string }) {
  if (!current && !latest) return null;
  return (
    <span className="md-ver-delta">
      <span className="md-ver-delta__cur">{current || '—'}</span>
      <span className="md-ver-delta__arrow" aria-hidden>
        →
      </span>
      <span className="md-ver-delta__next">{latest || '—'}</span>
    </span>
  );
}

function impactRowTitle(
  row: Record<string, unknown> | null | undefined,
  catalogById: Map<string, CatalogRow>,
  showTechNames: boolean,
): string {
  if (!row) return 'Unknown';
  if (showTechNames) return str(row.mod_id || row.display_name, 'Unknown');
  if (row.display_name) return str(row.display_name);
  const mod = catalogById.get(str(row.mod_id));
  if (mod) return modDisplayName(mod, false);
  return str(row.mod_id, 'Unknown');
}

function ModUpdateDetailPanel({
  row,
  mod,
  showTechNames,
  factsMods,
  onSelectMod,
  catalogById,
}: {
  row: Record<string, unknown> | null;
  mod: CatalogRow | undefined;
  showTechNames: boolean;
  factsMods: Record<string, unknown>[];
  onSelectMod?: (id: string) => void;
  catalogById: Map<string, CatalogRow>;
}) {
  if (!row) {
    return (
      <aside className="md-detail md-detail--empty" role="complementary" aria-label="Update details">
        <EmptyState title="Select an update">
          Pick a mod on the left to see pack impact, co-updates, and Modrinth links.
        </EmptyState>
      </aside>
    );
  }

  const name = mod ? modDisplayName(mod, showTechNames) : str(row.title || row.mod_id);
  const verdict = str(row.impact_verdict, 'unknown');
  const blockers = Array.isArray(row.blockers) ? (row.blockers as Record<string, unknown>[]) : [];
  const coUpdates = Array.isArray(row.co_updates) ? (row.co_updates as Record<string, unknown>[]) : [];
  const dependents = Array.isArray(row.dependents) ? (row.dependents as Record<string, unknown>[]) : [];
  const updateUrl = str(
    row.modrinth_compatible_url ||
      mod?.modrinth_compatible_url ||
      mod?.modrinth_cta_url ||
      mod?.modrinth_url,
  );
  const hasLinks = mod ? modLinkEntries(mod).length > 0 : !!updateUrl;

  return (
    <aside className="md-detail" role="complementary" aria-label={`${name} update`}>
      <header className="md-detail__head">
        <div className="md-detail__title-row">
          <ModIcon url={modIconUrl(mod)} name={name} size={44} />
          <div className="md-detail__titles">
            <h2 className="md-detail__title">{name}</h2>
            <p className="md-detail__sub">
              <span className="md-detail__id">{str(row.mod_id)} · </span>
              <VersionDelta
                current={str(row.current_version) || undefined}
                latest={str(row.latest_compatible) || undefined}
              />
              <StatusPill tone={VERDICT_TONE[verdict] ?? 'neutral'}>
                {VERDICT_LABEL[verdict] || 'Unknown'}
              </StatusPill>
            </p>
          </div>
        </div>
      </header>
      <div className="md-detail__body">
        <div className="md-detail__block">
          <h3>Impact</h3>
          <div className={`md-impact md-impact--${verdict}`}>
            <div className="md-impact__top">
              <span className="md-impact__verdict">{VERDICT_LABEL[verdict] || 'Unknown'}</span>
              {row.confidence ? (
                <span className="md-impact__confidence">{str(row.confidence)} confidence</span>
              ) : null}
            </div>
            <p className="md-impact__summary">
              {str(row.impact_summary, 'No impact summary for this update.')}
            </p>
          </div>
        </div>

        {blockers.length ? (
          <div className="md-detail__block">
            <h3>Will break / blockers</h3>
            <ul className="md-simple-list">
              {blockers.map((b, i) => (
                <li key={`${b.mod_id}-${i}`}>
                  <strong>{impactRowTitle(b, catalogById, showTechNames)}</strong>
                  <span className="text-wt-text-low">
                    {[
                      !showTechNames && b.display_name && b.mod_id && b.display_name !== b.mod_id
                        ? str(b.mod_id)
                        : null,
                      str(b.detail),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <StatusPill
                    tone={b.kind === 'conflict' || b.kind === 'need_install' ? 'danger' : 'warn'}
                  >
                    {str(b.kind, 'issue').replace(/_/g, ' ')}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {coUpdates.length || row.related_pair ? (
          <div className="md-detail__block">
            <h3>Update together</h3>
            {row.related_pair ? (
              <p className="md-drawer__desc">
                Paired with{' '}
                <strong>
                  {impactRowTitle(
                    {
                      mod_id: row.related_pair,
                      display_name: catalogById.get(str(row.related_pair))
                        ? modDisplayName(catalogById.get(str(row.related_pair))!, showTechNames)
                        : null,
                    },
                    catalogById,
                    showTechNames,
                  )}
                </strong>{' '}
                — update both jars together.
              </p>
            ) : null}
            {coUpdates.length ? (
              <ul className="md-simple-list">
                {coUpdates.map((c, i) => (
                  <li key={`${c.mod_id}-${i}`}>
                    <strong>{impactRowTitle(c, catalogById, showTechNames)}</strong>
                    <span className="text-wt-text-low">
                      {[c.current ? `installed ${c.current}` : null, str(c.detail)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {dependents.length ? (
          <div className="md-detail__block">
            <h3>Mods that depend on this</h3>
            <div className="md-badges">
              {dependents.map((d) => (
                <Button
                  key={str(d.mod_id)}
                  kind="default"
                  onClick={() => {
                    const id = str(d.mod_id);
                    if (onSelectMod) onSelectMod(id);
                    else navigate({ tab: 'mods', view: 'overview', mod: id });
                  }}
                >
                  {impactRowTitle(d, catalogById, showTechNames)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {mod?.modrinth_description ? (
          <div className="md-detail__block">
            <h3>About</h3>
            <p className="md-drawer__desc">{str(mod.modrinth_description)}</p>
          </div>
        ) : null}

        <div className="md-detail__block">
          <h3>Links</h3>
          {mod && hasLinks ? (
            <ModLinkCluster mod={mod} layout="stack" />
          ) : updateUrl ? (
            <ModLinkChip href={updateUrl} label="Modrinth" />
          ) : (
            <p className="text-sm text-wt-text-low">No external links for this mod.</p>
          )}
        </div>

        <ActionRow>
          <Button
            kind="default"
            onClick={() => navigate({ tab: 'mods', view: 'overview', mod: str(row.mod_id) })}
          >
            Open in Overview
          </Button>
          {updateUrl ? (
            <Button kind="primary" onClick={() => window.open(updateUrl, '_blank', 'noopener')}>
              Open update on Modrinth
            </Button>
          ) : null}
        </ActionRow>

        <ModDepsSection
          modId={str(row.mod_id)}
          factsMods={factsMods}
          onSelectMod={onSelectMod}
        />
      </div>
    </aside>
  );
}

export function UpdatesTab({
  modrinthUpdates,
  factsMods,
  runningMods,
  badgeMaps,
  showTechNames,
  search,
  onSearch,
  initialModId,
  modrinthLookupEnabled,
}: {
  modrinthUpdates: Record<string, unknown>[];
  factsMods: Record<string, unknown>[];
  runningMods: Record<string, unknown> | null;
  badgeMaps: BadgeMaps;
  showTechNames: boolean;
  search: string;
  onSearch: (v: string) => void;
  initialModId: string | null;
  modrinthLookupEnabled: boolean | undefined;
}) {
  const PAGE_SIZE = 40;
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<VerdictFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seedApplied, setSeedApplied] = useState(false);
  const [seedFor, setSeedFor] = useState<string | null>(null);

  if (initialModId !== seedFor) {
    setSeedFor(initialModId);
    setSeedApplied(false);
  }

  const catalogById = useMemo(() => {
    const rows = buildCatalogRows(runningMods, factsMods, badgeMaps);
    const map = new Map<string, CatalogRow>();
    for (const r of rows) map.set(r.id, r);
    return map;
  }, [runningMods, factsMods, badgeMaps]);

  const updates = Array.isArray(modrinthUpdates) ? modrinthUpdates : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return updates.filter((u) => {
      const verdict = str(u.impact_verdict, 'unknown');
      if (filter !== 'all' && verdict !== filter) return false;
      if (!q) return true;
      const mod = catalogById.get(str(u.mod_id));
      const title = str(u.title || mod?.display_name || u.mod_id).toLowerCase();
      return (
        title.includes(q) ||
        str(u.mod_id).toLowerCase().includes(q) ||
        str(mod?.modrinth_slug).toLowerCase().includes(q)
      );
    });
  }, [updates, search, filter, catalogById]);

  useEffect(() => {
    setPage(0);
  }, [search, filter]);

  // Deep-link (?mod=) must win over the default first-row selection.
  useEffect(() => {
    if (!filtered.length && !updates.length) {
      if (selectedId) setSelectedId(null);
      return;
    }

    if (initialModId && !seedApplied) {
      const inFiltered = filtered.some((u) => str(u.mod_id) === initialModId);
      const inAll = updates.some((u) => str(u.mod_id) === initialModId);
      if (inFiltered || inAll) {
        if (filter !== 'all') setFilter('all');
        if (search.trim()) onSearch('');
        setSelectedId(initialModId);
        setSeedApplied(true);
        return;
      }
      if (updates.length) setSeedApplied(true);
    }

    if (selectedId && filtered.some((u) => str(u.mod_id) === selectedId)) return;
    if (selectedId && initialModId === selectedId && updates.some((u) => str(u.mod_id) === selectedId)) {
      return;
    }
    if (filtered.length) setSelectedId(str(filtered[0].mod_id));
    else if (selectedId) setSelectedId(null);
  }, [
    filter,
    filtered,
    initialModId,
    onSearch,
    search,
    seedApplied,
    selectedId,
    updates,
  ]);

  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const selectedRow = filtered.find((u) => u.mod_id === selectedId) || null;
  const selectedMod = selectedRow ? catalogById.get(str(selectedRow.mod_id)) : undefined;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rangeStart = filtered.length ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(filtered.length, (page + 1) * PAGE_SIZE);

  if (!updates.length && !badgeMaps.hasFacts) {
    return (
      <div className="md-empty">
        <EmptyState title="No Modrinth data yet">
          Run a Modrinth scan from Mods → Modrinth to detect outdated jars and pack impact — no
          legacy report required.
        </EmptyState>
        <Button kind="primary" onClick={() => navigate({ tab: 'mods', view: 'modrinth' })}>
          Open Modrinth tab
        </Button>
      </div>
    );
  }

  if (modrinthLookupEnabled === false) {
    return (
      <div className="md-empty">
        <EmptyState title="Modrinth lookup is off">
          Enable Modrinth lookup in Settings → Monitoring, then run a scan from Mods → Modrinth.
          Watchtower never downloads jars — it only checks impact and links you to Modrinth.
        </EmptyState>
        <Button kind="default" onClick={() => navigate({ tab: 'settings', panel: 'integrations' })}>
          Open Settings
        </Button>
      </div>
    );
  }

  if (!updates.length) {
    return (
      <EmptyState title="All looked-up mods look current">
        No loader/MC-compatible Modrinth updates were flagged in the latest scan.
      </EmptyState>
    );
  }

  return (
    <div className="md-updates">
      <div className="md-chrome">
        <ModsSearch
          id="mods-updates-search"
          value={search}
          onChange={onSearch}
          placeholder="Search updates…"
          aria-label="Search updates"
        />
        <Segmented options={UPDATE_VERDICT_FILTERS} value={filter} onChange={setFilter} />
        <span className="md-chrome__count">
          <span>
            {updates.length} update{updates.length === 1 ? '' : 's'}
          </span>
          <span className="md-chrome__sep" aria-hidden>
            ·
          </span>
          <span>
            Showing {rangeStart}–{rangeEnd} of {filtered.length}
            {filter !== 'all' || search.trim() ? ' (filtered)' : ''}
          </span>
        </span>
      </div>
      <div className="md-split">
        <div className="md-list">
          {!filtered.length ? (
            <div className="md-list__empty">
              <EmptyState title="No matching updates">
                Try another verdict filter or clear the search. {updates.length} update
                {updates.length === 1 ? '' : 's'} still available.
              </EmptyState>
            </div>
          ) : (
            <div className="md-catalog" role="listbox" aria-label="Updates">
              {paginated.map((u) => {
                const mod = catalogById.get(str(u.mod_id));
                const name = mod
                  ? modDisplayName(mod, showTechNames)
                  : str(u.title || u.mod_id);
                const verdict = str(u.impact_verdict, 'unknown');
                const active = selectedId === u.mod_id;
                return (
                  <div
                    key={str(u.mod_id)}
                    className={`md-catalog__row${active ? ' is-selected' : ''}`}
                    role="option"
                    aria-selected={active}
                    tabIndex={0}
                    onClick={() => setSelectedId(str(u.mod_id))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(str(u.mod_id));
                      }
                    }}
                  >
                    <ModIcon url={modIconUrl(mod)} name={name} />
                    <div className="md-catalog__main">
                      <span className="md-catalog__name">{name}</span>
                      <VersionDelta
                        current={str(u.current_version) || undefined}
                        latest={str(u.latest_compatible) || undefined}
                      />
                    </div>
                    <div className="md-badges">
                      {u.related_pair ? <StatusPill tone="info">pair</StatusPill> : null}
                      <StatusPill tone={VERDICT_TONE[verdict] ?? 'neutral'}>
                        {VERDICT_LABEL[verdict] || 'Unknown'}
                      </StatusPill>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div
            className={`md-pager${!filtered.length ? ' is-empty' : ''}`}
            aria-hidden={!filtered.length}
          >
            <Button kind="ghost" disabled={page <= 0 || totalPages <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <span>
              {filtered.length ? `Page ${page + 1} / ${Math.max(1, totalPages)}` : 'Page —'}
            </span>
            <Button
              kind="ghost"
              disabled={page >= totalPages - 1 || totalPages <= 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
        <ModUpdateDetailPanel
          row={selectedRow}
          mod={selectedMod}
          showTechNames={showTechNames}
          factsMods={factsMods}
          catalogById={catalogById}
          onSelectMod={(id) => {
            const idx = filtered.findIndex((u) => u.mod_id === id);
            if (idx >= 0) {
              setSelectedId(id);
              setPage(Math.floor(idx / PAGE_SIZE));
            } else {
              navigate({ tab: 'mods', view: 'overview', mod: id });
            }
          }}
        />
      </div>
    </div>
  );
}
