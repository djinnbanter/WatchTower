import { html, useState, useRef } from '../../lib/preact.js';

/**
 * Heatmap({ rows, cols, values, colorScale, cellLabel, onCellFocus, idPrefix })
 * CSS grid. Keyboard arrow navigation.
 * values: 2D array [row][col] or flat array (row-major).
 * colorScale: (value) => string CSS color
 */
export function Heatmap({
  rows = [],
  cols = [],
  values = [],
  colorScale,
  cellLabel,
  onCellFocus,
  idPrefix = 'hm',
}) {
  const [focusRow, setFocusRow] = useState(0);
  const [focusCol, setFocusCol] = useState(0);
  const gridRef = useRef(null);

  const nRows = rows.length || 1;
  const nCols = cols.length || 1;

  function getValue(r, c) {
    if (Array.isArray(values[r])) return values[r][c];
    return values[r * nCols + c];
  }

  const defaultColorScale = (v) => {
    if (v == null) return 'var(--ui-bg2)';
    const norm = Math.max(0, Math.min(1, v));
    const alpha = 0.1 + norm * 0.8;
    return `rgba(76, 158, 234, ${alpha})`;
  };

  const scale = colorScale || defaultColorScale;

  function handleKeyDown(e, r, c) {
    let nr = r, nc = c;
    if (e.key === 'ArrowDown') { nr = Math.min(nRows - 1, r + 1); }
    else if (e.key === 'ArrowUp') { nr = Math.max(0, r - 1); }
    else if (e.key === 'ArrowRight') { nc = Math.min(nCols - 1, c + 1); }
    else if (e.key === 'ArrowLeft') { nc = Math.max(0, c - 1); }
    else return;
    e.preventDefault();
    setFocusRow(nr);
    setFocusCol(nc);
    const cellId = `${idPrefix}-cell-${nr}-${nc}`;
    gridRef.current?.querySelector(`#${cellId}`)?.focus();
  }

  const style = {
    gridTemplateColumns: rows.length
      ? `auto repeat(${nCols}, 1fr)`
      : `repeat(${nCols}, 1fr)`,
  };

  return html`
    <div class="ui-heatmap">
      <div class="ui-heatmap__grid" ref=${gridRef} style=${style}>
        ${cols.length > 0 && html`
          ${rows.length > 0 && html`<div></div>`}
          ${cols.map((col) => html`
            <div key=${col} class="ui-heatmap__col-label">${col}</div>
          `)}
        `}
        ${Array.from({ length: nRows }, (_, r) => html`
          ${rows.length > 0 && html`
            <div class="ui-heatmap__row-label">${rows[r]}</div>
          `}
          ${Array.from({ length: nCols }, (_, c) => {
            const v = getValue(r, c);
            const label = cellLabel ? cellLabel(v, r, c) : (v != null ? String(v) : '');
            return html`
              <div
                key=${`${r}-${c}`}
                id=${`${idPrefix}-cell-${r}-${c}`}
                class="ui-heatmap__cell"
                tabIndex=${0}
                role="gridcell"
                aria-label=${`${rows[r] || r}, ${cols[c] || c}: ${label}`}
                style=${{ backgroundColor: scale(v) }}
                onFocus=${() => { setFocusRow(r); setFocusCol(c); onCellFocus?.({ r, c, value: v }); }}
                onKeyDown=${(e) => handleKeyDown(e, r, c)}
              >
                ${label}
              </div>
            `;
          })}
        `)}
      </div>
    </div>
  `;
}

export default Heatmap;
