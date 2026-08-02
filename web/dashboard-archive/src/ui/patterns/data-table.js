import { html } from '../../lib/preact.js';

/**
 * DataTable({ columns, rows, sort, onSort, rowKey, density, empty, onRowClick, stickyHeader })
 * columns: [{key, label, align, width, sortable, render}]
 * Semantic table, aria-sort, hover rows.
 */
export function DataTable({
  columns = [],
  rows = [],
  sort,
  onSort,
  rowKey = 'id',
  density = 40,
  empty,
  onRowClick,
  stickyHeader = false,
}) {
  const densityClass = density <= 32 ? 'ui-data-table--density-compact' : '';
  const stickyClass = stickyHeader ? 'ui-data-table--sticky-header' : '';

  function getSortAttr(col) {
    if (!col.sortable || !sort || sort.key !== col.key) return undefined;
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  function handleSort(col) {
    if (!col.sortable || !onSort) return;
    const dir = sort?.key === col.key && sort?.dir === 'asc' ? 'desc' : 'asc';
    onSort({ key: col.key, dir });
  }

  return html`
    <div class=${['ui-data-table', densityClass, stickyClass].filter(Boolean).join(' ')}>
      <table>
        <thead>
          <tr>
            ${columns.map((col) => html`
              <th
                key=${col.key}
                aria-sort=${getSortAttr(col)}
                class=${col.align ? `ui-align-${col.align}` : ''}
                style=${col.width ? { width: col.width } : {}}
                onClick=${col.sortable ? () => handleSort(col) : undefined}
              >
                ${col.label}
                ${col.sortable && html`
                  <span class="ui-data-table__sort-icon" aria-hidden="true">
                    ${sort?.key === col.key
                      ? sort.dir === 'asc' ? '↑' : '↓'
                      : '↕'
                    }
                  </span>
                `}
              </th>
            `)}
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? html`
                <tr>
                  <td colspan=${columns.length} class="ui-data-table__empty">
                    ${empty || 'No results'}
                  </td>
                </tr>
              `
            : rows.map((row) => html`
                <tr
                  key=${row[rowKey] ?? JSON.stringify(row)}
                  class=${onRowClick ? 'ui-data-table__row--clickable' : ''}
                  onClick=${onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex=${onRowClick ? 0 : undefined}
                  onKeyDown=${onRowClick
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } }
                    : undefined
                  }
                >
                  ${columns.map((col) => html`
                    <td
                      key=${col.key}
                      class=${col.align ? `ui-align-${col.align}` : ''}
                    >
                      ${col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  `)}
                </tr>
              `)
          }
        </tbody>
      </table>
    </div>
  `;
}

export default DataTable;
