import type { ReactNode } from 'react';
import { CATALOG_FILTERS, CATALOG_SORT_OPTIONS } from './catalog';
import { ModsSearch, Segmented } from './components';
import { ModsRestartBanner } from './mods-restart-banner';
import { UPDATE_VERDICT_FILTERS } from './side';
import type { CatalogFilter, CatalogSort, VerdictFilter } from './types';

export function SuiteChrome({
  filter,
  onFilter,
  search,
  onSearch,
  sort,
  onSort,
  verdictFilter,
  onVerdictFilter,
  mode = 'library',
  toolbarExtra,
}: {
  filter: CatalogFilter;
  onFilter: (f: CatalogFilter) => void;
  search: string;
  onSearch: (v: string) => void;
  sort: CatalogSort;
  onSort: (s: CatalogSort) => void;
  verdictFilter?: VerdictFilter;
  onVerdictFilter?: (v: VerdictFilter) => void;
  /** `updates` hides All/Enabled chips and shows verdict filters. */
  mode?: 'library' | 'updates';
  /** Optional toolbar row (e.g. Apply N updates). */
  toolbarExtra?: ReactNode;
}) {
  const updatesMode = mode === 'updates';
  return (
    <div className="md-suite-chrome-wrap">
      <ModsRestartBanner />
      <div
        className="md-chrome md-suite-chrome"
        role="toolbar"
        aria-label={updatesMode ? 'Updates filters' : 'Library filters'}
      >
        {updatesMode ? (
          onVerdictFilter && verdictFilter ? (
            <Segmented
              options={UPDATE_VERDICT_FILTERS}
              value={verdictFilter}
              onChange={onVerdictFilter}
            />
          ) : null
        ) : (
          <Segmented options={CATALOG_FILTERS} value={filter} onChange={onFilter} />
        )}
        <ModsSearch
          id={updatesMode ? 'mods-updates-search' : 'mods-library-search'}
          value={search}
          onChange={onSearch}
          placeholder={updatesMode ? 'Search updates…' : 'Search by name, id, or slug…'}
          aria-label={updatesMode ? 'Search updates' : 'Search mods'}
        />
        <label className="md-sort">
          <span className="md-sort__label">Sort</span>
          <select
            className="md-sort__select"
            value={sort}
            onChange={(e) => onSort(e.target.value as CatalogSort)}
            aria-label="Sort mods"
          >
            {CATALOG_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {toolbarExtra ? <div className="md-suite-chrome__extra">{toolbarExtra}</div> : null}
    </div>
  );
}
