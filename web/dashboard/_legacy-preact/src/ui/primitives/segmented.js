import { html } from '../../lib/preact.js';

export function Segmented({ options = [], value, onChange, size = 'md', className = '' }) {
  const wrapCls = ['ui-seg', `ui-seg--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return html`
    <div class=${wrapCls} role="radiogroup">
      ${options.map(
        (opt) => html`
          <button
            key=${opt.value}
            type="button"
            class=${[
              'ui-seg__opt',
              opt.value === value ? 'ui-seg__opt--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="radio"
            aria-checked=${opt.value === value}
            onClick=${() => onChange && onChange(opt.value)}
          >
            ${opt.label}
          </button>
        `,
      )}
    </div>
  `;
}

export default Segmented;
