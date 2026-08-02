import { html } from '../../lib/preact.js';

/**
 * CompareBars — period-over-period comparison bars.
 * rows: [{ label, current, previous, format? }]
 */
export function CompareBars({
  rows = [],
  currentLabel = 'Current',
  previousLabel = 'Previous',
  className = '',
}) {
  return html`
    <div class=${`ui-compare ${className}`.trim()}>
      <div class="ui-compare__legend">
        <span class="ui-compare__legend-item">
          <span class="ui-compare__swatch ui-compare__swatch--current"></span>
          ${currentLabel}
        </span>
        <span class="ui-compare__legend-item">
          <span class="ui-compare__swatch ui-compare__swatch--previous"></span>
          ${previousLabel}
        </span>
      </div>
      ${rows.map((row, i) => {
        const cur = Number(row.current) || 0;
        const prev = Number(row.previous) || 0;
        const max = Math.max(cur, prev, 0.001);
        const curPct = (cur / max) * 100;
        const prevPct = (prev / max) * 100;
        const delta = prev !== 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0);
        const deltaTone = delta >= 0 ? 'var(--ui-ok)' : 'var(--ui-danger)';
        const fmt = row.format || ((v) => v.toLocaleString());

        return html`
          <div key=${row.label || i} class="ui-compare__row">
            <span class="ui-compare__label">${row.label}</span>
            <div class="ui-compare__track" role="img" aria-label=${`${row.label}: ${fmt(cur)} vs ${fmt(prev)}`}>
              <div class="ui-compare__a" style=${{ width: `${curPct}%` }} />
              <div class="ui-compare__b" style=${{ width: `${prevPct}%` }} />
            </div>
            <span class="ui-compare__delta" style=${{ color: deltaTone }}>
              ${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%
            </span>
          </div>
        `;
      })}
    </div>
  `;
}

export default CompareBars;
