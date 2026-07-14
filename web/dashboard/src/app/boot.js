import { html } from '../lib/preact.js';

const PHASE_LABELS = {
  boot: 'Starting up…',
  auth: 'Checking session…',
  wizard: 'Preparing setup…',
  ready: 'Loading…',
};

/**
 * Full-screen boot/loading screen shown while the app initialises.
 *
 * @param {{ phase: string, message?: string }} props
 */
export function BootScreen({ phase = 'boot', message }) {
  const label = message || PHASE_LABELS[phase] || 'Loading…';

  return html`
    <div class="ui-boot" role="status" aria-live="polite">
      <div class="ui-boot__inner">
        <div class="ui-boot__wordmark">
          <svg class="ui-boot__icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="40" height="40" rx="10" fill="var(--ui-accent)" opacity="0.12"/>
            <path
              d="M14 16h20M14 24h14M14 32h8"
              stroke="var(--ui-accent)"
              stroke-width="2.5"
              stroke-linecap="round"
            />
            <circle cx="36" cy="30" r="7" fill="var(--ui-accent)" opacity="0.9"/>
            <path d="M33 30l2 2 4-4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="ui-boot__name">WatchTower</span>
        </div>
        <p class="ui-boot__message">${label}</p>
        <div class="ui-boot__progress" aria-hidden="true">
          <div class="ui-boot__progress-bar"></div>
        </div>
      </div>
    </div>
  `;
}

export default BootScreen;
