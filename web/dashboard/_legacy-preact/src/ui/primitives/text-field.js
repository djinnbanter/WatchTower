import { html } from '../../lib/preact.js';
import { Icon } from '../icons.js';

export function TextField({
  label,
  value,
  onInput,
  onChange,
  placeholder,
  hint,
  error,
  mono = false,
  id,
  disabled = false,
  className = '',
  icon,
  type = 'text',
  inputRef,
  ...rest
}) {
  const fieldCls = [
    'ui-field',
    error ? 'ui-field--error' : '',
    mono ? 'ui-field--mono' : '',
    icon ? 'ui-field--icon' : '',
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
        ${icon
          ? html`<span class="ui-field__icon"><${Icon} name=${icon} size=${14} /></span>`
          : null}
        <input
          class="ui-field__input"
          id=${id}
          aria-label=${!id && label ? label : null}
          type=${type}
          value=${value}
          placeholder=${placeholder}
          disabled=${disabled || null}
          onInput=${onInput}
          onChange=${onChange}
          ref=${inputRef}
          ...${rest}
        />
      </div>
      ${hintText
        ? html`<span class="ui-field__hint">${hintText}</span>`
        : null}
    </div>
  `;
}

export default TextField;
