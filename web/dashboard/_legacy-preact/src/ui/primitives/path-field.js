import { html } from '../../lib/preact.js';
import { Icon } from '../icons.js';

export function PathField({
  value,
  onInput,
  onChange,
  onBrowse,
  browseDisabled = false,
  label,
  hint,
  error,
  id,
  disabled = false,
  className = '',
  placeholder = '/path/to/directory',
  ...rest
}) {
  const fieldCls = [
    'ui-field',
    'ui-field--path',
    'ui-field--mono',
    error ? 'ui-field--error' : '',
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
          type="text"
          value=${value}
          placeholder=${placeholder}
          disabled=${disabled || null}
          onInput=${onInput}
          onChange=${onChange}
          spellcheck="false"
          autocomplete="off"
          ...${rest}
        />
        ${onBrowse
          ? html`
            <span class="ui-field__browse">
              <button
                type="button"
                class="ui-btn ui-btn--neutral ui-btn--sm"
                onClick=${onBrowse}
                disabled=${(disabled || browseDisabled) || null}
              >
                <${Icon} name="folder" size=${14} />
                Browse
              </button>
            </span>`
          : null}
      </div>
      ${hintText
        ? html`<span class="ui-field__hint">${hintText}</span>`
        : null}
    </div>
  `;
}

export default PathField;
