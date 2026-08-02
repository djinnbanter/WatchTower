import { html } from '../../lib/preact.js';

export function Card({ tone, children, className = '', padding = '16', style: extraStyle, ...rest }) {
  const cls = ['ui-card', tone ? `ui-card--${tone}` : '', className]
    .filter(Boolean)
    .join(' ');

  const style = typeof extraStyle === 'string'
    ? `padding:var(--ui-sp-${padding});${extraStyle}`
    : {
        padding: `var(--ui-sp-${padding})`,
        ...(extraStyle || {}),
      };

  return html`
    <div class=${cls} style=${style} ...${rest}>${children}</div>
  `;
}

export default Card;
