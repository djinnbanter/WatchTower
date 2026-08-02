import { html } from '../../lib/preact.js';

export function Progress({ value = 0, max = 100, tone, className = '' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const cls = ['ui-progress', tone ? `ui-progress--${tone}` : '', className]
    .filter(Boolean)
    .join(' ');

  return html`
    <div
      class=${cls}
      role="progressbar"
      aria-valuenow=${value}
      aria-valuemin=${0}
      aria-valuemax=${max}
    >
      <div class="ui-progress__bar" style="width: ${pct}%"></div>
    </div>
  `;
}

export default Progress;
