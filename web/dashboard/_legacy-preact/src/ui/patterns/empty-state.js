import { html } from '../../lib/preact.js';

/**
 * EmptyState({ icon, title, body, description, action })
 * `description` is accepted as an alias for `body`.
 */
export function EmptyState({ icon, title, body, description, action }) {
  const copy = body ?? description;
  return html`
    <div class="ui-empty-state">
      ${icon && html`<div class="ui-empty-state__icon">${icon}</div>`}
      ${title && html`<h3 class="ui-empty-state__title">${title}</h3>`}
      ${copy && html`<p class="ui-empty-state__body">${copy}</p>`}
      ${action && html`<div class="ui-empty-state__action">${action}</div>`}
    </div>
  `;
}

export default EmptyState;
