import { html } from '../../lib/preact.js';

export function Badge({ tone = 'neutral', pulse = false, children, className = '' }) {
  const cls = [
    'ui-badge',
    `ui-badge--${tone}`,
    pulse ? 'ui-badge--pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return html`<span class=${cls}>${children}</span>`;
}

export default Badge;
