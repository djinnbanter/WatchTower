import { html, useState, useMemo, useEffect } from '../../lib/preact.js';
import { opsCache, ui, reports, settings } from '../../state/stores.js';
import { navigate } from '../../app/router.js';
import { scanMods, addToast } from '../../state/actions.js';
import { forensicsStatus } from '../../api/endpoints.js';
import { Page, Section, EmptyState, ListRow, Subnav } from '../../ui/patterns/index.js';
import { Button, Badge, Toggle, Segmented } from '../../ui/primitives/index.js';
import { TextField } from '../../ui/primitives/text-field.js';
import { Icon } from '../../ui/icons.js';
import { toTree } from '../../domain/mod-graph.js';
import { ModrinthTab, ModrinthOverviewBanner } from './modrinth-tab.js';

const SUBNAV = [
  { value: 'overview', label: 'Overview' },
  { value: 'updates', label: 'Updates' },
  { value: 'conflicts', label: 'Conflicts' },
  { value: 'log-errors', label: 'Log errors' },
  { value: 'changes', label: 'Changes' },
  { value: 'modrinth', label: 'Modrinth' },
  { value: 'forensics', label: 'Forensics' },
];

const CLIENT_SIDE_IDS = new Set([
  'sodium', 'embeddium', 'oculus', 'iris', 'entity_texture_features',
  'playeranimator', 'xaeros_minimap', 'xaeros_worldmap', 'journeymap',
  'appleskin', 'jei', 'inventorysorter', 'trashslot', 'craftingtweaks',
  'controlling', 'searchables', 'jade', 'carryon', 'sound_physics_remastered',
]);

const CLIENT_BUCKETS = new Set([
  'likely_removable', 'client_library', 'uncertain', 'test_remove',
]);

const BUCKET_TONE = {
  likely_removable: 'danger',
  client_library: 'info',
  uncertain: 'warn',
  test_remove: 'neutral',
  server_required: 'ok',
};

const SIDE_COPY = {
  server_required: {
    role: 'Server',
    title: 'Required on the server',
    tone: 'ok',
    reason: 'Server-required gameplay or library mod.',
    advice: 'Keep this jar on dedicated servers — removing it will break gameplay or other mods.',
  },
  likely_removable: {
    role: 'Client',
    title: 'Likely client-only',
    tone: 'danger',
    reason: 'Typically client-only on a dedicated server.',
    advice: 'Safe to remove from server mods/ on a dedicated host — keep a backup of the jar.',
  },
  client_library: {
    role: 'Client',
    title: 'Client library',
    tone: 'info',
    reason: 'Client-oriented library — may be required by other mods.',
    advice: 'Do not remove unless you know no other mods need it.',
  },
  uncertain: {
    role: 'Hybrid',
    title: 'May run on both sides',
    tone: 'warn',
    reason: 'May provide server features — review before removing.',
    advice: 'Check mod documentation; some features may run on dedicated servers.',
  },
  test_remove: {
    role: 'Uncertain',
    title: 'Needs a careful test',
    tone: 'warn',
    reason: 'Insufficient signals — test removal one mod at a time.',
    advice: 'Remove one jar, restart, and verify before removing more.',
  },
};

const CATALOG_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'client', label: 'Client' },
  { value: 'server', label: 'Server' },
  { value: 'unresolved', label: 'Unresolved' },
];

const CATALOG_SORT_OPTIONS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'id', label: 'Mod ID' },
  { value: 'side', label: 'Server → Client' },
  { value: 'updates', label: 'Updates first' },
  { value: 'version', label: 'Version' },
];

const CATALOG_PAGE_SIZE = 25;

const UPDATE_VERDICT_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'safe', label: 'Safe' },
  { value: 'caution', label: 'Caution' },
  { value: 'break', label: 'Break' },
  { value: 'unknown', label: 'Unknown' },
];

const VERDICT_TONE = {
  safe: 'ok',
  caution: 'warn',
  break: 'danger',
  unknown: 'neutral',
};

const VERDICT_LABEL = {
  safe: 'Safe',
  caution: 'Caution',
  break: 'Break',
  unknown: 'Unknown',
};

function modDisplayName(mod, showTechNames) {
  if (showTechNames) return mod.id ?? mod.mod_id ?? mod.display_name ?? '?';
  return mod.modrinth_title || mod.display_name || mod.id || mod.mod_id || '?';
}

function bucketLabel(bucket) {
  return (bucket ?? '').replace(/_/g, '-');
}

function sideSummaryForMod(mod, badgeMaps) {
  const clientRow = (badgeMaps.clientOnlyById ?? new Map()).get(mod.id);
  const bucket = clientRow?.bucket || mod.client_bucket || mod.side_score || null;
  const signals = [
    ...(Array.isArray(mod.side_signals) ? mod.side_signals : []),
    ...(Array.isArray(clientRow?.signals) ? clientRow.signals : []),
  ].filter(Boolean);
  const uniqueSignals = [...new Set(signals)];

  if (bucket && SIDE_COPY[bucket]) {
    const base = SIDE_COPY[bucket];
    return {
      ...base,
      bucket,
      reason: clientRow?.reason || base.reason,
      advice: clientRow?.removal_advice || base.advice,
      confidence: clientRow?.confidence || null,
      signals: uniqueSignals,
    };
  }

  if (!badgeMaps.hasFacts && CLIENT_SIDE_IDS.has(mod.id)) {
    return {
      role: 'Client',
      title: 'Known client-side mod',
      tone: 'info',
      bucket: 'client',
      reason: 'Heuristic fallback — Scanning / Modrinth scores refine client vs server.',
      advice: 'Confirm with a Modrinth scan or docs before removing from the server.',
      confidence: 'low',
      signals: uniqueSignals,
    };
  }

  if (!mod.modrinth_url && !mod.side_score) {
    return {
      role: 'Unknown',
      title: 'Side not scored yet',
      tone: 'neutral',
      bucket: null,
      reason: 'No client/server score for this jar yet.',
      advice: 'Enable Modrinth lookup in Settings → Monitoring, then run a Modrinth scan for clearer side scoring.',
      confidence: null,
      signals: uniqueSignals,
    };
  }

  return {
    role: 'Unknown',
    title: 'No strong side signal',
    tone: 'neutral',
    bucket: null,
    reason: 'Watchtower did not classify this mod as clearly client or server.',
    advice: 'Treat it as needed until you verify in docs or a test world.',
    confidence: null,
    signals: uniqueSignals,
  };
}

function ModSideCallout({ summary }) {
  if (!summary) return null;
  return html`
    <div class=${`feat-mods-side feat-mods-side--${summary.tone}`}>
      <div class="feat-mods-side__top">
        <span class="feat-mods-side__role">${summary.role}</span>
        ${summary.confidence ? html`
          <span class="feat-mods-side__confidence">${summary.confidence} confidence</span>
        ` : null}
      </div>
      <p class="feat-mods-side__title">${summary.title}</p>
      <p class="feat-mods-side__reason">${summary.reason}</p>
      ${summary.advice ? html`<p class="feat-mods-side__advice">${summary.advice}</p>` : null}
      ${summary.signals?.length ? html`
        <div class="feat-mods-side__signals">
          ${summary.signals.map((s) => html`<${SideSignalChip} key=${s} signal=${s} />`)}
        </div>
      ` : null}
    </div>
  `;
}

/** Official Modrinth mark (Simple Icons path) — filled, brand-colored. */
function ModrinthMark({ size = 12 }) {
  return html`
    <svg
      class="feat-mods-signal__mr"
      xmlns="http://www.w3.org/2000/svg"
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12.252.004a11.78 11.768 0 0 0-8.92 3.73 11 10.999 0 0 0-2.17 3.11 11.37 11.359 0 0 0-1.16 5.169c0 1.42.17 2.5.6 3.77.24.759.77 1.899 1.17 2.529a12.3 12.298 0 0 0 8.85 5.639c.44.05 2.54.07 2.76.02.2-.04.22.1-.26-1.7l-.36-1.37-1.01-.06a8.5 8.489 0 0 1-5.18-1.8 5.34 5.34 0 0 1-1.3-1.26c0-.05.34-.28.74-.5a37.572 37.545 0 0 1 2.88-1.629c.03 0 .5.45 1.06.98l1 .97 2.07-.43 2.06-.43 1.47-1.47c.8-.8 1.48-1.5 1.48-1.52 0-.09-.42-1.63-.46-1.7-.04-.06-.2-.03-1.02.18-.53.13-1.2.3-1.45.4l-.48.15-.53.53-.53.53-.93.1-.93.07-.52-.5a2.7 2.7 0 0 1-.96-1.7l-.13-.6.43-.57c.68-.9.68-.9 1.46-1.1.4-.1.65-.2.83-.33.13-.099.65-.579 1.14-1.069l.9-.9-.7-.7-.7-.7-1.95.54c-1.07.3-1.96.53-1.97.53-.03 0-2.23 2.48-2.63 2.97l-.29.35.28 1.03c.16.56.3 1.16.31 1.34l.03.3-.34.23c-.37.23-2.22 1.3-2.84 1.63-.36.2-.37.2-.44.1-.08-.1-.23-.6-.32-1.03-.18-.86-.17-2.75.02-3.73a8.84 8.839 0 0 1 7.9-6.93c.43-.03.77-.08.78-.1.06-.17.5-2.999.47-3.039-.01-.02-.1-.02-.2-.03Zm3.68.67c-.2 0-.3.1-.37.38-.06.23-.46 2.42-.46 2.52 0 .04.1.11.22.16a8.51 8.499 0 0 1 2.99 2 8.38 8.379 0 0 1 2.16 3.449 6.9 6.9 0 0 1 .4 2.8c0 1.07 0 1.27-.1 1.73a9.37 9.369 0 0 1-1.76 3.769c-.32.4-.98 1.06-1.37 1.38-.38.32-1.54 1.1-1.7 1.14-.1.03-.1.06-.07.26.03.18.64 2.56.7 2.78l.06.06a12.07 12.058 0 0 0 7.27-9.4c.13-.77.13-2.58 0-3.4a11.96 11.948 0 0 0-5.73-8.578c-.7-.42-2.05-1.06-2.25-1.06Z"
      />
    </svg>
  `;
}

const MODRINTH_SIGNAL_LABELS = {
  'modrinth:server_required': 'Server required',
  'modrinth:client_only': 'Client only',
  'modrinth:optional_both': 'Both sides',
};

