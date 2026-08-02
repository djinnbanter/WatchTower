import { html } from '../../lib/preact.js';
import { Icon } from '../icons.js';

/**
 * StatusPill({ label, value, icon, tone, onClick })
 * tone: ok | warn | danger | neutral | info
 */
export function StatusPill({
  label,
  value,
  icon,
  tone = 'neutral',
  onClick,
  className = '',
}) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  const cls = [
    'ui-status-pill',
    `ui-status-pill--${tone}`,
    interactive ? 'ui-status-pill--interactive' : '',
    className,
  ].filter(Boolean).join(' ');

  return html`
    <${Tag}
      type=${interactive ? 'button' : undefined}
      class=${cls}
      onClick=${onClick}
    >
      <span class="ui-status-pill__lead">
        ${icon && html`<span class="ui-status-pill__icon"><${Icon} name=${icon} size=${15} /></span>`}
        <span class="ui-status-pill__label">${label}</span>
      </span>
      <span class="ui-status-pill__value">${value}</span>
    </${Tag}>
  `;
}

/**
 * StatusPillStrip — row of StatusPills
 */
export function StatusPillStrip({ pills = [], className = '' }) {
  if (!pills.length) return null;
  return html`
    <div class=${`ui-status-pill-strip ${className}`.trim()}>
      ${pills.map((p) => html`
        <${StatusPill} key=${p.label} ...${p} />
      `)}
    </div>
  `;
}

export default StatusPill;
