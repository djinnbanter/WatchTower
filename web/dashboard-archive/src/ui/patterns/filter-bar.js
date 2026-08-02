import { html } from '../../lib/preact.js';
import { TextField } from '../primitives/text-field.js';
import { Segmented } from '../primitives/segmented.js';

/**
 * FilterBar({ search, onSearch, placeholder, filters, filterValue, onFilterChange, resultCount })
 * Search input + optional Segmented filter + result count.
 */
export function FilterBar({
  search = '',
  onSearch,
  placeholder = 'Search…',
  filters,
  filterValue,
  onFilterChange,
  resultCount,
}) {
  return html`
    <div class="ui-filter-bar">
      <div class="ui-filter-bar__search">
        <${TextField}
          value=${search}
          onInput=${(e) => onSearch?.(e.target.value)}
          placeholder=${placeholder}
          clearable
          onClear=${() => onSearch?.('')}
        />
      </div>
      ${filters && html`
        <div class="ui-filter-bar__filters">
          <${Segmented}
            options=${filters}
            value=${filterValue}
            onChange=${onFilterChange}
            size="sm"
          />
        </div>
      `}
      ${resultCount != null && html`
        <span class="ui-filter-bar__count">${resultCount} result${resultCount !== 1 ? 's' : ''}</span>
      `}
    </div>
  `;
}

export default FilterBar;
