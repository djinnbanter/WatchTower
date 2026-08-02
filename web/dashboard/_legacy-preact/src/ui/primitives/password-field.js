import { html } from '../../lib/preact.js';
import { useState } from '../../lib/preact.js';
import { Icon } from '../icons.js';

export function PasswordField({
  label,
  value,
  onInput,
  onChange,
  placeholder,
  hint,
  error,
  id,
  disabled = false,
  className = '',
  ...rest
}) {
  const [revealed, setRevealed] = useState(false);

  const fieldCls = [
    'ui-field',
    error ? 'ui-field--error' : '',
    'ui-field--has-suffix',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const hintText = error || hint;

  return html`
    <div class=${fieldCls}>
      ${label
        ? html`<label class="ui-field__label" for=${id}>${label}</label>`
        : null}
      <div class="ui-field__wrap">
        <input
          class="ui-field__input"
          id=${id}
          aria-label=${!id && label ? label : null}
          type=${revealed ? 'text' : 'password'}
          value=${value}
          placeholder=${placeholder}
          disabled=${disabled || null}
          onInput=${onInput}
          onChange=${onChange}
          autocomplete="current-password"
          ...${rest}
        />
        <span class="ui-field__suffix">
          <button
            type="button"
            class="ui-icon-btn ui-icon-btn--sm"
            aria-label=${revealed ? 'Hide password' : 'Show password'}
            onClick=${() => setRevealed(!revealed)}
            disabled=${disabled || null}
            tabIndex=${-1}
          >
            <${Icon} name=${revealed ? 'eye-off' : 'eye'} size=${14} />
          </button>
        </span>
      </div>
      ${hintText
        ? html`<span class="ui-field__hint">${hintText}</span>`
        : null}
    </div>
  `;
}

export default PasswordField;
