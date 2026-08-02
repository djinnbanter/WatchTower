import { html } from '../../lib/preact.js';
import { Icon } from '../icons.js';

export function IconButton({
  icon,
  label,
  size = 'md',
  active = false,
  disabled = false,
  onClick,
  className = '',
  ...rest
}) {
  const cls = [
    'ui-icon-btn',
    size === 'sm' ? 'ui-icon-btn--sm' : '',
    active ? 'ui-icon-btn--active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconSize = size === 'sm' ? 14 : 16;

  return html`
    <button
      type="button"
      class=${cls}
      aria-label=${label}
      aria-pressed=${active}
      disabled=${disabled || null}
      onClick=${onClick}
      ...${rest}
    >
      <${Icon} name=${icon} size=${iconSize} />
    </button>
  `;
}

export default IconButton;
