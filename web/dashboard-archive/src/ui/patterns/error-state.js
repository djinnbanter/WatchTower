import { html } from '../../lib/preact.js';
import { Button } from '../primitives/button.js';

/**
 * ErrorState({ title, detail, retry })
 */
export function ErrorState({ title = 'Something went wrong', detail, retry }) {
  return html`
    <div class="ui-error-state">
      <div class="ui-error-state__icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-5a.75.75 0 001.5 0v-4a.75.75 0 00-1.5 0v4zm.75-7.25a.75.75 0 100 1.5.75.75 0 000-1.5z" clip-rule="evenodd"/>
        </svg>
      </div>
      <h3 class="ui-error-state__title">${title}</h3>
      ${detail && html`<p class="ui-error-state__detail">${detail}</p>`}
      ${retry && html`
        <div class="ui-error-state__retry">
          <${Button} tone="neutral" size="sm" onClick=${retry}>Retry</${Button}>
        </div>
      `}
    </div>
  `;
}

export default ErrorState;