function humanizeSideSignal(raw) {
  const s = String(raw ?? '');
  if (MODRINTH_SIGNAL_LABELS[s]) return MODRINTH_SIGNAL_LABELS[s];
  if (s.startsWith('modrinth:')) {
    return s.slice('modrinth:'.length).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (s.startsWith('ecosystem:')) return `Ecosystem · ${s.slice(10)}`;
  if (s.startsWith('dependent_of:')) return `Depends on ${s.slice(13)}`;
  if (s === 'SERVER_REQUIRED_IDS') return 'Known server mod';
  if (s === 'log_client_refs') return 'Client refs in logs';
  if (s === 'bytecode_scan') return 'Bytecode scan';
  return s.replace(/_/g, ' ');
}

function SideSignalChip({ signal }) {
  const raw = String(signal ?? '');
  const fromModrinth = raw.startsWith('modrinth:');
  const label = humanizeSideSignal(raw);
  if (fromModrinth) {
    return html`
      <span
        class="ui-badge ui-badge--info feat-mods-signal feat-mods-signal--modrinth"
        title="Checked against Modrinth"
      >
        <${ModrinthMark} size=${12} />
        <span>${label}</span>
      </span>
    `;
  }
  return html`<${Badge} tone="neutral">${label}</${Badge}>`;
}

const LINK_META = {
  Modrinth: { icon: 'package' },
  Wiki: { icon: 'book' },
  Source: { icon: 'code' },
  Issues: { icon: 'bug' },
  Discord: { icon: 'users' },
};

function ModLinkChip({ href, label, quiet = false }) {
  if (!href) return null;
  const icon = LINK_META[label]?.icon;
  const externalHint = label === 'Modrinth' || label.startsWith('Open')
    ? 'Opens Modrinth in a new tab'
    : 'Opens in a new tab';
  return html`
    <a
      class=${`feat-mods-link-chip${quiet ? ' feat-mods-link-chip--quiet' : ''}`}
      href=${href}
      target="_blank"
      rel="noopener noreferrer"
      title=${externalHint}
      aria-label=${`${label} (${externalHint})`}
      onClick=${(e) => e.stopPropagation()}
    >
      ${icon ? html`<${Icon} name=${icon} size=${14} />` : null}
      <span>${label}</span>
      <${Icon} name="external-link" size=${12} className="feat-mods-link-chip__ext" />
    </a>
  `;
}

function modLinkEntries(mod) {
  return [
    [mod?.modrinth_compatible_url || mod?.modrinth_cta_url || mod?.modrinth_url, 'Modrinth'],
    [mod?.modrinth_wiki_url, 'Wiki'],
    [mod?.modrinth_source_url, 'Source'],
    [mod?.modrinth_issues_url, 'Issues'],
    [mod?.modrinth_discord_url, 'Discord'],
  ].filter(([href]) => href);
}

function ModLinkCluster({ mod, layout = 'inline' }) {
  const chips = modLinkEntries(mod);
  if (!chips.length) return null;
  return html`
    <div class=${layout === 'stack' ? 'feat-mods-link-grid' : 'feat-mods-catalog__links'} onClick=${(e) => e.stopPropagation()}>
      ${chips.map(([href, label]) => html`<${ModLinkChip} key=${label} href=${href} label=${label} />`)}
    </div>
  `;
}

function ModActionRow({ children }) {
  return html`<div class="feat-mods-action-row">${children}</div>`;
}

function ModIcon({ url, name }) {
  const [broken, setBroken] = useState(false);
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  if (!url || broken) {
    return html`<span class="feat-mods-catalog__icon feat-mods-catalog__icon--ph" aria-hidden="true">${letter}</span>`;
  }
  return html`<img
    class="feat-mods-catalog__icon"
    src=${url}
    alt=""
    width="36"
    height="36"
    loading="lazy"
    referrerpolicy="no-referrer"
    onError=${() => setBroken(true)}
  />`;
}

function buildCatalogRows(runningMods, factsMods, badgeMaps) {
  const live = runningMods?.mods ?? [];
  const byId = new Map();
  for (const m of factsMods ?? []) {
    const id = m.id ?? m.mod_id;
    if (id) byId.set(id, m);
  }

  // Nested ids claimed by any parent (facts or live) — hide as peer rows.
  const nestedIds = new Set();
  const markNested = (m) => {
    for (const id of m?.nested_mod_ids ?? []) {
      if (id) nestedIds.add(String(id).toLowerCase());
    }
    for (const j of m?.jar_in_jar ?? []) {
      const nid = j?.id ?? j?.mod_id;
      if (nid) nestedIds.add(String(nid).toLowerCase());
    }
  };
  for (const m of factsMods ?? []) markNested(m);
  for (const m of live) markNested(m);

  const isNestedPeer = (m) => {
    if (!m) return false;
    if (m.nested === true) return true;
    if (m.parent_jar) return true;
    const id = (m.id ?? m.mod_id ?? '').toLowerCase();
    return id && nestedIds.has(id);
  };

  const ids = new Set();
  const rows = [];
  for (const liveMod of live) {
    const id = liveMod.id;
    if (!id || isNestedPeer(liveMod)) continue;
    ids.add(id);
    const fact = byId.get(id) ?? {};
    rows.push({
      ...fact,
      ...liveMod,
      id,
      display_name: fact.modrinth_title || liveMod.display_name || fact.display_name || id,
      version: liveMod.version ?? fact.version,
      jar_in_jar: fact.jar_in_jar ?? liveMod.jar_in_jar,
      nested_mod_ids: fact.nested_mod_ids ?? liveMod.nested_mod_ids,
      side_score: fact.side_score ?? badgeMaps.sideById.get(id),
      client_bucket: badgeMaps.clientBucketById.get(id),
      meta: badgeMaps.metaById.get(id),
    });
  }
  for (const fact of factsMods ?? []) {
    const id = fact.id ?? fact.mod_id;
    if (!id || ids.has(id) || isNestedPeer(fact)) continue;
    rows.push({
      ...fact,
      id,
      display_name: fact.modrinth_title || fact.display_name || id,
      client_bucket: badgeMaps.clientBucketById.get(id),
      meta: badgeMaps.metaById.get(id),
    });
  }
  return rows;
}

function isClientLeaning(row, hasFacts) {
  if (row.side_score === 'server_required') return false;
  if (CLIENT_BUCKETS.has(row.side_score) || CLIENT_BUCKETS.has(row.client_bucket)) return true;
  if (!hasFacts && CLIENT_SIDE_IDS.has(row.id)) return true;
  return false;
}

function isUnresolved(row, hasFacts) {
  if (row.modrinth_url || row.modrinth_slug) return false;
  if (!hasFacts) return true;
  return !row.side_score;
}

function matchesCatalogFilter(row, filter, hasFacts) {
  switch (filter) {
    case 'client': return isClientLeaning(row, hasFacts);
    case 'server': return row.side_score === 'server_required';
    case 'unresolved': return isUnresolved(row, hasFacts);
    default: return true;
  }
}

function catalogSideRank(row) {
  const s = row.side_score || row.client_bucket || '';
  if (s === 'server_required') return 0;
  if (s === 'uncertain' || s === 'test_remove') return 1;
  if (s === 'client_library') return 2;
  if (s === 'likely_removable') return 3;
  if (CLIENT_SIDE_IDS.has(row.id)) return 3;
  return 4;
}

function sortCatalogRows(rows, sortKey, showTechNames) {
  const list = rows.slice();
  const nameOf = (m) => (
    showTechNames ? (m.id || '') : (m.display_name || m.id || '')
  ).toLowerCase();

  list.sort((a, b) => {
    switch (sortKey) {
      case 'name-desc':
        return nameOf(b).localeCompare(nameOf(a));
      case 'id':
        return (a.id || '').localeCompare(b.id || '');
      case 'updates': {
        const au = a.modrinth_outdated ? 0 : 1;
        const bu = b.modrinth_outdated ? 0 : 1;
        if (au !== bu) return au - bu;
        return nameOf(a).localeCompare(nameOf(b));
      }
      case 'side': {
        const d = catalogSideRank(a) - catalogSideRank(b);
        if (d) return d;
        return nameOf(a).localeCompare(nameOf(b));
      }
      case 'version': {
        const d = String(b.version || '').localeCompare(String(a.version || ''), undefined, { numeric: true });
        if (d) return d;
        return nameOf(a).localeCompare(nameOf(b));
      }
      case 'name':
      default:
        return nameOf(a).localeCompare(nameOf(b));
    }
  });
  return list;
}

function sideBadgesForRow(row, badgeMaps) {
  const badges = [];
  const id = row.id;
  const side = row.side_score;
  const clientBucket = row.client_bucket;
  const meta = row.meta;
  if (side === 'server_required') {
    badges.push(html`<${Badge} key="sr" tone="ok">server</${Badge}>`);
  } else if (clientBucket) {
    badges.push(html`<${Badge} key="b" tone=${BUCKET_TONE[clientBucket] ?? 'neutral'}>${bucketLabel(clientBucket)}</${Badge}>`);
  } else if (CLIENT_BUCKETS.has(side)) {
    badges.push(html`<${Badge} key="s" tone=${BUCKET_TONE[side] ?? 'neutral'}>${bucketLabel(side)}</${Badge}>`);
  } else if (CLIENT_SIDE_IDS.has(id) && !badgeMaps.hasFacts) {
    badges.push(html`<${Badge} key="c" tone="info">client</${Badge}>`);
  } else if (!row.modrinth_url && !side) {
    badges.push(html`<${Badge} key="u" tone="neutral">unresolved</${Badge}>`);
  }
  if (row.modrinth_outdated) {
    badges.push(html`<${Badge} key="upd" tone="warn">Update</${Badge}>`);
  }
  if (meta?.is_mcreator) {
    badges.push(html`<${Badge} key="mc" tone="neutral">MCreator</${Badge}>`);
  }
  if (meta?.loader_hint === 'fabric_in_neoforge_jar') {
    badges.push(html`<${Badge} key="fab" tone="warn">Fabric jar</${Badge}>`);
  }
  if (badgeMaps.connectorById?.has(id)) {
    badges.push(html`<${Badge} key="conn" tone="info">Connector analogue</${Badge}>`);
  }
  if (badgeMaps.securityById?.has(id)) {
    badges.push(html`<${Badge} key="sec" tone="danger">Security risk</${Badge}>`);
  }
  const nestedCount = Array.isArray(row.jar_in_jar) ? row.jar_in_jar.length
    : Array.isArray(row.nested_mod_ids) ? row.nested_mod_ids.length : 0;
  if (nestedCount > 0) {
    badges.push(html`<${Badge} key="nest" tone="neutral">+${nestedCount} nested</${Badge}>`);
  }
  return badges;
}

function TreeNode({ node, depth = 0, onSelectMod }) {
  const hasChildren = node.children?.length > 0;
  const [open, setOpen] = useState(depth < 2);
  const modId = node.mod_id;
  return html`
    <div class="feat-mods-tree__node" style=${{ '--depth': depth }}>
      <div
        class=${`feat-mods-tree__row${onSelectMod && modId ? ' feat-mods-tree__row--clickable' : ''}`}
        onClick=${onSelectMod && modId ? () => onSelectMod(modId) : undefined}
        role=${onSelectMod && modId ? 'button' : undefined}
        tabindex=${onSelectMod && modId ? 0 : undefined}
        onKeyDown=${onSelectMod && modId ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectMod(modId); }
        } : undefined}
      >
        ${hasChildren ? html`
          <button type="button" class="feat-mods-tree__toggle" onClick=${(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
            ${open ? '▾' : '▸'}
          </button>
        ` : html`<span class="feat-mods-tree__toggle feat-mods-tree__toggle--leaf">•</span>`}
        <span class="feat-mods-tree__name">${node.display_name ?? node.mod_id}</span>
        <span class="feat-mods-tree__meta ui-text-low">${node.version ?? ''}</span>
        <div class="feat-mods-badges">
          ${node.side_score ? html`<${Badge} tone=${BUCKET_TONE[node.side_score] ?? 'neutral'}>${bucketLabel(node.side_score)}</${Badge}>` : null}
          ${node.is_mcreator ? html`<${Badge} tone="neutral">MCreator</${Badge}>` : null}
          ${node.loader_hint === 'fabric_in_neoforge_jar' ? html`<${Badge} tone="warn">Fabric jar</${Badge}>` : null}
          ${node.mandatory === false ? html`<${Badge} tone="neutral">optional</${Badge}>` : null}
        </div>
      </div>
      ${hasChildren && open ? html`
        <div class="feat-mods-tree__children">
          ${node.children.map((c) => html`<${TreeNode} key=${c.mod_id} node=${c} depth=${depth + 1} onSelectMod=${onSelectMod} />`)}
        </div>
      ` : null}
    </div>
  `;
}

function ModDepsSection({ modId, factsMods, onSelectMod }) {
  const trees = useMemo(() => {
    if (!modId || !factsMods?.length) return null;
    return {
      dependents: toTree(modId, factsMods, 'dependents', 5),
      dependencies: toTree(modId, factsMods, 'dependencies', 5),
    };
  }, [modId, factsMods]);

  if (!modId) return null;

  if (!factsMods?.length) {
    return html`
      <div class="feat-mods-drawer__section feat-mods-panel__deps">
        <${Section} title="Dependencies" defaultOpen=${false}>
          <p class="ui-text-low">Dependency trees appear after Scanning builds the mod manifest (mods_light / deep deltas).</p>
        </${Section}>
      </div>
    `;
  }

  return html`
    <div class="feat-mods-drawer__section feat-mods-panel__deps">
      <${Section} title="Dependencies" defaultOpen=${false}>
        <div class="feat-mods-panel__deps-grid">
          <div class="feat-mods-panel__deps-block">
            <p class="feat-mods-drawer__section-label">Needed by</p>
            ${(trees.dependents?.children?.length)
              ? html`<div class="feat-mods-tree"><${TreeNode} node=${trees.dependents} onSelectMod=${onSelectMod} /></div>`
              : html`<p class="ui-text-low">No mods declare a mandatory dependency on this one.</p>`}
          </div>
          <div class="feat-mods-panel__deps-block">
            <p class="feat-mods-drawer__section-label">Needs</p>
            ${(trees.dependencies?.children?.length)
              ? html`<div class="feat-mods-tree"><${TreeNode} node=${trees.dependencies} onSelectMod=${onSelectMod} /></div>`
              : html`<p class="ui-text-low">No declared dependencies in the report manifest.</p>`}
          </div>
        </div>
      </${Section}>
    </div>
  `;
}

function ModDetailPanel({ mod, showTechNames, badgeMaps, factsMods, onSelectMod }) {
  if (!mod) {
    return html`
      <aside class="crashes-detail crashes-detail--empty" role="complementary" aria-label="Mod details">
        <${EmptyState}
          title="Select a mod"
          body="Click a row in the list to see status, description, and links here."
        />
      </aside>
    `;
  }
  const name = modDisplayName(mod, showTechNames);
  const side = sideSummaryForMod(mod, badgeMaps);
  const hasSlug = !!(mod.modrinth_slug || mod.modrinth_url);
  const updateUrl = mod.modrinth_compatible_url || mod.modrinth_cta_url;
  const hasLinks = modLinkEntries(mod).length > 0;
  const extraBadges = [];
  if (mod.modrinth_outdated) {
    extraBadges.push(html`<${Badge} key="upd" tone="warn">Update available</${Badge}>`);
  }
  if (mod.meta?.is_mcreator) {
    extraBadges.push(html`<${Badge} key="mc" tone="neutral">MCreator</${Badge}>`);
  }
  if (mod.meta?.loader_hint === 'fabric_in_neoforge_jar') {
    extraBadges.push(html`<${Badge} key="fab" tone="warn">Fabric jar</${Badge}>`);
  }
  if (badgeMaps.connectorById?.has(mod.id)) {
    extraBadges.push(html`<${Badge} key="conn" tone="info">Connector analogue</${Badge}>`);
  }
  if (badgeMaps.securityById?.has(mod.id)) {
    extraBadges.push(html`<${Badge} key="sec" tone="danger">Security risk</${Badge}>`);
  }
  const nestedJars = Array.isArray(mod.jar_in_jar) ? mod.jar_in_jar : [];

  return html`
    <aside class="crashes-detail" role="complementary" aria-label=${name}>
      <header class="crashes-detail__head">
        <div class="crashes-detail__titles feat-mods-detail__titles">
          <div class="feat-mods-detail__title-row">
            <${ModIcon} url=${mod.modrinth_icon_url} name=${name} />
            <div>
              <h2 class="crashes-detail__title">${name}</h2>
              <p class="crashes-detail__sub">
                <span>${mod.id}${mod.version ? ` · ${mod.version}` : ''}</span>
                ${extraBadges}
              </p>
            </div>
          </div>
        </div>
      </header>
      <div class="crashes-detail__body">
        <div class="crashes-panel crashes-panel--details">
          <div class="crashes-panel__hero">
            <div class="crashes-panel__eyebrow">Details</div>
            <p class="crashes-panel__headline">Status, description, and links for this jar</p>
          </div>
          <section class="crashes-panel__block">
            <div class="crashes-panel__block-head">
              <h3 class="crashes-panel__block-title">Client / server</h3>
            </div>
            <div class="crashes-panel__block-body">
              <${ModSideCallout} summary=${side} />
            </div>
          </section>
          <section class="crashes-panel__block">
            <div class="crashes-panel__block-head">
              <h3 class="crashes-panel__block-title">About</h3>
            </div>
            <div class="crashes-panel__block-body">
              ${mod.modrinth_description ? html`
                <p class="feat-mods-drawer__desc">${mod.modrinth_description}</p>
              ` : html`
                <p class="feat-mods-drawer__desc ui-text-low">
                  ${hasSlug
                    ? 'No project description from Modrinth for this jar.'
                    : 'No Modrinth description yet — run a report with Modrinth lookup enabled in Settings → Monitoring.'}
                </p>
              `}
            </div>
          </section>
          ${nestedJars.length > 0 ? html`
            <section class="crashes-panel__block">
              <div class="crashes-panel__block-head">
                <h3 class="crashes-panel__block-title">Nested / embedded jars</h3>
              </div>
              <div class="crashes-panel__block-body">
                <p class="ui-text-low" style=${{ marginBottom: '0.5rem' }}>
                  These mods ship inside this jar (jar-in-jar). They are not separate files in mods/.
                </p>
                <ul class="feat-mods-nested">
                  ${nestedJars.map((j, i) => {
                    const nid = j.id ?? j.mod_id ?? 'unknown';
                    const label = j.display_name || nid;
                    const ver = j.version ? ` · ${j.version}` : '';
                    const path = j.nested_path ? html`<div class="feat-mods-nested__path">${j.nested_path}</div>` : null;
                    return html`
                      <li class="feat-mods-nested__item" key=${`${nid}-${i}`}>
                        <div class="feat-mods-nested__title">${label}<span class="ui-text-low">${ver}</span></div>
                        <div class="feat-mods-nested__id ui-text-low">${nid}</div>
                        ${path}
                      </li>
                    `;
                  })}
                </ul>
              </div>
            </section>
          ` : null}
          <section class="crashes-panel__block">
            <div class="crashes-panel__block-head">
              <h3 class="crashes-panel__block-title">Links</h3>
            </div>
            <div class="crashes-panel__block-body">
              ${hasLinks
                ? html`<${ModLinkCluster} mod=${mod} layout="stack" />`
                : html`<p class="ui-text-low">No external links for this mod.</p>`}
            </div>
          </section>
          <div class="crashes-panel__done">
            <${ModActionRow}>
              ${mod.modrinth_outdated && updateUrl ? html`
                <${Button}
                  kind="primary"
                  size="sm"
                  onClick=${() => window.open(updateUrl, '_blank', 'noopener')}
                >Open update on Modrinth</${Button}>
              ` : (mod.modrinth_url ? html`
                <${Button}
                  kind="neutral"
                  size="sm"
                  onClick=${() => window.open(mod.modrinth_url, '_blank', 'noopener')}
                >Open on Modrinth</${Button}>
              ` : null)}
              ${mod.modrinth_outdated ? html`
                <${Button} kind="neutral" size="sm" onClick=${() => navigate('mods', { view: 'updates', mod: mod.id })}>
                  Open Updates
                </${Button}>
              ` : null}
            </${ModActionRow}>
          </div>
          <${ModDepsSection} modId=${mod.id} factsMods=${factsMods} onSelectMod=${onSelectMod} />
        </div>
      </div>
    </aside>
  `;
}

function OverviewTab({ runningMods, modsInventory, showTechNames, search, onSearch, badgeMaps, factsMods, initialModId, updateCount, modrinthLookupEnabled }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [scanning, setScanning] = useState(false);
  const [sort, setSort] = useState(() => {
    try {
      const saved = localStorage.getItem('wt.modsSort');
      if (saved && CATALOG_SORT_OPTIONS.some((o) => o.value === saved)) return saved;
    } catch {}
    return 'name';
  });
  const [selected, setSelected] = useState(null);
  const [seedApplied, setSeedApplied] = useState(false);

  const catalog = useMemo(
    () => buildCatalogRows(runningMods, factsMods, badgeMaps),
    [runningMods, factsMods, badgeMaps],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = catalog.filter((m) => {
      if (!matchesCatalogFilter(m, filter, badgeMaps.hasFacts)) return false;
      if (!q) return true;
      return (m.display_name ?? '').toLowerCase().includes(q)
        || (m.id ?? '').toLowerCase().includes(q)
        || (m.modrinth_slug ?? '').toLowerCase().includes(q);
    });
    return sortCatalogRows(rows, sort, showTechNames);
  }, [catalog, search, filter, sort, showTechNames, badgeMaps.hasFacts]);

  useEffect(() => { setPage(0); }, [search, filter, sort]);

  function handleSortChange(value) {
    setSort(value);
    try { localStorage.setItem('wt.modsSort', value); } catch {}
  }

  function selectModById(id) {
    const idx = filtered.findIndex((m) => m.id === id);
    if (idx >= 0) {
      setPage(Math.floor(idx / CATALOG_PAGE_SIZE));
      setSelected(filtered[idx]);
      return;
    }
    const hit = catalog.find((m) => m.id === id);
    if (hit) setSelected(hit);
  }

  useEffect(() => {
    if (seedApplied || !initialModId || !filtered.length) return;
    const idx = filtered.findIndex((m) => m.id === initialModId);
    if (idx >= 0) {
      setSelected(filtered[idx]);
      setPage(Math.floor(idx / CATALOG_PAGE_SIZE));
      setSeedApplied(true);
    }
  }, [filtered, initialModId, seedApplied]);

  useEffect(() => {
    if (!filtered.length) {
      if (selected) setSelected(null);
      return;
    }
    if (selected && filtered.some((m) => m.id === selected.id)) return;
    setSelected(filtered[0]);
  }, [filtered, selected]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CATALOG_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = useMemo(() => {
    const start = safePage * CATALOG_PAGE_SIZE;
    return filtered.slice(start, start + CATALOG_PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const rangeStart = filtered.length ? safePage * CATALOG_PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(filtered.length, (safePage + 1) * CATALOG_PAGE_SIZE);

  if (!catalog.length) {
    async function handleScan() {
      setScanning(true);
      try {
        await scanMods(true);
        addToast('Mods scan complete', 'success');
      } catch (e) {
        addToast(e?.message || 'Mods scan failed', 'danger');
      } finally {
        setScanning(false);
      }
    }
    return html`
      <${EmptyState}
        title="No mod list yet"
        body="Continuous Scanning fills mods_light in the background. Tap Scan now if the list is still empty."
        action=${html`<${Button} kind="accent" onClick=${handleScan} loading=${scanning}>Scan now</${Button}>`}
      />
    `;
  }

  const securityFlags = badgeMaps.securityFlags ?? [];
  const connectorWarnings = badgeMaps.connectorWarnings ?? [];
  const securityIds = securityFlags.map((f) => f.mod_id || f.id).filter(Boolean);
  const connectorIds = connectorWarnings.map((w) => w.mod_id || w.id).filter(Boolean);
  const rangeLabel = filtered.length
    ? `${rangeStart}–${rangeEnd} of ${filtered.length}`
    : '0 matches';
  const countLabel = `${runningMods?.count ?? catalog.length} mods`;
  const inventoryBit = modsInventory?.tldr ? ` · ${modsInventory.tldr}` : '';

  return html`
    <div class="feat-mods-overview feat-mods-overview--split">
      <div class="feat-mods-banners" role="status">
        ${securityIds.length ? html`
          <div class="feat-mods-banner feat-mods-banner--danger" role="alert">
            <span class="feat-mods-banner__label">Security</span>
            <span class="feat-mods-banner__text">Denylisted: ${securityIds.join(', ')} — remove immediately.</span>
          </div>
        ` : null}
        ${connectorIds.length ? html`
          <div class="feat-mods-banner feat-mods-banner--warn">
            <span class="feat-mods-banner__label">Connector</span>
            <span class="feat-mods-banner__text">Fabric-side with NeoForge analogues: ${connectorIds.join(', ')}</span>
          </div>
        ` : null}
        <${ModrinthOverviewBanner} modrinthLookupEnabled=${modrinthLookupEnabled} />
      </div>

      <div class="feat-queue-chrome feat-mods-catalog__chrome">
        <${TextField}
          id="mods-overview-search"
          icon="search"
          value=${search}
          onInput=${(e) => onSearch?.(e.target.value)}
          placeholder="Search by name, id, or slug…"
          aria-label="Search mods"
        />
        <${Segmented}
          options=${CATALOG_FILTERS}
          value=${filter}
          onChange=${setFilter}
          size="sm"
        />
        <label class="feat-mods-sort">
          <span class="feat-mods-sort__label">Sort</span>
          <select
            class="feat-mods-sort__select"
            value=${sort}
            onChange=${(e) => handleSortChange(e.target.value)}
            aria-label="Sort mods"
          >
            ${CATALOG_SORT_OPTIONS.map((o) => html`
              <option key=${o.value} value=${o.value}>${o.label}</option>
            `)}
          </select>
        </label>
        <span class="feat-queue-chrome__count">
          <span>${countLabel}${inventoryBit}</span>
          <span class="feat-queue-chrome__sep" aria-hidden="true">·</span>
          <span>Showing ${rangeLabel}${filter !== 'all' || search.trim() ? ' (filtered)' : ''}</span>
          ${updateCount > 0 ? html`
            <span class="feat-queue-chrome__sep" aria-hidden="true">·</span>
            <a class="ui-link" href="#" onClick=${(e) => { e.preventDefault(); navigate('mods', { view: 'updates' }); }}>
              ${updateCount} with updates
            </a>
          ` : null}
        </span>
      </div>

      <div class="feat-mods-split">
        <div class="feat-mods-split__list">
          <div class="feat-mods-catalog" role="listbox" aria-label="Mods">
            ${paginated.map((m) => {
              const name = modDisplayName(m, showTechNames);
              const active = selected?.id === m.id;
              return html`
                <div
                  class=${`feat-mods-catalog__row${active ? ' feat-mods-catalog__row--active' : ''}`}
                  key=${m.id}
                  role="option"
                  aria-selected=${active}
                  tabindex="0"
                  onClick=${() => setSelected(m)}
                  onKeyDown=${(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(m);
                    }
                  }}
                >
                  <${ModIcon} url=${m.modrinth_icon_url} name=${name} />
                  <div class="feat-mods-catalog__main">
                    <span class="feat-mods-catalog__name">${name}</span>
                    <span class="feat-mods-catalog__ver">${m.version ?? '—'}${showTechNames ? '' : ` · ${m.id}`}</span>
                  </div>
                  <div class="feat-mods-badges">${sideBadgesForRow(m, badgeMaps)}</div>
                </div>
              `;
            })}
            ${!paginated.length ? html`
              <${EmptyState} title="No mods match" body="Try another filter or clear search." />
            ` : null}
          </div>
          <div class="feat-pagination">
            <${Button} kind="neutral" size="sm" disabled=${safePage === 0} onClick=${() => setPage(0)}>First</${Button}>
            <${Button} kind="neutral" size="sm" disabled=${safePage === 0} onClick=${() => setPage((p) => Math.max(0, p - 1))}>Prev</${Button}>
            <span class="feat-pagination__label">Page ${filtered.length ? safePage + 1 : 0} of ${filtered.length ? totalPages : 0}</span>
            <${Button} kind="neutral" size="sm" disabled=${safePage >= totalPages - 1 || !filtered.length} onClick=${() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</${Button}>
            <${Button} kind="neutral" size="sm" disabled=${safePage >= totalPages - 1 || !filtered.length} onClick=${() => setPage(totalPages - 1)}>Last</${Button}>
          </div>
        </div>
        <${ModDetailPanel}
          mod=${selected}
          showTechNames=${showTechNames}
          badgeMaps=${badgeMaps}
          factsMods=${factsMods}
          onSelectMod=${selectModById}
        />
      </div>
    </div>
  `;
}

function VersionDelta({ current, latest }) {
  if (!current && !latest) return null;
  return html`
    <span class="feat-mods-ver-delta">
      <span class="feat-mods-ver-delta__cur">${current || '—'}</span>
      <span class="feat-mods-ver-delta__arrow" aria-hidden="true">→</span>
      <span class="feat-mods-ver-delta__next">${latest || '—'}</span>
    </span>
  `;
}

function impactRowTitle(row, catalogById, showTechNames) {
  if (!row) return 'Unknown';
  if (showTechNames) return row.mod_id || row.display_name || 'Unknown';
  if (row.display_name) return row.display_name;
  const mod = catalogById?.get?.(row.mod_id);
  if (mod) return modDisplayName(mod, false);
  return row.mod_id || 'Unknown';
}

function ModUpdateDetailPanel({ row, mod, showTechNames, factsMods, onSelectMod, catalogById }) {
  if (!row) {
    return html`
      <aside class="crashes-detail crashes-detail--empty" role="complementary" aria-label="Update details">
        <${EmptyState}
          title="Select an update"
          body="Pick a mod on the left to see pack impact, co-updates, and Modrinth links."
        />
      </aside>
    `;
  }
  const name = mod ? modDisplayName(mod, showTechNames) : (row.title || row.mod_id);
  const verdict = row.impact_verdict || 'unknown';
  const blockers = Array.isArray(row.blockers) ? row.blockers : [];
  const coUpdates = Array.isArray(row.co_updates) ? row.co_updates : [];
  const dependents = Array.isArray(row.dependents) ? row.dependents : [];
  const updateUrl = row.modrinth_compatible_url || mod?.modrinth_compatible_url || mod?.modrinth_cta_url || mod?.modrinth_url;
  const hasLinks = mod ? modLinkEntries(mod).length > 0 : !!updateUrl;

  return html`
    <aside class="crashes-detail" role="complementary" aria-label=${`${name} update`}>
      <header class="crashes-detail__head">
        <div class="crashes-detail__titles feat-mods-detail__titles">
          <div class="feat-mods-detail__title-row">
            <${ModIcon} url=${mod?.modrinth_icon_url} name=${name} />
            <div>
              <h2 class="crashes-detail__title">${name}</h2>
              <p class="crashes-detail__sub">
                <span>${row.mod_id} · </span>
                <${VersionDelta} current=${row.current_version} latest=${row.latest_compatible} />
                <${Badge} tone=${VERDICT_TONE[verdict] ?? 'neutral'}>${VERDICT_LABEL[verdict] || 'Unknown'}</${Badge}>
              </p>
            </div>
          </div>
        </div>
      </header>
      <div class="crashes-detail__body">
        <div class="crashes-panel crashes-panel--details">
          <div class="crashes-panel__hero">
            <div class="crashes-panel__eyebrow">Details</div>
            <p class="crashes-panel__headline">Pack impact and update guidance</p>
          </div>
          <section class="crashes-panel__block">
            <div class="crashes-panel__block-head">
              <h3 class="crashes-panel__block-title">Impact</h3>
            </div>
            <div class="crashes-panel__block-body">
              <div class=${`feat-mods-impact feat-mods-impact--${verdict}`}>
                <div class="feat-mods-impact__top">
                  <span class="feat-mods-impact__verdict">${VERDICT_LABEL[verdict] || 'Unknown'}</span>
                  ${row.confidence ? html`<span class="feat-mods-impact__confidence">${row.confidence} confidence</span>` : null}
                </div>
                <p class="feat-mods-impact__summary">${row.impact_summary || 'No impact summary for this update.'}</p>
              </div>
            </div>
          </section>
          ${blockers.length ? html`
            <section class="crashes-panel__block">
              <div class="crashes-panel__block-head">
                <h3 class="crashes-panel__block-title">Will break / blockers</h3>
              </div>
              <div class="crashes-panel__block-body">
                <div class="feat-list">
                  ${blockers.map((b, i) => html`
                    <${ListRow}
                      key=${`${b.mod_id}-${i}`}
                      title=${impactRowTitle(b, catalogById, showTechNames)}
                      meta=${[
                        !showTechNames && b.display_name && b.mod_id && b.display_name !== b.mod_id ? b.mod_id : null,
                        b.detail || '',
                      ].filter(Boolean).join(' · ')}
                      badge=${html`<${Badge} tone=${b.kind === 'conflict' || b.kind === 'need_install' ? 'danger' : 'warn'}>${(b.kind || 'issue').replace(/_/g, ' ')}</${Badge}>`}
                    />
                  `)}
                </div>
              </div>
            </section>
          ` : null}
          ${coUpdates.length || row.related_pair ? html`
            <section class="crashes-panel__block">
              <div class="crashes-panel__block-head">
                <h3 class="crashes-panel__block-title">Update together</h3>
              </div>
              <div class="crashes-panel__block-body">
                ${row.related_pair ? html`
                  <p class="feat-mods-drawer__desc">Paired with <strong>${impactRowTitle({ mod_id: row.related_pair, display_name: catalogById?.get?.(row.related_pair) ? modDisplayName(catalogById.get(row.related_pair), showTechNames) : null }, catalogById, showTechNames)}</strong> — update both jars together.</p>
                ` : null}
                ${coUpdates.length ? html`
                  <div class="feat-list">
                    ${coUpdates.map((c, i) => html`
                      <${ListRow}
                        key=${`${c.mod_id}-${i}`}
                        title=${impactRowTitle(c, catalogById, showTechNames)}
                        meta=${[c.current ? `installed ${c.current}` : null, c.detail].filter(Boolean).join(' · ')}
                      />
                    `)}
                  </div>
                ` : null}
              </div>
            </section>
          ` : null}
          ${dependents.length ? html`
            <section class="crashes-panel__block">
              <div class="crashes-panel__block-head">
                <h3 class="crashes-panel__block-title">Mods that depend on this</h3>
              </div>
              <div class="crashes-panel__block-body">
                <div class="feat-mods-badges">
                  ${dependents.map((d) => html`
                    <${Button}
                      key=${d.mod_id}
                      kind="neutral"
                      size="sm"
                      onClick=${() => {
                        if (onSelectMod) onSelectMod(d.mod_id);
                        else navigate('mods', { view: 'overview', mod: d.mod_id });
                      }}
                    >${impactRowTitle(d, catalogById, showTechNames)}</${Button}>
                  `)}
                </div>
              </div>
            </section>
          ` : null}
          ${mod?.modrinth_description ? html`
            <section class="crashes-panel__block">
              <div class="crashes-panel__block-head">
                <h3 class="crashes-panel__block-title">About</h3>
              </div>
              <div class="crashes-panel__block-body">
                <p class="feat-mods-drawer__desc">${mod.modrinth_description}</p>
              </div>
            </section>
          ` : null}
          <section class="crashes-panel__block">
            <div class="crashes-panel__block-head">
              <h3 class="crashes-panel__block-title">Links</h3>
            </div>
            <div class="crashes-panel__block-body">
              ${mod && hasLinks
                ? html`<${ModLinkCluster} mod=${mod} layout="stack" />`
                : (updateUrl
                  ? html`<${ModLinkChip} href=${updateUrl} label="Modrinth" />`
                  : html`<p class="ui-text-low">No external links for this mod.</p>`)}
            </div>
          </section>
          <div class="crashes-panel__done">
            <${ModActionRow}>
              <${Button} kind="neutral" size="sm" onClick=${() => navigate('mods', { view: 'overview', mod: row.mod_id })}>
                Open in Overview
              </${Button}>
              ${updateUrl ? html`
                <${Button}
                  kind="primary"
                  size="sm"
                  onClick=${() => window.open(updateUrl, '_blank', 'noopener')}
                >Open update on Modrinth</${Button}>
              ` : null}
            </${ModActionRow}>
          </div>
          <${ModDepsSection} modId=${row.mod_id} factsMods=${factsMods} onSelectMod=${onSelectMod} />
        </div>
      </div>
    </aside>
  `;
}

function UpdatesTab({
  modrinthUpdates,
  factsMods,
  runningMods,
  badgeMaps,
  showTechNames,
  search,
  onSearch,
  initialModId,
  modrinthLookupEnabled,
  hasReport,
}) {
  const PAGE_SIZE = 40;
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [seedApplied, setSeedApplied] = useState(false);

  const catalogById = useMemo(() => {
    const rows = buildCatalogRows(runningMods, factsMods, badgeMaps);
    const map = new Map();
    for (const r of rows) map.set(r.id, r);
    return map;
  }, [runningMods, factsMods, badgeMaps]);

  const updates = Array.isArray(modrinthUpdates) ? modrinthUpdates : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return updates.filter((u) => {
      const verdict = u.impact_verdict || 'unknown';
      if (filter !== 'all' && verdict !== filter) return false;
      if (!q) return true;
      const mod = catalogById.get(u.mod_id);
      const title = (u.title || mod?.display_name || u.mod_id || '').toLowerCase();
      return title.includes(q)
        || (u.mod_id || '').toLowerCase().includes(q)
        || (mod?.modrinth_slug || '').toLowerCase().includes(q);
    });
  }, [updates, search, filter, catalogById]);

  useEffect(() => { setPage(0); }, [search, filter]);

  useEffect(() => {
    if (seedApplied || !initialModId || !filtered.length) return;
    if (filtered.some((u) => u.mod_id === initialModId)) {
      setSelectedId(initialModId);
      setSeedApplied(true);
    }
  }, [filtered, initialModId, seedApplied]);

  useEffect(() => {
    if (!filtered.length) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (selectedId && filtered.some((u) => u.mod_id === selectedId)) return;
    setSelectedId(filtered[0].mod_id);
  }, [filtered, selectedId]);

  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const selectedRow = filtered.find((u) => u.mod_id === selectedId) || null;
  const selectedMod = selectedRow ? catalogById.get(selectedRow.mod_id) : null;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rangeStart = filtered.length ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(filtered.length, (page + 1) * PAGE_SIZE);

  if (!updates.length && !badgeMaps.hasFacts) {
    return html`<${EmptyState}
      title="No Modrinth data yet"
      body="Run a Modrinth scan from Mods → Modrinth to detect outdated jars and pack impact — no legacy report required."
      action=${html`<${Button} kind="primary" size="sm" onClick=${() => navigate('mods', { view: 'modrinth' })}>Open Modrinth tab</${Button}>`}
    />`;
  }

  if (modrinthLookupEnabled === false) {
    return html`<${EmptyState}
      title="Modrinth lookup is off"
      body="Enable Modrinth lookup in Settings → Monitoring, then run a scan from Mods → Modrinth. Watchtower never downloads jars — it only checks impact and links you to Modrinth."
      action=${html`<${Button} kind="neutral" size="sm" onClick=${() => navigate('settings', { panel: 'monitoring' })}>Open Settings</${Button}>`}
    />`;
  }

  if (!updates.length) {
    return html`<${EmptyState}
      title="All looked-up mods look current"
      body="No loader/MC-compatible Modrinth updates were flagged in the latest report."
    />`;
  }

  return html`
    <div class="feat-mods-updates feat-mods-overview--split">
      <div class="feat-queue-chrome feat-mods-catalog__chrome">
        <${TextField}
          id="mods-updates-search"
          icon="search"
          value=${search}
          onInput=${(e) => onSearch?.(e.target.value)}
          placeholder="Search updates…"
          aria-label="Search updates"
        />
        <${Segmented}
          options=${UPDATE_VERDICT_FILTERS}
          value=${filter}
          onChange=${setFilter}
          size="sm"
        />
        <span class="feat-queue-chrome__count">
          <span>${updates.length} update${updates.length === 1 ? '' : 's'}</span>
          <span class="feat-queue-chrome__sep" aria-hidden="true">·</span>
          <span>Showing ${rangeStart}–${rangeEnd} of ${filtered.length}${filter !== 'all' || search.trim() ? ' (filtered)' : ''}</span>
        </span>
      </div>
      <div class="feat-mods-split">
        <div class="feat-mods-split__list">
          <div class="feat-mods-catalog" role="listbox" aria-label="Mod updates">
            ${paginated.map((u) => {
              const mod = catalogById.get(u.mod_id);
              const name = mod ? modDisplayName(mod, showTechNames) : (u.title || u.mod_id);
              const active = selectedId === u.mod_id;
              const verdict = u.impact_verdict || 'unknown';
              return html`
                <div
                  class=${`feat-mods-catalog__row${active ? ' feat-mods-catalog__row--active' : ''}`}
                  key=${u.mod_id}
                  role="option"
                  aria-selected=${active}
                  tabindex="0"
                  onClick=${() => setSelectedId(u.mod_id)}
                  onKeyDown=${(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(u.mod_id);
                    }
                  }}
                >
                  <${ModIcon} url=${mod?.modrinth_icon_url} name=${name} />
                  <div class="feat-mods-catalog__main">
                    <span class="feat-mods-catalog__name">${name}</span>
                    <span class="feat-mods-catalog__ver">
                      <${VersionDelta} current=${u.current_version} latest=${u.latest_compatible} />
                    </span>
                  </div>
                  <div class="feat-mods-badges">
                    <${Badge} tone=${VERDICT_TONE[verdict] ?? 'neutral'}>${VERDICT_LABEL[verdict] || 'Unknown'}</${Badge}>
                    ${u.related_pair ? html`<${Badge} tone="info">pair</${Badge}>` : null}
                  </div>
                </div>
              `;
            })}
            ${!paginated.length ? html`
              <${EmptyState} title="No matching updates" body="Clear filters or search to see all outdated mods." />
            ` : null}
          </div>
          ${totalPages > 1 && html`
            <div class="feat-pagination">
              <${Button} kind="neutral" size="sm" disabled=${page === 0} onClick=${() => setPage((p) => p - 1)}>Prev</${Button}>
              <span class="feat-pagination__label">Showing ${rangeStart}–${rangeEnd} of ${filtered.length}</span>
              <${Button} kind="neutral" size="sm" disabled=${page >= totalPages - 1} onClick=${() => setPage((p) => p + 1)}>Next</${Button}>
            </div>
          `}
        </div>
        <${ModUpdateDetailPanel}
          row=${selectedRow}
          mod=${selectedMod}
          showTechNames=${showTechNames}
          factsMods=${factsMods}
          catalogById=${catalogById}
          onSelectMod=${(id) => setSelectedId(id)}
        />
      </div>
    </div>
  `;
}

function ConflictsTab({ recommendations, modIssues, factsMods, search, onSearch }) {
  const recs = useMemo(() => {
    const fromReport = Array.isArray(recommendations) ? recommendations : [];
    if (fromReport.length) return fromReport;
    // Continuous path: map ops mod_issues into conflict-ish rows when no report recs
    const issues = Array.isArray(modIssues) ? modIssues : [];
    return issues.map((e) => ({
      mod_id: e.mod_id || e.id,
      category: e.category || e.kind || 'issue',
      severity: e.severity || 'warning',
      why: e.message || e.why || '',
      fix: e.fix || '',
      fix_steps: e.fix_steps || null,
      modrinth_url: e.modrinth_url || null,
    })).filter((r) => r.mod_id || r.why);
  }, [recommendations, modIssues]);
  const modById = useMemo(() => {
    const map = new Map();
    for (const m of factsMods ?? []) {
      const id = m.id ?? m.mod_id;
      if (id) map.set(id, m);
    }
    return map;
  }, [factsMods]);

  const filtered = useMemo(() => {
    if (!search?.trim()) return recs;
    const q = search.toLowerCase();
    return recs.filter((r) => {
      const fact = modById.get(r.mod_id);
      const title = fact?.modrinth_title || fact?.display_name || r.mod_id || '';
      return (r.mod_id ?? '').toLowerCase().includes(q)
        || title.toLowerCase().includes(q)
        || (r.category ?? '').toLowerCase().includes(q)
        || (r.why ?? '').toLowerCase().includes(q)
        || (r.fix ?? '').toLowerCase().includes(q);
    });
  }, [recs, search, modById]);

  const chrome = html`
    <div class="feat-queue-chrome">
      <${TextField}
        icon="search"
        value=${search}
        onInput=${(e) => onSearch?.(e.target.value)}
        placeholder="Search conflicts…"
        aria-label="Search conflicts"
      />
    </div>
  `;

  if (!recs.length) {
    return html`
      <div class="feat-mods-conflicts">
        ${chrome}
        <${EmptyState}
          title="No update conflicts"
          body="No compatibility or update conflicts from continuous mod scans. Jar add/remove/change since the last baseline lives under Changes."
        />
      </div>
    `;
  }

  if (!filtered.length) {
    return html`
      <div class="feat-mods-conflicts">
        ${chrome}
        <${EmptyState}
          title="No matching conflicts"
          body="Nothing matches this search. Clear the filter to see all update conflicts."
        />
      </div>
    `;
  }

  return html`
    <div class="feat-mods-conflicts">
      ${chrome}
      <${Section} title=${`Update conflicts (${filtered.length})`} defaultOpen=${true}>
        <div class="feat-list">
          ${filtered.map((r, i) => {
            const tone = r.severity === 'critical' ? 'danger' : r.severity === 'warning' ? 'warn' : 'info';
            const fact = modById.get(r.mod_id) ?? {};
            const title = fact.modrinth_title || fact.display_name || r.mod_id || r.category || 'Conflict';
            const mrUrl = r.modrinth_url || fact.modrinth_compatible_url || fact.modrinth_cta_url || fact.modrinth_url;
            const why = r.why ?? r.action_detail ?? r.fix ?? '';
            return html`
            <${ListRow}
              key=${r.mod_id ?? i}
              tone=${tone}
              title=${title}
              meta=${[r.mod_id && r.mod_id !== title ? r.mod_id : null, why].filter(Boolean).join(' · ')}
              badge=${html`<${Badge} tone=${tone}>${r.severity ?? r.category ?? 'conflict'}</${Badge}>`}
            >
              ${(r.fix_steps?.length || r.fix) ? html`
                <div class="issues-fix">
                  <div class="issues-fix__label">Do this next</div>
                  <ol class="issues-fix__steps">
                    ${(r.fix_steps?.length ? r.fix_steps : [r.fix]).filter(Boolean).map((s, si) => html`
                      <li key=${si}>${s}</li>
                    `)}
                  </ol>
                </div>
              ` : null}
              <${ModActionRow}>
                ${mrUrl ? html`<${ModLinkChip} href=${mrUrl} label="Open on Modrinth" />` : null}
                ${r.mod_id ? html`
                  <${Button}
                    kind="neutral"
                    size="sm"
                    onClick=${() => navigate('mods', { view: 'overview', mod: r.mod_id })}
                  >Open in Overview</${Button}>
                ` : null}
              </${ModActionRow}>
            </${ListRow}>
          `;
          })}
        </div>
      </${Section}>
    </div>
  `;
}

function ChangesTab({ modsInventory, search, onSearch, factsMods }) {
  const diff = modsInventory?.diff;

  const modById = useMemo(() => {
    const map = new Map();
    for (const m of factsMods ?? []) {
      const id = m.id ?? m.mod_id;
      if (id) map.set(id, m);
    }
    return map;
  }, [factsMods]);

  const groups = useMemo(() => {
    if (!diff) return [];
    const q = (search ?? '').trim().toLowerCase();
    const match = (m) => {
      if (!q) return true;
      return (m.display_name ?? '').toLowerCase().includes(q)
        || (m.mod_id ?? '').toLowerCase().includes(q)
        || (m.jar ?? '').toLowerCase().includes(q);
    };
    return [
      { label: 'Added', items: (diff.added ?? []).filter(match), tone: 'ok' },
      { label: 'Removed', items: (diff.removed ?? []).filter(match), tone: 'danger' },
      { label: 'Changed', items: (diff.changed ?? []).filter(match), tone: 'warn' },
    ];
  }, [diff, search]);

  const chrome = html`
    <div class="feat-queue-chrome">
      <${TextField}
        icon="search"
        value=${search}
        onInput=${(e) => onSearch?.(e.target.value)}
        placeholder="Search jar changes…"
        aria-label="Search jar changes"
      />
    </div>
  `;

  if (!diff || !diff.has_changes) {
    return html`
      <div class="feat-mods-changes">
        ${chrome}
        <${EmptyState}
          title="No jar changes"
          body="The mod folder matches the last report — no added, removed, or changed jars."
        />
      </div>
    `;
  }

  const anyVisible = groups.some((g) => g.items.length > 0);

  return html`
    <div class="feat-mods-changes">
      ${chrome}
      <p class="feat-hint">Jar inventory changes since the last report (not update/compat conflicts).</p>
      <div class="feat-mods-changes__summary">
        <${Badge} tone="ok">+${diff.added_count ?? (diff.added ?? []).length} added</${Badge}>
        <${Badge} tone="danger">−${diff.removed_count ?? (diff.removed ?? []).length} removed</${Badge}>
        <${Badge} tone="warn">~${diff.changed_count ?? (diff.changed ?? []).length} changed</${Badge}>
      </div>
      ${!anyVisible ? html`
        <${EmptyState} title="No matching jar changes" body="Nothing matches this search." />
      ` : groups.map(({ label, items, tone }) => items.length > 0 && html`
        <${Section} key=${label} title="${label} (${items.length})" defaultOpen=${true}>
          <div class="feat-list">
            ${items.map((m) => {
              const fact = modById.get(m.mod_id);
              const mrUrl = fact?.modrinth_url || fact?.modrinth_cta_url;
              return html`
              <${ListRow}
                key=${m.jar ?? m.mod_id}
                tone=${tone}
                title=${m.display_name ?? m.mod_id ?? m.jar}
                meta=${[m.mod_id && m.mod_id !== m.display_name ? m.mod_id : null, m.jar].filter(Boolean).join(' · ')}
                badge=${m.version ? html`<${Badge} tone="neutral">${m.version}</${Badge}>` : null}
              >
                <${ModActionRow}>
                  ${m.mod_id ? html`
                    <${Button}
                      kind="neutral"
                      size="sm"
                      onClick=${() => navigate('mods', { view: 'overview', mod: m.mod_id })}
                    >Open Overview</${Button}>
                  ` : null}
                  ${mrUrl ? html`<${ModLinkChip} href=${mrUrl} label="Modrinth" />` : null}
                </${ModActionRow}>
              </${ListRow}>
            `;
            })}
          </div>
        </${Section}>
      `)}
    </div>
  `;
}

function LogErrorsTab({
  modLogErrors,
  factsErrors,
  recommendations,
  modIssues,
  hasReport,
  search,
  onSearch,
}) {
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());

  const rows = useMemo(
    () => mergeLogErrorRows({
      opsBlock: modLogErrors,
      factsErrors,
      recommendations,
      modIssues,
      hasReport,
    }),
    [modLogErrors, factsErrors, recommendations, modIssues, hasReport],
  );

  // Auto-expand the only row so a single noise aggregate is immediately useful
  useEffect(() => {
    if (rows.length === 1) {
      setExpanded(new Set([rows[0].mod_id]));
    }
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((e) =>
      (e.mod_id ?? '').toLowerCase().includes(q)
      || (e.display_name ?? '').toLowerCase().includes(q)
      || (e.category_label ?? '').toLowerCase().includes(q)
      || (e.top_category ?? '').toLowerCase().includes(q)
      || (e.sample_lines ?? []).some((l) => String(l).toLowerCase().includes(q))
    );
  }, [rows, search]);

  async function handleScan() {
    setScanning(true);
    try {
      await scanMods(true);
      addToast('Mod log scan complete', 'success');
    } finally {
      setScanning(false);
    }
  }

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const scannedAt = modLogErrors?.scanned_at;
  const neverScanned = !modLogErrors && !(Array.isArray(factsErrors) && factsErrors.length);

  if (!filtered.length) {
    return html`
      <div class="feat-mods-errors">
        <div class="feat-queue-chrome">
          <${TextField}
            icon="search"
            value=${search}
            onInput=${(e) => onSearch?.(e.target.value)}
            placeholder="Search log errors…"
            aria-label="Search log errors"
          />
        </div>
        <${EmptyState}
          title=${neverScanned ? 'No mod log scan yet' : 'No matching log errors'}
          body=${neverScanned
            ? 'Scan server logs for per-mod ERROR aggregates, or run a report to populate samples and fix advice.'
            : (search.trim()
              ? 'Nothing matches this search.'
              : 'Last scan found no mod log error aggregates.')}
          action=${html`<${Button} kind="accent" onClick=${handleScan} loading=${scanning}>Scan now</${Button}>`}
        />
      </div>
    `;
  }

  return html`
    <div class="feat-mods-errors">
      <div class="feat-queue-chrome">
        <${TextField}
          icon="search"
          value=${search}
          onInput=${(e) => onSearch?.(e.target.value)}
          placeholder="Search log errors…"
          aria-label="Search log errors"
        />
        <${Button} kind="primary" size="sm" loading=${scanning} onClick=${handleScan}>Rescan logs</${Button}>
      </div>
      <div class="feat-toolbar feat-toolbar--wrap">
        <span class="feat-hint ui-text-low">
          ${filtered.length} mod(s)
          ${hasReport ? ' · report + scan merged' : ' · scan only'}
          ${scannedAt ? ` · last scan ${new Date(scannedAt).toLocaleString()}` : ' · not scanned yet'}
        </span>
      </div>
      <div class="feat-list feat-mods-errors__list">
        ${filtered.map((row) => {
          const open = expanded.has(row.mod_id);
          const tone = row.worry_level === 'informational' || row.severity === 'info'
            ? 'info'
            : (row.severity === 'critical' ? 'danger' : 'warn');
          const title = row.display_name || row.mod_id;
          const metaBits = [
            row.category_label || row.top_category,
            row.total != null ? `${row.total} hit${row.total === 1 ? '' : 's'}` : null,
            row.boot_only ? 'boot only' : null,
          ].filter(Boolean);
          return html`
            <${ListRow}
              key=${row.mod_id}
              tone=${tone}
              title=${title}
              meta=${metaBits.join(' · ')}
              badge=${html`
                <span class="feat-mods-errors__badges">
                  ${row.category_label || row.top_category
                    ? html`<${Badge} tone=${tone}>${row.category_label || row.top_category}</${Badge}>`
                    : null}
                  ${row.boot_only ? html`<${Badge} tone="neutral">boot</${Badge}>` : null}
                  <${Badge} tone="neutral">${row.total ?? 0}</${Badge}>
                </span>
              `}
              actions=${html`
                <${Button} kind="neutral" size="sm" className="feat-mods-errors__expand" onClick=${(e) => { e.stopPropagation(); toggle(row.mod_id); }}>
                  ${open ? 'Hide details' : 'Show samples & fix'}
                </${Button}>
              `}
              onClick=${() => toggle(row.mod_id)}
            >
              ${open ? html`
                <div class="feat-mods-errors__detail">
                  ${row.explanation || row.why ? html`
                    <p class="feat-mods-errors__why">${row.explanation || row.why}</p>
                  ` : null}

                  ${row.by_category && Object.keys(row.by_category).length ? html`
                    <div class="feat-mods-errors__cats">
                      ${Object.entries(row.by_category).map(([k, v]) => html`
                        <${Badge} key=${k} tone="neutral">${k.replace(/_/g, ' ')} · ${v}</${Badge}>
                      `)}
                    </div>
                  ` : null}

                  ${row.top_recipes?.length ? html`
                    <p class="feat-hint">Recipes / items: <code>${row.top_recipes.join(', ')}</code></p>
                  ` : null}

                  <div class="feat-mods-errors__samples">
                    <div class="issues-fix__label">Log samples</div>
                    ${(row.sample_lines?.length ? row.sample_lines : (row.sample_line ? [row.sample_line] : [])).map((line, i) => html`
                      <pre key=${i} class="feat-mods-errors__sample">${line}</pre>
                    `)}
                    ${!(row.sample_lines?.length || row.sample_line) ? html`
                      <p class="ui-text-low">No sample lines captured for this mod.</p>
                    ` : null}
                  </div>

                  ${row.fix_steps?.length ? html`
                    <div class="issues-fix">
                      <div class="issues-fix__label">Do this next</div>
                      <ol class="issues-fix__steps">
                        ${row.fix_steps.map((s, si) => html`<li key=${si}>${s}</li>`)}
                      </ol>
                      ${row.doc_url ? html`
                        <a class="issues-fix__doc" href=${row.doc_url} target="_blank" rel="noopener noreferrer">Open mod docs</a>
                      ` : null}
                    </div>
                  ` : html`
                    <p class="feat-hint ui-text-low">
                      ${hasReport
                        ? 'No specific fix mapped for this category yet — samples above are from your latest report/scan.'
                        : 'Scan logs for samples. Continuous Modrinth/conflict advice appears when those jobs finish — no deep audit required.'}
                    </p>
                  `}
                </div>
              ` : null}
            </${ListRow}>
          `;
        })}
      </div>
    </div>
  `;
}

function sampleLinesFrom(row) {
  if (Array.isArray(row?.sample_lines) && row.sample_lines.length) {
    return row.sample_lines.map(String);
  }
  if (row?.sample_line) return [String(row.sample_line)];
  return [];
}

function mergeLogErrorRows({ opsBlock, factsErrors, recommendations, modIssues, hasReport }) {
  const byId = new Map();

  function upsert(raw, source) {
    if (!raw || typeof raw !== 'object') return;
    const id = raw.mod_id ?? raw.id;
    if (!id) return;
    const prev = byId.get(id) ?? {
      mod_id: id,
      total: 0,
      sample_lines: [],
      by_category: {},
      top_recipes: [],
      sources: [],
    };
    const preferReport = source === 'report' || !prev.from_report;
    const next = { ...prev, sources: [...prev.sources, source] };
    if (source === 'report') next.from_report = true;

    const total = Number(raw.total);
    if (Number.isFinite(total)) {
      next.total = preferReport || !prev.total ? total : Math.max(prev.total, total);
    }
    if (raw.display_name && (preferReport || !prev.display_name)) next.display_name = raw.display_name;
    if (raw.category_label && (preferReport || !prev.category_label)) next.category_label = raw.category_label;
    if (raw.top_category && (preferReport || !prev.top_category)) next.top_category = raw.top_category;
    if (raw.boot_only != null && (preferReport || prev.boot_only == null)) next.boot_only = !!raw.boot_only;
    if (raw.explanation && (preferReport || !prev.explanation)) next.explanation = raw.explanation;
    if (raw.worry_level && (preferReport || !prev.worry_level)) next.worry_level = raw.worry_level;
    if (raw.severity && (preferReport || !prev.severity)) next.severity = raw.severity;

    if (raw.by_category && typeof raw.by_category === 'object') {
      next.by_category = preferReport && Object.keys(raw.by_category).length
        ? { ...raw.by_category }
        : { ...prev.by_category, ...raw.by_category };
    }
    const samples = sampleLinesFrom(raw);
    if (samples.length) {
      const merged = [...(preferReport ? samples : prev.sample_lines)];
      for (const s of preferReport ? prev.sample_lines : samples) {
        if (!merged.includes(s)) merged.push(s);
      }
      next.sample_lines = merged.slice(0, 8);
      next.sample_line = next.sample_lines[0];
    }
    if (Array.isArray(raw.top_recipes) && raw.top_recipes.length) {
      const recipes = preferReport ? [...raw.top_recipes] : [...prev.top_recipes];
      for (const r of preferReport ? prev.top_recipes : raw.top_recipes) {
        if (!recipes.includes(r)) recipes.push(r);
      }
      next.top_recipes = recipes.slice(0, 8);
    }
    byId.set(id, next);
  }

  const factsArr = Array.isArray(factsErrors)
    ? factsErrors
    : (Array.isArray(factsErrors?.entries) ? factsErrors.entries : []);
  for (const e of factsArr) upsert(e, 'report');
  for (const e of opsBlock?.entries ?? []) upsert(e, 'scan');

  const recById = new Map();
  for (const r of recommendations ?? []) {
    if (r?.mod_id) recById.set(r.mod_id, r);
  }
  const issueById = new Map();
  for (const iss of modIssues ?? []) {
    if (iss?.resolved) continue;
    const id = iss.mod_id;
    if (!id) continue;
    if (!issueById.has(id)) issueById.set(id, iss);
  }

  const out = [];
  for (const row of byId.values()) {
    const rec = recById.get(row.mod_id);
    const iss = issueById.get(row.mod_id);
    if (rec) {
      row.why = rec.why ?? row.why ?? row.explanation;
      row.severity = rec.severity ?? row.severity;
      row.worry_level = rec.worry_level ?? row.worry_level;
      const steps = [];
      if (Array.isArray(rec.fix_steps)) steps.push(...rec.fix_steps.filter(Boolean));
      if (!steps.length && rec.fix) steps.push(rec.fix);
      if (rec.install_hint && !steps.includes(rec.install_hint)) steps.push(rec.install_hint);
      row.fix_steps = steps;
      if (rec.doc_url) row.doc_url = rec.doc_url;
      if (!row.explanation && rec.explanation) row.explanation = rec.explanation;
    } else if (iss) {
      row.why = iss.narrative ?? row.why;
      row.severity = iss.severity ?? row.severity;
      const steps = [];
      if (Array.isArray(iss.fix_steps) && iss.fix_steps.length) steps.push(...iss.fix_steps.filter(Boolean));
      else if (Array.isArray(iss.hints)) {
        // Drop legacy “run a full report for X” lines when we already have a report
        for (const h of iss.hints) {
          if (!h) continue;
          if (hasReport && /run a full report/i.test(String(h))) continue;
          steps.push(h);
        }
      }
      row.fix_steps = steps;
      if (iss.doc_url) row.doc_url = iss.doc_url;
    }
    if (!row.category_label && row.top_category) {
      row.category_label = String(row.top_category).replace(/_/g, ' ');
    }
    out.push(row);
  }

  out.sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || String(a.mod_id).localeCompare(String(b.mod_id)));
  return out;
}

