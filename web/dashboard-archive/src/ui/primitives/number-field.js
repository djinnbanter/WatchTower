import { html } from '../../lib/preact.js';

export function NumberField({
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
  min,
  max,
  step,
  ...rest
}) {
  const fieldCls = [
    'ui-field',
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
          type="number"
          value=${value}
          placeholder=${placeholder}
          disabled=${disabled || null}
          min=${min}
          max=${max}
          step=${step}
          onInput=${onInput}
          onChange=${onChange}
          ...${rest}
        />
      </div>
      ${hintText
        ? html`<span class="ui-field__hint">${hintText}</span>`
        : null}
    </div>
  `;
}

export default NumberField;
