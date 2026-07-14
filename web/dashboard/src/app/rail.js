import { html } from '../lib/preact.js';
import { ui, setUi, auth } from '../state/stores.js';
import { set as persistSet } from '../state/persist.js';
import { GROUPS, getPagesByGroup } from './registry.js';
import { navigate } from './router.js';
import { Icon } from '../ui/icons.js';
import { isEmbedded } from '../api/index.js';
import { logout } from '../api/endpoints.js';
import { cycleTheme } from '../theme/theme.js';
import { ReportControls } from './report-controls.js';

// Nav groups shown in main area (not system bottom)
const MAIN_GROUPS = ['monitor', 'triage', 'ops'];

const LOGO_SRC = 'assets/watchtower-icon-simple.png';

/** WatchTower brand mark (assets/watchtower-icon-simple.png) */
function WatchTowerMark({ size = 24 }) {
  return html`
    <img
      class="ui-rail__logo-icon"
      src=${LOGO_SRC}
      width=${size}
      height=${size}
      style=${`width:${size}px;height:${size}px`}
      alt=""
      decoding="async"
      aria-hidden="true"
    />
  `;
}

function RailItem({ page, active, expanded }) {
  function handleClick(e) {
    e.preventDefault();
    navigate(page.id);
    // Close mobile nav if open
    if (ui.value.mobileNavOpen) setUi({ mobileNavOpen: false });
  }

  const badgeCount = typeof page.badge === 'function' ? page.badge() : 0;

  return html`
    <a
      href=${'?tab=' + page.id}
      class=${'ui-rail__item' + (active ? ' ui-rail__item--active' : '')}
      aria-current=${active ? 'page' : null}
      title=${expanded ? null : page.title}
      onClick=${handleClick}
    >
      <span class="ui-rail__item-icon">
        <${Icon} name=${page.icon || 'layout-dashboard'} size=${18} />
        ${!expanded && badgeCount > 0
          ? html`<span class="ui-rail__badge" aria-label=${`${badgeCount} items`}>${badgeCount > 9 ? '9+' : badgeCount}</span>`
          : null}
      </span>
      ${expanded
        ? html`<span class="ui-rail__item-label">${page.title}</span>`
        : null}
      ${expanded && badgeCount > 0
        ? html`<span class="ui-rail__badge ui-rail__badge--inline" aria-label=${`${badgeCount} items`}>${badgeCount > 9 ? '9+' : badgeCount}</span>`
        : null}
    </a>
  `;
}

function RailGroup({ group, activeTab, expanded }) {
  const pages = getPagesByGroup(group.id).filter((p) => p.rail !== false);
  if (!pages.length) return null;

  return html`
    <div class="ui-rail__group">
      ${expanded
        ? html`<span class="ui-rail__group-label">${group.label}</span>`
        : null}
      ${pages.map((page) => html`
        <${RailItem}
          key=${page.id}
          page=${page}
          active=${activeTab === page.id}
          expanded=${expanded}
        />
      `)}
    </div>
  `;
}

async function handleLogout() {
  try {
    await logout();
  } catch { /* ignore */ }
  location.reload();
}

/**
 * Navigation rail — sidebar with grouped page links, theme toggle, collapse.
 */
export function Rail() {
  const { railExpanded, route } = ui.value;
  const activeTab = route?.tab || 'overview';
  const embedded = isEmbedded();

  function toggleRail() {
    const next = !railExpanded;
    setUi({ railExpanded: next });
    persistSet('railExpanded', next);
  }

  function handleTheme() {
    const next = cycleTheme();
    setUi({ theme: next });
  }

  return html`
    <nav
      class=${'ui-rail' + (railExpanded ? '' : ' ui-rail--collapsed')}
      aria-label="Main navigation"
      data-tour="rail"
    >
      <!-- Logo / wordmark -->
      <div
        class="ui-rail__logo"
        title=${railExpanded ? null : 'WatchTower'}
      >
        <span class="ui-rail__logo-plate" aria-hidden="true"></span>
        <span class="ui-rail__logo-mark">
          <${WatchTowerMark} size=${railExpanded ? 24 : 28} />
        </span>
        ${railExpanded
          ? html`<span class="ui-rail__wordmark">WatchTower</span>`
          : null}
      </div>

      <!-- Main nav groups -->
      <div class="ui-rail__nav">
        ${MAIN_GROUPS.map((gid) => {
          const group = GROUPS.find((g) => g.id === gid);
          return group
            ? html`<${RailGroup}
                key=${gid}
                group=${group}
                activeTab=${activeTab}
                expanded=${railExpanded}
              />`
            : null;
        })}
      </div>

      <!-- Report selector / Run Report / support bundle -->
      <div class="ui-rail__reports" data-tour="report-controls">
        ${railExpanded
          ? html`<span class="ui-rail__reports-label">Reports</span>`
          : null}
        <${ReportControls} compact=${!railExpanded} />
      </div>

      <!-- Bottom system cluster -->
      <div class="ui-rail__bottom">
        ${getPagesByGroup('system').filter((p) => p.rail !== false).map((page) => html`
          <${RailItem}
            key=${page.id}
            page=${page}
            active=${activeTab === page.id}
            expanded=${railExpanded}
          />
        `)}

        <!-- Theme cycle -->
        <button
          class="ui-rail__item ui-rail__theme-btn"
          onClick=${handleTheme}
          title="Cycle theme"
          aria-label="Cycle colour theme"
        >
          <span class="ui-rail__item-icon">
            <${Icon} name="sun" size=${18} />
          </span>
          ${railExpanded ? html`<span class="ui-rail__item-label">Theme</span>` : null}
        </button>

        <!-- Logout (embedded only) -->
        ${embedded
          ? html`
            <button
              class="ui-rail__item ui-rail__logout-btn"
              onClick=${handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <span class="ui-rail__item-icon">
                <${Icon} name="log-out" size=${18} />
              </span>
              ${railExpanded ? html`<span class="ui-rail__item-label">Sign out</span>` : null}
            </button>
          `
          : null}

        <!-- Collapse toggle -->
        <button
          class="ui-rail__toggle"
          onClick=${toggleRail}
          aria-label=${railExpanded ? 'Collapse navigation' : 'Expand navigation'}
          title=${railExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <span class="ui-rail__toggle-icon">
            <${Icon} name=${railExpanded ? 'chevron-left' : 'chevron-right'} size=${16} />
          </span>
          ${railExpanded ? html`<span class="ui-rail__toggle-label">Collapse</span>` : null}
        </button>
      </div>
    </nav>
  `;
}

export default Rail;