function ForensicsTab({ factsOptional, search, onSearch, hasReport }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const mf = factsOptional?.mod_forensics ?? {};
  const deep = status?.mods_deep ?? null;
  const health = (Array.isArray(deep?.config_health) && deep.config_health.length)
    ? deep.config_health
    : (factsOptional?.config_health ?? []);
  const corrupt = (Array.isArray(deep?.corrupt_jars) && deep.corrupt_jars.length)
    ? deep.corrupt_jars
    : (mf.corrupt_jars ?? []);
  const hasDeepLedger = !!(deep && deep.status === 'ok')
    || corrupt.length > 0
    || health.length > 0;

  async function refresh() {
    setLoading(true);
    try {
      setStatus(await forensicsStatus());
    } catch (e) {
      addToast(e?.message || 'Forensics status failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const q = (search ?? '').trim().toLowerCase();
  const corruptFiltered = useMemo(() => {
    if (!q) return corrupt;
    return corrupt.filter((c) =>
      String(c.path || '').toLowerCase().includes(q)
      || String(c.reason || '').toLowerCase().includes(q)
      || String(c.source || '').toLowerCase().includes(q)
    );
  }, [corrupt, q]);
  const healthFiltered = useMemo(() => {
    if (!q) return health;
    return health.filter((c) =>
      String(c.path || '').toLowerCase().includes(q)
      || String(c.reason || '').toLowerCase().includes(q)
    );
  }, [health, q]);

  const indexState = status?.index?.state ?? mf.class_index_status ?? '—';
  const masterOff = status?.config?.mod_forensics_scan === false;
  const skipped = masterOff || indexState === 'skipped';
  const jarCount = status?.index?.jar_count;
  const entryCount = status?.index?.entry_count;
  const stale = !!status?.index?.stale;
  const indexTone = skipped ? 'neutral' : stale ? 'warn' : (indexState === 'ready' || indexState === 'ok') ? 'ok' : 'info';

  if (skipped) {
    return html`
      <div class="feat-mods-forensics">
        <${EmptyState}
          title="Forensics is off"
          body="Enable MOD_FORENSICS_SCAN in watchtower.conf to index jars for Find owning jar, corrupt scans, and config health."
          action=${html`<${Button} kind="neutral" size="sm" onClick=${() => navigate('settings', { panel: 'monitoring' })}>Open Settings</${Button}>`}
        />
      </div>
    `;
  }

  return html`
    <div class="feat-mods-forensics">
      <div class="feat-mods-forensics__chrome feat-queue-chrome">
        <${TextField}
          id="mods-forensics-search"
          icon="search"
          value=${search}
          onInput=${(e) => onSearch?.(e.target.value)}
          placeholder="Search corrupt jars or config paths…"
          aria-label="Search forensics findings"
        />
        <${Button} kind="neutral" size="sm" loading=${loading} onClick=${refresh}>Refresh status</${Button}>
      </div>

      <div class="feat-mods-forensics__kpis">
        <div class="feat-mods-forensics__kpi">
          <span class="feat-mods-forensics__kpi-label">Class index</span>
          <span class="feat-mods-forensics__kpi-value">
            <${Badge} tone=${indexTone}>${indexState}</${Badge}>
            ${stale ? html`<${Badge} tone="warn">stale</${Badge}>` : null}
          </span>
          <span class="feat-mods-forensics__kpi-hint">
            ${jarCount != null ? `${jarCount} jars · ${entryCount ?? 0} entries` : 'From live status / last report'}
          </span>
        </div>
        <div class="feat-mods-forensics__kpi">
          <span class="feat-mods-forensics__kpi-label">Corrupt jars</span>
          <span class="feat-mods-forensics__kpi-value">${corrupt.length}</span>
          <span class="feat-mods-forensics__kpi-hint">${q ? `${corruptFiltered.length} match search` : (hasDeepLedger ? 'From continuous ledger' : 'Awaiting continuous scan')}</span>
        </div>
        <div class="feat-mods-forensics__kpi">
          <span class="feat-mods-forensics__kpi-label">Config issues</span>
          <span class="feat-mods-forensics__kpi-value">${health.length}</span>
          <span class="feat-mods-forensics__kpi-hint">${q ? `${healthFiltered.length} match search` : (hasDeepLedger ? 'From continuous ledger' : 'Awaiting continuous scan')}</span>
        </div>
      </div>

      <div class="feat-mods-forensics__hint">
        ${indexState === 'idle'
          ? html`<p>No class index yet — it builds on jar change / boot seed, or first <strong>Crashes → Find owning jar</strong>.</p>`
          : html`<p>Use <strong>Crashes → Find owning jar</strong> to resolve stack frames, or the CLI <code>watchtower forensics find-class</code>.</p>`}
        ${!hasDeepLedger && !hasReport
          ? html`<p class="feat-mods-forensics__hint-warn">Continuous Mods deep is warming — corrupt / config lists appear after jar inventory or boot seed (no deep audit required).</p>`
          : null}
      </div>

      <div class="feat-mods-forensics__panels">
        <section class="feat-mods-forensics__panel">
          <header class="feat-mods-forensics__panel-head">
            <h3 class="feat-mods-forensics__panel-title">Corrupt jars</h3>
            <${Badge} tone=${corruptFiltered.length ? 'danger' : 'ok'}>${corruptFiltered.length}</${Badge}>
          </header>
          ${corruptFiltered.length ? html`
            <ul class="feat-mods-forensics__findings">
              ${corruptFiltered.slice(0, 40).map((c, i) => html`
                <li class="feat-mods-forensics__finding feat-mods-forensics__finding--danger" key=${i}>
                  <div class="feat-mods-forensics__finding-main">
                    <span class="feat-mods-forensics__finding-path">${c.path || '?'}</span>
                    <span class="feat-mods-forensics__finding-meta">${[c.source, c.reason].filter(Boolean).join(' · ')}</span>
                  </div>
                  <${Badge} tone="danger">${c.reason || 'corrupt'}</${Badge}>
                </li>
              `)}
            </ul>
          ` : html`
            <${EmptyState}
              title=${q ? 'No matches' : 'No corrupt jars'}
              body=${q ? 'No corrupt jars match this search.' : 'No corrupt jars in the latest report.'}
            />
          `}
        </section>

        <section class="feat-mods-forensics__panel">
          <header class="feat-mods-forensics__panel-head">
            <h3 class="feat-mods-forensics__panel-title">Config health</h3>
            <${Badge} tone=${healthFiltered.length ? 'warn' : 'ok'}>${healthFiltered.length}</${Badge}>
          </header>
          ${healthFiltered.length ? html`
            <ul class="feat-mods-forensics__findings">
              ${healthFiltered.slice(0, 40).map((c, i) => html`
                <li class="feat-mods-forensics__finding feat-mods-forensics__finding--warn" key=${i}>
                  <div class="feat-mods-forensics__finding-main">
                    <span class="feat-mods-forensics__finding-path">${c.path || '?'}</span>
                    <span class="feat-mods-forensics__finding-meta">${c.reason || ''}</span>
                  </div>
                  <${Badge} tone="warn">${c.reason || 'issue'}</${Badge}>
                </li>
              `)}
            </ul>
          ` : html`
            <${EmptyState}
              title=${q ? 'No matches' : 'No config issues'}
              body=${q ? 'No config issues match this search.' : 'No config issues in the latest report.'}
            />
          `}
        </section>
      </div>
    </div>
  `;
}

const VALID_MOD_VIEWS = new Set(SUBNAV.map((o) => o.value));

export function PageView() {
  const { params } = ui.value.route;
  const rawView = params?.view ?? 'overview';
  const activeView = VALID_MOD_VIEWS.has(rawView) ? rawView : 'overview';
  const initialModId = params?.mod || null;

  const opsCacheData = opsCache.value.data;
  const runningMods = opsCacheData?.running_mods;
  const modsInventory = opsCacheData?.mods_inventory;
  const modLogErrors = opsCacheData?.mod_log_errors;
  const modIssues = opsCacheData?.mod_issues?.entries ?? [];
  const recommendations = reports.value?.facts?.optional?.mod_recommendations ?? [];
  const factsOptional = reports.value?.facts?.optional ?? {};
  const modrinthUpdates = factsOptional.modrinth_updates
    ?? opsCacheData?.modrinth_scan?.updates
    ?? [];
  const modrinthLookupEnabled = settings.value?.data?.modrinth_lookup;
  const hasReport = !!reports.value?.facts;

  const badgeMaps = useMemo(() => {
    const sideById = new Map();
    const clientBucketById = new Map();
    const clientOnlyById = new Map();
    const metaById = new Map();
    const connectorById = new Map();
    const securityById = new Map();
    // Prefer fresher continuous mods_light when present; facts still enrich Modrinth/meta
    const lightMods = Array.isArray(opsCacheData?.mods_light?.mods)
      ? opsCacheData.mods_light.mods
      : [];
    const mods = (lightMods.length ? lightMods : null) ?? factsOptional.mods ?? [];
    for (const m of mods) {
      const id = m.id ?? m.mod_id;
      if (!id) continue;
      if (m.side_score) sideById.set(id, m.side_score);
      metaById.set(id, { is_mcreator: !!m.is_mcreator, loader_hint: m.loader_hint });
    }
    // Overlay report Modrinth/meta fields when light path was used
    if (lightMods.length) {
      for (const m of factsOptional.mods ?? []) {
        const id = m.id ?? m.mod_id;
        if (!id) continue;
        const prev = metaById.get(id) || {};
        metaById.set(id, {
          ...prev,
          is_mcreator: !!m.is_mcreator || !!prev.is_mcreator,
          loader_hint: m.loader_hint ?? prev.loader_hint,
        });
        if (m.side_score && !sideById.has(id)) sideById.set(id, m.side_score);
      }
    }
    const clientOnlySrc = opsCacheData?.mods_light?.client_only_mods_summary?.mods
      ?? factsOptional.client_only_mods
      ?? [];
    for (const m of clientOnlySrc) {
      if (m.mod_id) {
        clientBucketById.set(m.mod_id, m.bucket);
        clientOnlyById.set(m.mod_id, m);
      }
    }
    for (const w of factsOptional.connector_warnings ?? []) {
      const id = w.mod_id ?? w.id;
      if (id) connectorById.set(id, w);
    }
    for (const f of factsOptional.security_flags ?? []) {
      const id = f.mod_id ?? f.id;
      if (id) securityById.set(id, f);
    }
    return {
      sideById, clientBucketById, clientOnlyById, metaById, connectorById, securityById,
      hasFacts: mods.length > 0,
      connectorWarnings: factsOptional.connector_warnings ?? [],
      securityFlags: factsOptional.security_flags ?? [],
    };
  }, [factsOptional, opsCacheData?.mods_light]);

  const [search, setSearch] = useState('');
  const [showTechNames, setShowTechNames] = useState(() => {
    try { return localStorage.getItem('wt.techNames') === 'true'; } catch { return false; }
  });

  function handleTechNames(v) {
    setShowTechNames(v);
    try { localStorage.setItem('wt.techNames', String(v)); } catch {}
  }

  function handleViewChange(v) {
    navigate('mods', { view: v });
  }

  const subnavOptions = useMemo(() => {
    const count = Array.isArray(modrinthUpdates) ? modrinthUpdates.length : 0;
    return SUBNAV.map((opt) => (
      opt.value === 'updates' && count > 0
        ? { ...opt, label: `Updates (${count})` }
        : opt
    ));
  }, [modrinthUpdates]);

  return html`
    <${Page}
      tour="mods"
      title="Mods"
      subtitle="Mod inventory, compatibility, and log errors"
      actions=${html`
        <div class="feat-toolbar">
          <${Toggle} checked=${showTechNames} onChange=${handleTechNames} label="Tech names" />
        </div>
      `}
    >
      <div class="feat-mods-nav">
        <${Subnav}
          options=${subnavOptions}
          value=${activeView}
          onChange=${handleViewChange}
        />
      </div>

      ${activeView === 'overview' && html`
        <${OverviewTab}
          runningMods=${runningMods}
          modsInventory=${modsInventory}
          showTechNames=${showTechNames}
          search=${search}
          onSearch=${setSearch}
          badgeMaps=${badgeMaps}
          factsMods=${factsOptional.mods ?? []}
          initialModId=${initialModId}
          updateCount=${Array.isArray(modrinthUpdates) ? modrinthUpdates.length : 0}
          modrinthLookupEnabled=${modrinthLookupEnabled}
        />
      `}
      ${activeView === 'updates' && html`
        <${UpdatesTab}
          modrinthUpdates=${modrinthUpdates}
          factsMods=${factsOptional.mods ?? []}
          runningMods=${runningMods}
          badgeMaps=${badgeMaps}
          showTechNames=${showTechNames}
          search=${search}
          onSearch=${setSearch}
          initialModId=${initialModId}
          modrinthLookupEnabled=${modrinthLookupEnabled}
          hasReport=${hasReport}
        />
      `}
      ${activeView === 'modrinth' && html`
        <${ModrinthTab} hasReport=${hasReport} />
      `}
      ${activeView === 'conflicts' && html`
        <${ConflictsTab}
          recommendations=${recommendations}
          modIssues=${modIssues}
          factsMods=${factsOptional.mods ?? opsCacheData?.mods_light?.mods ?? []}
          search=${search}
          onSearch=${setSearch}
        />
      `}
      ${activeView === 'changes' && html`
        <${ChangesTab}
          modsInventory=${modsInventory}
          search=${search}
          onSearch=${setSearch}
          factsMods=${factsOptional.mods ?? []}
        />
      `}

      ${activeView === 'log-errors' && html`
        <${LogErrorsTab}
          modLogErrors=${modLogErrors}
          factsErrors=${factsOptional.mod_log_errors}
          recommendations=${recommendations}
          modIssues=${modIssues}
          hasReport=${!!reports.value?.facts}
          search=${search}
          onSearch=${setSearch}
        />
      `}
      ${activeView === 'forensics' && html`
        <${ForensicsTab}
          factsOptional=${factsOptional}
          search=${search}
          onSearch=${setSearch}
          hasReport=${hasReport}
        />
      `}
    </${Page}>
  `;
}
