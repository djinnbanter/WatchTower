import { html } from '../../lib/preact.js';
import { useCallback } from '../../lib/preact.js';

export function Toggle({ checked = false, onChange, label, disabled = false, id }) {
  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        !disabled && onChange && onChange(!checked);
      }
    },
    [checked, disabled, onChange],
  );

  const wrapCls = [
    'ui-toggle',
    disabled ? 'ui-toggle--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return html`
    <div
      class=${wrapCls}
      role="switch"
      aria-checked=${checked}
      aria-disabled=${disabled || null}
      onClick=${() => !disabled && onChange && onChange(!checked)}
    >
      <div
        class="ui-toggle__track"
        id=${id}
        tabIndex=${disabled ? -1 : 0}
        onKeyDown=${handleKey}
      >
        <div class="ui-toggle__thumb"></div>
      </div>
      ${label
        ? html`<span class="ui-toggle__label">${label}</span>`
        : null}
    </div>
  `;
}

export default Toggle;
