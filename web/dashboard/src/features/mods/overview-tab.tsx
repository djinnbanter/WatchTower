import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '@/api/client';
import { useCanWrite } from '@/app/permissions';
import { navigate } from '@/app/router';
import { asRecord, num, str } from '@/lib/utils';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import {
  CATALOG_FILTERS,
  CATALOG_SORT_OPTIONS,
  buildCatalogRows,
  sideBadgeSpecsForRow,
  sortCatalogRows,
} from './catalog';
import { ModDetailPanel, ModIcon, ModsSearch, Segmented } from './components';
import { modIconUrl } from './modrinth';
import { matchesCatalogFilter, modDisplayName } from './side';
import type { BadgeMaps, CatalogFilter, CatalogRow, CatalogSort } from './types';

const VIEW_ONLY_TITLE = 'Your account can view Watchtower but not change it';
const VIRTUALIZE_THRESHOLD = 50;
const CATALOG_ROW_ESTIMATE = 56;

function CatalogRowButton({
  m,
  active,
  showTechNames,
  badgeMaps,
  onSelect,
}: {
  m: CatalogRow;
  active: boolean;
  showTechNames: boolean;
  badgeMaps: BadgeMaps;
  onSelect: (m: CatalogRow) => void;
}) {
  const name = modDisplayName(m, showTechNames);
  const badges = sideBadgeSpecsForRow(m, badgeMaps);
  return (
    <button
      type="button"
      data-mod-id={m.id}
      className={`md-catalog__row${active ? ' is-selected' : ''}`}
      aria-pressed={active}
      onClick={() => onSelect(m)}
    >
      <ModIcon url={modIconUrl(m)} name={name} />
      <div className="md-catalog__main">
        <span className="md-catalog__name">{name}</span>
        <span className="md-catalog__ver">
          {m.version ?? '—'}
          {showTechNames ? '' : ` · ${m.id}`}
        </span>
      </div>
      <div className="md-badges">
        {badges.map((b) => (
          <StatusPill key={b.key} tone={b.tone}>
            {b.label}
          </StatusPill>
        ))}
      </div>
    </button>
  );
}

