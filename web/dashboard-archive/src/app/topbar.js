import { html } from '../lib/preact.js';
import { ui, setUi, live, overviewMeta } from '../state/stores.js';
import { formatReportFreshnessShort } from '../domain/labels.js';
import { Icon } from '../ui/icons.js';
import { Kbd } from '../ui/primitives/kbd.js';
import { InboxBell } from '../features/inbox/popover.js';

function StatusChip({ tone, dot, pulse, children, title }) {
  return html`
    <span
      class=${'ui-topbar__chip ui-topbar__chip--' + tone}
      title=${title || null}
    >
      ${dot
        ? html`<span
            class=${'ui-topbar__chip-dot ui-topbar__chip-dot--' + tone + (pulse ? ' ui-live-pulse is-live' : '')}
            aria-hidden="true"
          ></span>`
        : null}
      <span class="ui-topbar__chip-text">${children}</span>
    </span>
  `;
}

/**
 * Application top bar — hostname, short status chips, Search (primary), inbox.
 */
export function TopBar() {
  const { connectionDown, mobileNavOpen, paletteOpen } = ui.value;
  const envelope = live.value.envelope;
  const meta = overviewMeta.value.data;

  const hostname =
    envelope?.hostname ||
    meta?.hostname ||
    'Unknown host';

  const freshness = formatReportFreshnessShort(meta);

  function openPalette() {
    setUi({ paletteOpen: true });
  }

  function toggleMobileNav() {
    setUi({ mobileNavOpen: !ui.value.mobileNavOpen });
  }

  return html`
    <header class="ui-topbar" role="banner" data-tour="topbar">
      <button
        type="button"
        class="ui-topbar__menu-btn"
        onClick=${toggleMobileNav}
        aria-label=${mobileNavOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded=${mobileNavOpen}
        aria-controls="rail-drawer"
      >
        <${Icon} name=${mobileNavOpen ? 'x' : 'menu'} size=${20} />
      </button>

      <div class="ui-topbar__identity">
        <span class="ui-topbar__hostname">${hostname}</span>
        <div class="ui-topbar__chips">
          <${StatusChip}
            tone=${connectionDown ? 'muted' : 'ok'}
            dot=${true}
            pulse=${!connectionDown}
            title=${connectionDown ? 'Connection lost' : 'Connected'}
          >${connectionDown ? 'Offline' : 'Live'}</${StatusChip}>
          <${StatusChip}
            tone=${freshness.tone}
            title=${freshness.title || null}
          >${freshness.label}</${StatusChip}>
        </div>
      </div>

      <div class="ui-topbar__spacer" aria-hidden="true"></div>

      <button
        type="button"
        class=${'ui-topbar__palette-btn' + (paletteOpen ? ' ui-topbar__palette-btn--open' : '')}
        onClick=${openPalette}
        aria-label="Open command palette (Ctrl K)"
        aria-pressed=${paletteOpen}
        title="Command palette"
        data-tour="palette-trigger"
      >
        <${Icon} name="search" size=${16} />
        <span class="ui-topbar__palette-hint">Search</span>
        <${Kbd}>Ctrl K</${Kbd}>
      </button>

      <${InboxBell} />
    </header>
  `;
}

export default TopBar;
