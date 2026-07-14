import { html } from '../../lib/preact.js';
import { useComputed } from '../../lib/signals.js';
import { ui } from '../../state/stores.js';
import { removeToast } from '../../state/actions.js';

const TONE_ICONS = {
  ok: html`<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>`,
  success: html`<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>`,
  warn: html`<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"/></svg>`,
  error: html`<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.343 13.657A8 8 0 1113.657 2.343 8 8 0 012.343 13.657zM6.03 4.97a.75.75 0 00-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 101.06 1.06L8 9.06l1.97 1.97a.75.75 0 101.06-1.06L9.06 8l1.97-1.97a.75.75 0 10-1.06-1.06L8 6.94 6.03 4.97z"/></svg>`,
  info: html`<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-6.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM6.5 7.75A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 110-2 1 1 0 010 2z"/></svg>`,
};

const CLOSE_ICON = html`<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M2.47 2.47a.75.75 0 011.06 0L7 5.94l3.47-3.47a.75.75 0 111.06 1.06L8.06 7l3.47 3.47a.75.75 0 11-1.06 1.06L7 8.06l-3.47 3.47a.75.75 0 01-1.06-1.06L5.94 7 2.47 3.53a.75.75 0 010-1.06z"/></svg>`;

function Toast({ id, message, tone }) {
  return html`
    <div class=${`ui-toast ui-toast--${tone || 'info'}`} role="alert" aria-live="assertive">
      <span class="ui-toast__icon">
        ${TONE_ICONS[tone] || TONE_ICONS.info}
      </span>
      <span class="ui-toast__message">${message}</span>
      <button
        class="ui-toast__dismiss"
        aria-label="Dismiss"
        onClick=${() => removeToast(id)}
      >
        ${CLOSE_ICON}
      </button>
    </div>
  `;
}

/**
 * ToastHost — reads ui.toasts from store, renders stack, auto-dismiss handled by addToast.
 */
export function ToastHost() {
  const toasts = useComputed(() => ui.value.toasts);

  if (!toasts.value.length) return null;

  return html`
    <div class="ui-toast-host" aria-label="Notifications">
      ${toasts.value.map((t) => html`
        <${Toast} key=${t.id} id=${t.id} message=${t.message} tone=${t.tone} />
      `)}
    </div>
  `;
}

export default ToastHost;