function VirtualCatalogList({
  filtered,
  selected,
  showTechNames,
  badgeMaps,
  onSelect,
}: {
  filtered: CatalogRow[];
  selected: CatalogRow | null;
  showTechNames: boolean;
  badgeMaps: BadgeMaps;
  onSelect: (m: CatalogRow) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CATALOG_ROW_ESTIMATE,
    overscan: 12,
  });

  useEffect(() => {
    if (!selected?.id) return;
    const index = filtered.findIndex((m) => m.id === selected.id);
    if (index < 0) return;
    virtualizer.scrollToIndex(index, { align: 'auto' });
  }, [selected?.id, filtered, virtualizer]);

  return (
    <div className="md-catalog" role="list" aria-label="Mods" ref={parentRef}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const m = filtered[row.index];
          if (!m) return null;
          return (
            <div
              key={m.id}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start}px)`,
              }}
            >
              <CatalogRowButton
                m={m}
                active={selected?.id === m.id}
                showTechNames={showTechNames}
                badgeMaps={badgeMaps}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OverviewTab({
  runningMods,
  modsInventory,
  showTechNames,
  search,
  onSearch,
  badgeMaps,
  factsMods,
  initialModId,
  updateCount,
}: {
  runningMods: Record<string, unknown> | null;
  modsInventory: Record<string, unknown> | null;
  showTechNames: boolean;
  search: string;
  onSearch: (v: string) => void;
  badgeMaps: BadgeMaps;
  factsMods: Record<string, unknown>[];
  initialModId: string | null;
  updateCount: number;
}) {
  const canWrite = useCanWrite();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [sort, setSort] = useState<CatalogSort>(() => {
    try {
      const saved = localStorage.getItem('wt.modsSort');
      if (saved && CATALOG_SORT_OPTIONS.some((o) => o.value === saved)) return saved as CatalogSort;
    } catch {
      /* ignore */
    }
    return 'name';
  });
  const [selected, setSelected] = useState<CatalogRow | null>(null);
  const [seedApplied, setSeedApplied] = useState(false);
  const [seedFor, setSeedFor] = useState<string | null>(null);

  // Re-apply deep-link when ?mod= changes (e.g. another Changes row).
  if (initialModId !== seedFor) {
    setSeedFor(initialModId);
    setSeedApplied(false);
  }

  const scanM = useMutation({
    mutationFn: () => api.modsScan(true),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ops-cache'] });
    },
  });

  const catalog = useMemo(
    () => buildCatalogRows(runningMods, factsMods, badgeMaps),
    [runningMods, factsMods, badgeMaps],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = catalog.filter((m) => {
      if (!matchesCatalogFilter(m, filter, badgeMaps.hasFacts)) return false;
      if (!q) return true;
      return (
        (m.display_name ?? '').toLowerCase().includes(q) ||
        (m.id ?? '').toLowerCase().includes(q) ||
        String(m.modrinth_slug ?? '')
          .toLowerCase()
          .includes(q)
      );
    });
    return sortCatalogRows(rows, sort, showTechNames);
  }, [catalog, search, filter, sort, showTechNames, badgeMaps.hasFacts]);

  function handleSortChange(value: CatalogSort) {
    setSort(value);
    try {
      localStorage.setItem('wt.modsSort', value);
    } catch {
      /* ignore */
    }
  }

  function selectModById(id: string) {
    const hit = filtered.find((m) => m.id === id) ?? catalog.find((m) => m.id === id);
    if (hit) setSelected(hit);
  }

  // Deep-link (?mod=) must win over the default first-row selection.
  useEffect(() => {
    if (!filtered.length && !catalog.length) {
      if (selected) setSelected(null);
      return;
    }

    if (initialModId && !seedApplied) {
      const hit =
        filtered.find((m) => m.id === initialModId) ??
        catalog.find((m) => m.id === initialModId);
      if (hit) {
        if (filter !== 'all') setFilter('all');
        if (search.trim()) onSearch('');
        setSelected(hit);
        setSeedApplied(true);
        return;
      }
      // Catalog may still be loading; wait. Once catalog is populated and
      // the id is missing, stop retrying so we fall through to default select.
      if (catalog.length) setSeedApplied(true);
    }

    if (selected && filtered.some((m) => m.id === selected.id)) return;
    if (selected && catalog.some((m) => m.id === selected.id) && initialModId === selected.id) {
      // Keep a deep-linked selection visible in the detail panel even if a
      // later search filter temporarily hides it from the list.
      return;
    }
    if (filtered.length) setSelected(filtered[0]);
    else if (selected) setSelected(null);
  }, [
    catalog,
    filtered,
    filter,
    initialModId,
    onSearch,
    search,
    seedApplied,
    selected,
  ]);

  const virtualize = filtered.length > VIRTUALIZE_THRESHOLD;

  useEffect(() => {
    if (virtualize || !selected?.id) return;
    const el = document.querySelector(
      `.md-catalog__row[data-mod-id="${CSS.escape(selected.id)}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected?.id, virtualize]);

  if (!catalog.length) {
    return (
      <div className="md-empty">
        <EmptyState title="No mod list yet">
          Continuous Scanning fills mods_light in the background. Tap Scan now if the list is still
          empty.
        </EmptyState>
        <Button
          kind="primary"
          disabled={!canWrite || scanM.isPending}
          title={canWrite ? undefined : VIEW_ONLY_TITLE}
          onClick={() => scanM.mutate()}
        >
          {scanM.isPending ? 'Scanning…' : 'Scan now'}
        </Button>
      </div>
    );
  }

  const countLabel = `${num(asRecord(runningMods).count, catalog.length)} mods`;
  const inventoryBit = modsInventory?.tldr ? ` · ${str(modsInventory.tldr)}` : '';
  const showingLabel =
    filter !== 'all' || search.trim()
      ? `${filtered.length} shown (filtered)`
      : `${filtered.length} shown`;

  return (
    <div className="md-overview">
      <div className="md-chrome">
        <ModsSearch
          id="mods-overview-search"
          value={search}
          onChange={onSearch}
          placeholder="Search by name, id, or slug…"
          aria-label="Search mods"
        />
        <Segmented options={CATALOG_FILTERS} value={filter} onChange={setFilter} />
        <label className="md-sort">
          <span className="md-sort__label">Sort</span>
          <select
            className="md-sort__select"
            value={sort}
            onChange={(e) => handleSortChange(e.target.value as CatalogSort)}
            aria-label="Sort mods"
          >
            {CATALOG_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <span className="md-chrome__count">
          <span>
            {countLabel}
            {inventoryBit}
          </span>
          <span className="md-chrome__sep" aria-hidden>
            ·
          </span>
          <span>{showingLabel}</span>
          {updateCount > 0 ? (
            <>
              <span className="md-chrome__sep" aria-hidden>
                ·
              </span>
              <button
                type="button"
                className="md-link"
                onClick={() => navigate({ tab: 'mods', view: 'updates' })}
              >
                {updateCount} with updates
              </button>
            </>
          ) : null}
        </span>
      </div>

      <div className="md-split">
        <div className="md-list">
          {!filtered.length ? (
            <div className="md-list__empty">
              <EmptyState title="No mods match">
                Try another filter or clear the search. {catalog.length} mod
                {catalog.length === 1 ? '' : 's'} still in the catalog.
              </EmptyState>
            </div>
          ) : virtualize ? (
            <VirtualCatalogList
              filtered={filtered}
              selected={selected}
              showTechNames={showTechNames}
              badgeMaps={badgeMaps}
              onSelect={setSelected}
            />
          ) : (
            <div className="md-catalog" role="list" aria-label="Mods">
              {filtered.map((m) => (
                <CatalogRowButton
                  key={m.id}
                  m={m}
                  active={selected?.id === m.id}
                  showTechNames={showTechNames}
                  badgeMaps={badgeMaps}
                  onSelect={setSelected}
                />
              ))}
            </div>
          )}
        </div>
        <ModDetailPanel
          mod={selected}
          showTechNames={showTechNames}
          badgeMaps={badgeMaps}
          factsMods={factsMods}
          onSelectMod={selectModById}
        />
      </div>
    </div>
  );
}
