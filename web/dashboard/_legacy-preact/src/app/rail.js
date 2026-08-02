import { html } from '../lib/preact.js';
import { ui, setUi } from '../state/stores.js';
import { set as persistSet } from '../state/persist.js';
import { GROUPS, getPagesByGroup } from './registry.js';
import { navigate } from './router.js';
import { Icon } from '../ui/icons.js';
import { isEmbedded } from '../api/index.js';
import { logout } from '../api/endpoints.js';
import { cycleTheme, cycleSkin } from '../theme/theme.js';
import { ReportControls } from './report-controls.js';

// Nav groups shown in main area (not system bottom)
const MAIN_GROUPS = ['monitor', 'triage', 'ops'];

const LOGO_SRC = 'assets/watchtower-icon-simple.png';

/** WatchTower brand mark (assets/watchtower-icon-simple.png) */
function WatchTowerMark({ size = 30 }) {
  return html`
    <img
      class="ui-rail__brand-icon"
      src=${LOGO_SRC}
      width=${size}
      height=${size}
      alt=""
      decoding="async"
      aria-hidden="true"
    />
  `;
}

function badgeToneClass(count) {
  if (!(count > 0)) return '';
  return count <= 2 ? ' ui-rail__badge--warn' : ' ui-rail__badge--danger';
}

function RailItem({ page, active, expanded }) {
  function handleClick(e) {
    e.preventDefault();
    navigate(page.id);
    if (ui.value.mobileNavOpen) setUi({ mobileNavOpen: false });
  }

  const badgeCount = typeof page.badge === 'function' ? page.badge() : 0;
  const tone = badgeToneClass(badgeCount);

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
          ? html`<span class=${`ui-rail__badge${tone}`} aria-label=${`${badgeCount} items`}>${badgeCount > 9 ? '9+' : badgeCount}</span>`
          : null}
      </span>
      ${expanded
        ? html`<span class="ui-rail__item-label">${page.title}</span>`
        : null}
      ${expanded && badgeCount > 0
        ? html`<span class=${`ui-rail__badge ui-rail__badge--inline${tone}`} aria-label=${`${badgeCount} items`}>${badgeCount > 9 ? '9+' : badgeCount}</span>`
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
 * @param {{ forceExpanded?: boolean }} [props] — mobile drawer always expanded
 */
export function Rail({ forceExpanded = false } = {}) {
  const { railExpanded, route } = ui.value;
  const expanded = forceExpanded || railExpanded;
  const activeTab = route?.tab || 'overview';
  const embedded = isEmbedded();

  function toggleRail() {
    if (forceExpanded) return;
    const next = !railExpanded;
    setUi({ railExpanded: next });
    persistSet('railExpanded', next);
  }

  function handleTheme() {
    const next = cycleTheme();
    setUi({ theme: next });
  }

  function handleSkin() {
    const next = cycleSkin();
    setUi({ skin: next });
  }

  return html`
    <nav
      class=${'ui-rail' + (expanded ? '' : ' ui-rail--collapsed')}
      aria-label="Main navigation"
      data-tour="rail"
    >
      <div
        class="ui-rail__brand"
        title=${expanded ? null : 'WatchTower'}
      >
        <span class="ui-rail__brand-plate" aria-hidden="true"></span>
        <span class="ui-rail__brand-mark">
          <${WatchTowerMark} size=${expanded ? 30 : 32} />
        </span>
        ${expanded
          ? html`
            <span class="ui-rail__brand-text">
              <span class="ui-rail__wordmark">WatchTower</span>
              <span class="ui-alpha-badge">Alpha</span>
              <span class="ui-rail__tagline">Server ops</span>
            </span>
          `
          : null}
      </div>

      <div class="ui-rail__nav">
        ${MAIN_GROUPS.map((gid) => {
          const group = GROUPS.find((g) => g.id === gid);
          return group
            ? html`<${RailGroup}
                key=${gid}
                group=${group}
                activeTab=${activeTab}
                expanded=${expanded}
              />`
            : null;
        })}
      </div>

      <div class="ui-rail__reports" data-tour="report-controls">
        ${expanded
          ? html`<span class="ui-rail__reports-label">Help</span>`
          : null}
        <${ReportControls} compact=${!expanded} />
      </div>

      <div class="ui-rail__bottom">
        ${expanded
          ? html`<span class="ui-rail__group-label ui-rail__bottom-label">System</span>`
          : null}

        ${getPagesByGroup('system').filter((p) => p.rail !== false).map((page) => html`
          <${RailItem}
            key=${page.id}
            page=${page}
            active=${activeTab === page.id}
            expanded=${expanded}
          />
        `)}

        <div class="ui-rail__tools">
          <button
            type="button"
            class="ui-rail__tool-btn"
            onClick=${handleTheme}
            title="Cycle theme"
            aria-label="Cycle colour theme"
          >
            <${Icon} name="sun" size=${18} />
            ${expanded ? html`<span class="ui-rail__tool-label">Theme</span>` : null}
          </button>

          <button
            type="button"
            class="ui-rail__tool-btn"
            onClick=${handleSkin}
            title="Cycle look: Aero ? Classic (Sass)"
            aria-label="Cycle look skin"
          >
            <${Icon} name="sparkles" size=${18} />
            ${expanded ? html`<span class="ui-rail__tool-label">Skin</span>` : null}
          </button>

          ${embedded
            ? html`
              <button
                type="button"
                class="ui-rail__tool-btn"
                onClick=${handleLogout}
                title="Sign out"
                aria-label="Sign out"
              >
                <${Icon} name="log-out" size=${18} />
                ${expanded ? html`<span class="ui-rail__tool-label">Sign out</span>` : null}
              </button>
            `
            : null}

          ${!forceExpanded
            ? html`
              <button
                type="button"
                class="ui-rail__tool-btn ui-rail__tool-btn--collapse"
                onClick=${toggleRail}
                aria-label=${expanded ? 'Collapse navigation' : 'Expand navigation'}
                title=${expanded ? 'Collapse sidebar' : 'Expand sidebar'}
                data-tour="rail-collapse"
              >
                <${Icon} name=${expanded ? 'chevron-left' : 'chevron-right'} size=${16} />
                ${expanded ? html`<span class="ui-rail__tool-label">Collapse</span>` : null}
              </button>
            `
            : null}
        </div>
      </div>
    </nav>
  `;
}

export default Rail;
