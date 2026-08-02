import { html } from '../../lib/preact.js';

/**
 * KeyValue({ items, columns })
 * items: [{key, value}]
 */
export function KeyValue({ items = [], columns = 1 }) {
  const cols = Math.max(1, Math.min(3, columns));
  return html`
    <dl class=${`ui-key-value ui-key-value--${cols}`}>
      ${items.map(({ key, value }) => html`
        <div key=${key} class="ui-key-value__item">
          <dt class="ui-key-value__key">${key}</dt>
          <dd class="ui-key-value__value">${value ?? '—'}</dd>
        </div>
      `)}
    </dl>
  `;
}

export default KeyValue;
