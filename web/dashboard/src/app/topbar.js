import { html } from '../lib/preact.js';
import { ui, setUi, live, overviewMeta } from '../state/stores.js';
import { formatReportFreshness } from '../domain/labels.js';
import { Icon } from '../ui/icons.js';
import { Kbd } from '../ui/primitives/kbd.js';
import { InboxBell } from '../features/inbox/popover.js';

function ConnectionDot({ down }) {
  return html`
    <span
      class=${'ui-topbar__dot' + (down ? ' ui-topbar__dot--down' : ' ui-topbar__dot--up')}
      title=${down ? 'Connection lost' : 'Connected'}
      aria-label=${down ? 'Connection lost' : 'Connected'}
    ></span>
  `;
}

/**
 * Application top bar — hostname, freshness, connection, palette button,
 * inbox bell, and mobile-menu toggle.
 */
export function TopBar() {
  const { connectionDown } = ui.value;
  const envelope = live.value.envelope;
  const meta = overviewMeta.value.data;

  const hostname =
    envelope?.hostname ||
    meta?.hostname ||
    'WatchTower';

  const freshness = formatReportFreshness(meta);

  function openPalette() {
    setUi({ paletteOpen: true });
  }

  function toggleMobileNav() {
    setUi({ mobileNavOpen: !ui.value.mobileNavOpen });
  }

  return html`
    <header class="ui-topbar" role="banner" data-tour="topbar">
      <!-- Mobile menu toggle (hidden on desktop) -->
      <button
        class="ui-topbar__menu-btn"
        onClick=${toggleMobileNav}
        aria-label="Toggle navigation"
        aria-expanded=${ui.value.mobileNavOpen}
      >
        <${Icon} name="menu" size=${20} />
      </button>

      <!-- Hostname + freshness -->
      <div class="ui-topbar__identity">
        <span class="ui-topbar__hostname">${hostname}</span>
        ${freshness
          ? html`<span class="ui-topbar__freshness">${freshness}</span>`
          : null}
      </div>

      <div class="ui-topbar__spacer" aria-hidden="true"></div>

      <!-- Connection status -->
      <${ConnectionDot} down=${connectionDown} />

      <!-- Inbox bell -->
      <${InboxBell} />

      <!-- Palette trigger -->
      <button
        class="ui-topbar__palette-btn"
        onClick=${openPalette}
        aria-label="Open command palette (Ctrl K)"
        title="Command palette"
      >
        <${Icon} name="search" size=${16} />
        <span class="ui-topbar__palette-hint">Search</span>
        <${Kbd}>Ctrl K</${Kbd}>
      </button>
    </header>
  `;
}

export default TopBar;
