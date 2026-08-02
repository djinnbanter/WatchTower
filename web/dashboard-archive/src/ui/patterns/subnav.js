import { html } from '../../lib/preact.js';

/**
 * Subnav({ options, value, onChange, density })
 * options: [{value, label}]
 * density: 'default' | 'nested' (tighter second-level tabs)
 */
export function Subnav({ options = [], value, onChange, density = 'default' }) {
  const cls = [
    'ui-subnav',
    density === 'nested' ? 'ui-subnav--nested' : '',
  ].filter(Boolean).join(' ');

  return html`
    <nav class=${cls} aria-label="Sub-navigation">
      ${options.map((opt) => html`
        <button
          key=${opt.value}
          class=${['ui-subnav__option', value === opt.value ? 'ui-subnav__option--active' : ''].filter(Boolean).join(' ')}
          aria-current=${value === opt.value ? 'page' : undefined}
          onClick=${() => onChange?.(opt.value)}
        >
          ${opt.label}
        </button>
      `)}
    </nav>
  `;
}

export default Subnav;
