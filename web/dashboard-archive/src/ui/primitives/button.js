import { html } from '../../lib/preact.js';
import { Spinner } from './spinner.js';

export function Button({
  kind = 'neutral',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  onClick,
  children,
  className = '',
  type = 'button',
  ...rest
}) {
  const cls = [
    'ui-btn',
    `ui-btn--${kind}`,
    `ui-btn--${size}`,
    loading ? 'ui-btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return html`
    <button
      type=${type}
      class=${cls}
      disabled=${(disabled || loading) || null}
      onClick=${onClick}
      ...${rest}
    >
      ${icon && !loading ? html`<${icon} size=${size === 'sm' ? 14 : 16} />` : null}
      ${loading ? html`<${Spinner} size=${size === 'sm' ? 14 : 16} />` : null}
      ${children}
    </button>
  `;
}

export default Button;
