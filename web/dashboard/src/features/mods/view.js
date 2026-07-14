import { html, useState, useMemo, useEffect } from '../../lib/preact.js';
import { opsCache, ui, reports } from '../../state/stores.js';
import { setRoute } from '../../state/stores.js';
import { scanMods, ignoreClientMod, addToast, fetchModsTree } from '../../state/actions.js';
import { forensicsStatus } from '../../api/endpoints.js';
import { Page, Section, DataTable, FilterBar, EmptyState, ListRow, Subnav } from '../../ui/patterns/index.js';
import { Button, Badge, Toggle, Combobox } from '../../ui/primitives/index.js';

const SUBNAV = [
  { value: 'overview', label: 'Overview' },
  { value: 'conflicts', label: 'Conflicts' },
  { value: 'changes', label: 'Changes' },
  { value: 'client-only', label: 'Client-only' },
  { value: 'dependencies', label: 'Dependencies' },
  { value: 'log-errors', label: 'Log errors' },
  { value: 'forensics', label: 'Forensics' },
];

const CLIENT_SIDE_IDS = new Set([
  'sodium', 'embeddium', 'oculus', 'iris', 'entity_texture_features',
  'playeranimator', 'xaeros_minimap', 'xaeros_worldmap', 'journeymap',
  'appleskin', 'jei', 'inventorysorter', 'trashslot', 'craftingtweaks',
  'controlling', 'searchables', 'jade', 'carryon', 'sound_physics_remastered',
]);

const BUCKET_TONE = {
  likely_removable: 'danger',
  client_library: 'info',
  uncertain: 'warn',
  test_remove: 'neutral',
  server_required: 'ok',
};

function modDisplayName(mod, showTechNames) {
  if (showTechNames) return mod.id ?? mod.mod_id ?? mod.display_name ?? '?';
  return mod.display_name ?? mod.id ?? mod.mod_id ?? '?';
}

function bucketLabel(bucket) {
  return (bucket ?? '').replace(/_/g, '-');
}

function OverviewTab({ runningMods, modsInventory, showTechNames, search, badgeMaps }) {
  const mods = runningMods?.mods ?? [];
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return mods;
    const q = search.toLowerCase();
    return mods.filter((m) =>
      (m.display_name ?? '').toLowerCase().includes(q) ||
      (m.id ?? '').toLowerCase().includes(q)
    );
  }, [mods, search]);

  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const cols = [
    { key: '_name', label: 'Name', render: (_, row) => modDisplayName(row, showTechNames) },
    { key: 'version', label: 'Version', render: (v) => v ?? '—' },
    {
      key: 'id',
      label: 'Source',
      render: (v) => {
        const badges = [];
        const side = badgeMaps.sideById.get(v);
        const clientBucket = badgeMaps.clientBucketById.get(v);
        const meta = badgeMaps.metaById.get(v);
        if (side === 'server_required') {
          badges.push(html`<${Badge} key="sr" tone="ok">server-required</${Badge}>`);
        } else if (clientBucket) {
          badges.push(html`<${Badge} key="b" tone=${BUCKET_TONE[clientBucket] ?? 'neutral'}>${bucketLabel(clientBucket)}</${Badge}>`);
        } else if (CLIENT_SIDE_IDS.has(v) && !badgeMaps.hasFacts) {
          badges.push(html`<${Badge} key="c" tone="info">client</${Badge}>`);
        }
        if (meta?.is_mcreator) {
          badges.push(html`<${Badge} key="mc" tone="neutral">MCreator</${Badge}>`);
        }
        if (meta?.loader_hint === 'fabric_in_neoforge_jar') {
          badges.push(html`<${Badge} key="fab" tone="warn">Fabric jar</${Badge}>`);
        }
        if (badgeMaps.connectorById?.has(v)) {
          badges.push(html`<${Badge} key="conn" tone="info">Connector analogue</${Badge}>`);
        }
        if (badgeMaps.securityById?.has(v)) {
          badges.push(html`<${Badge} key="sec" tone="danger">Security risk</${Badge}>`);
        }
        return html`<div class="feat-mods-badges">${badges}</div>`;
      }
    },
  ];

  if (!mods.length) {
    return html`<${EmptyState} title="No mod list" body="Run a report to populate the mod manifest." />`;
  }

  const securityFlags = badgeMaps.securityFlags ?? [];
  const connectorWarnings = badgeMaps.connectorWarnings ?? [];

  return html`
    <div class="feat-mods-overview">
      ${securityFlags.length ? html`
        <p class="feat-hint" style=${{ color: 'var(--ui-danger, #c44)' }}>
          Security: denylisted mod(s) detected — ${securityFlags.map((f) => f.mod_id || f.id).filter(Boolean).join(', ')}. Remove immediately.
        </p>
      ` : null}
      ${connectorWarnings.length ? html`
        <p class="feat-hint ui-text-low">
          Connector hygiene: Fabric-side mods present with NeoForge analogues available
          (${connectorWarnings.map((w) => w.mod_id || w.id).filter(Boolean).join(', ')}).
        </p>
      ` : null}
      <p class="feat-hint">${runningMods?.count ?? mods.length} mods loaded${modsInventory ? ' · ' + modsInventory.tldr : ''}</p>
      <div class="feat-table-scroll">
        <${DataTable}
          columns=${cols}
          rows=${paginated}
          rowKey="id"
          density=${36}
          stickyHeader=${true}
          empty="No mods match search"
        />
      </div>
      ${totalPages > 1 && html`
        <div class="feat-pagination">
          <${Button} kind="neutral" size="sm" disabled=${page === 0} onClick=${() => setPage((p) => p - 1)}>← Prev</${Button}>
          <span class="feat-pagination__label">${page + 1} / ${totalPages}</span>
          <${Button} kind="neutral" size="sm" disabled=${page >= totalPages - 1} onClick=${() => setPage((p) => p + 1)}>Next →</${Button}>
        </div>
      `}
    </div>
  `;
}

function ConflictsTab({ recommendations }) {
  const recs = Array.isArray(recommendations) ? recommendations : [];

  if (!recs.length) {
    return html`
      <${EmptyState}
        title="No update conflicts"
        body="No compatibility or update conflicts in the latest report or mod scan. Jar add/remove/change since the last report lives under Changes."
      />
    `;
  }

  return html`
    <div class="feat-mods-conflicts">
      <${Section} title=${`Update conflicts (${recs.length})`} defaultOpen=${true}>
        <div class="feat-list">
          ${recs.map((r, i) => {
            const tone = r.severity === 'critical' ? 'danger' : r.severity === 'warning' ? 'warn' : 'info';
            return html`
            <${ListRow}
              key=${r.mod_id ?? i}
              tone=${tone}
              title=${r.mod_id ?? r.category ?? 'Conflict'}
              meta=${r.why ?? r.action_detail ?? r.fix ?? ''}
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
            </${ListRow}>
          `;
          })}
        </div>
      </${Section}>
    </div>
  `;
}

function ChangesTab({ modsInventory }) {
  const diff = modsInventory?.diff;
  if (!diff || !diff.has_changes) {
    return html`
      <${EmptyState}
        title="No jar changes"
        body="The mod folder matches the last report — no added, removed, or changed jars."
      />
    `;
  }

  const groups = [
    { label: 'Added', items: diff.added ?? [], tone: 'ok' },
    { label: 'Removed', items: diff.removed ?? [], tone: 'danger' },
    { label: 'Changed', items: diff.changed ?? [], tone: 'warn' },
  ];

  return html`
    <div class="feat-mods-conflicts">
      <p class="feat-hint">Jar inventory changes since the last report (not update/compat conflicts).</p>
      ${groups.map(({ label, items, tone }) => items.length > 0 && html`
        <${Section} key=${label} title="${label} (${items.length})" defaultOpen=${true}>
          <div class="feat-list">
            ${items.map((m) => html`
              <${ListRow}
                key=${m.jar ?? m.mod_id}
                tone=${tone}
                title=${m.display_name ?? m.mod_id}
                meta=${m.jar ?? ''}
                badge=${m.version ? html`<${Badge} tone="neutral">${m.version}</${Badge}>` : null}
              />
            `)}
          </div>
        </${Section}>
      `)}
    </div>
  `;
}

function ClientOnlyTab({ runningMods, search }) {
  const factsOptional = reports.value?.facts?.optional ?? {};
  const scored = Array.isArray(factsOptional.client_only_mods) ? factsOptional.client_only_mods : null;
  const ignored = factsOptional.ignored_client_mods ?? {};
  const [ignoring, setIgnoring] = useState({});

  const rows = useMemo(() => {
    if (scored && scored.length) {
      return scored.filter((m) => !ignored[m.mod_id]);
    }
    const mods = runningMods?.mods ?? [];
    return mods
      .filter((m) => CLIENT_SIDE_IDS.has(m.id) && !ignored[m.id])
      .map((m) => ({
        mod_id: m.id,
        display_name: m.display_name,
        version: m.version,
        bucket: 'likely_removable',
        confidence: 'low',
        reason: 'Known client-side mod (heuristic fallback — run a report for scored results)',
        removal_advice: 'Confirm with a full report before removing.',
        signals: ['fallback'],
      }));
  }, [scored, runningMods, ignored]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((m) =>
      (m.display_name ?? '').toLowerCase().includes(q) || (m.mod_id ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  async function handleIgnore(modId, ignoredFlag) {
    setIgnoring((prev) => ({ ...prev, [modId]: true }));
    await ignoreClientMod(modId, ignoredFlag);
    setIgnoring((prev) => ({ ...prev, [modId]: false }));
    addToast(`${ignoredFlag ? 'Ignored' : 'Unignored'} ${modId}`, 'success');
  }

  if (!rows.length) {
    return html`<${EmptyState}
      title="No client-only mods detected"
      body=${scored ? 'Report scoring found no removable client-only candidates (or they are all ignored).' : 'Run a report to score client-only mods, or known client-side heuristics will appear here.'}
    />`;
  }

  return html`
    <div class="feat-mods-client">
      <p class="feat-hint ui-text-low">
        ${rows.length} client-side candidate(s)${scored ? ' from latest report' : ' (heuristic fallback)'} —
        review bucket, confidence, and dependents before removing.
        ${' '}Optional Modrinth refinement runs only on a full report when enabled in
        ${' '}<a class="ui-link" href="#" onClick=${(e) => { e.preventDefault(); setRoute('settings', { panel: 'monitoring' }); }}>Settings → Monitoring</a>.
      </p>
      <div class="feat-list">
        ${filtered.map((m) => html`
          <${ListRow}
            key=${m.mod_id}
            tone=${BUCKET_TONE[m.bucket] ?? 'warn'}
            title=${m.display_name ?? m.mod_id}
            meta=${`${m.version ?? ''} · ${m.confidence ?? ''} confidence`}
            badge=${html`<${Badge} tone=${BUCKET_TONE[m.bucket] ?? 'warn'}>${bucketLabel(m.bucket)}</${Badge}>`}
            actions=${html`
              <${Button}
                kind="neutral"
                size="sm"
                loading=${ignoring[m.mod_id]}
                onClick=${() => handleIgnore(m.mod_id, true)}
              >Ignore</${Button}>
            `}
          >
            <div class="feat-mods-client__detail">
              <div>${m.reason ?? ''}</div>
              ${m.removal_advice ? html`<div class="ui-text-low">${m.removal_advice}</div>` : null}
              ${(m.signals?.length) ? html`
                <div class="feat-mods-badges">
                  ${m.signals.map((s) => html`
                    <${Badge} key=${s} tone=${String(s).startsWith('modrinth:') ? 'info' : 'neutral'}>${s}</${Badge}>
                  `)}
                </div>
              ` : null}
              ${(m.dependents?.length) ? html`
                <div class="feat-mods-badges">
                  <span class="ui-text-low">Needed by:</span>
                  ${m.dependents.map((d) => html`
                    <button
                      key=${d}
                      class="feat-mods-dep-link"
                      type="button"
                      onClick=${() => setRoute('mods', { view: 'dependencies', mod: d })}
                    >${d}</button>
                  `)}
                </div>
              ` : null}
            </div>
          </${ListRow}>
        `)}
      </div>
    </div>
  `;
}

function TreeNode({ node, depth = 0 }) {
  const hasChildren = node.children?.length > 0;
  const [open, setOpen] = useState(depth < 2);
  return html`
    <div class="feat-mods-tree__node" style=${{ '--depth': depth }}>
      <div class="feat-mods-tree__row">
        ${hasChildren ? html`
          <button type="button" class="feat-mods-tree__toggle" onClick=${() => setOpen((v) => !v)}>
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
          ${node.children.map((c) => html`<${TreeNode} key=${c.mod_id} node=${c} depth=${depth + 1} />`)}
        </div>
      ` : null}
    </div>
  `;
}

function DependenciesTab({ runningMods }) {
  const factsMods = reports.value?.facts?.optional?.mods ?? [];
  const fallbackMods = runningMods?.mods ?? [];
  const mods = factsMods.length ? factsMods : fallbackMods;
  const routeMod = ui.value.route?.params?.mod ?? '';

  const options = useMemo(() => {
    return mods
      .map((m) => ({
        value: m.id ?? m.mod_id,
        label: `${m.display_name ?? m.id ?? m.mod_id} (${m.id ?? m.mod_id})`,
      }))
      .filter((o) => o.value)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mods]);

  const [modId, setModId] = useState(routeMod || options[0]?.value || 'create');
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (routeMod && routeMod !== modId) setModId(routeMod);
  }, [routeMod]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!modId) return;
      if (!factsMods.length) {
        setTree(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      let data = await fetchModsTree(modId);
      if ((!data || !data.dependents) && factsMods.length) {
        const { toTree } = await import('../../domain/mod-graph.js');
        const match = factsMods.find((m) => (m.id ?? m.mod_id) === modId);
        if (match) {
          data = {
            mod_id: modId,
            side_score: match.side_score ?? null,
            dependents: toTree(modId, factsMods, 'dependents', 6),
            dependencies: toTree(modId, factsMods, 'dependencies', 6),
          };
        }
      }
      if (!cancelled) {
        setTree(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [modId, factsMods]);

  if (!factsMods.length) {
    return html`<${EmptyState}
      title="Run a report to build the dependency tree"
      body="Dependency trees are built from the latest report's mod manifest (TOML dependencies)."
    />`;
  }

  return html`
    <div class="feat-mods-deps">
      <div class="feat-toolbar">
        <${Combobox}
          options=${options}
          value=${modId}
          onSelect=${(v) => {
            setModId(v);
            setRoute('mods', { view: 'dependencies', mod: v });
          }}
          placeholder="Pick a mod…"
        />
      </div>
      ${loading ? html`<p class="feat-hint ui-text-low">Loading tree…</p>` : null}
      ${tree ? html`
        <${Section} title="Needed by (dependents)" defaultOpen=${true}>
          ${(tree.dependents?.children?.length)
            ? html`<div class="feat-mods-tree"><${TreeNode} node=${tree.dependents} /></div>`
            : html`<p class="ui-text-low">No mods declare a mandatory dependency on this one.</p>`}
        </${Section}>
        <${Section} title="Needs (dependencies)" defaultOpen=${true}>
          ${(tree.dependencies?.children?.length)
            ? html`<div class="feat-mods-tree"><${TreeNode} node=${tree.dependencies} /></div>`
            : html`<p class="ui-text-low">No declared dependencies in the report manifest.</p>`}
        </${Section}>
      ` : (!loading && html`<${EmptyState} title="Mod not found" body="That mod id is not in the latest report." />`)}
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
      <div>
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
      <div class="feat-toolbar feat-toolbar--wrap">
        <span class="feat-hint ui-text-low">
          ${filtered.length} mod(s)
          ${hasReport ? ' · report + scan merged' : ' · scan only'}
          ${scannedAt ? ` · last scanned ${new Date(scannedAt).toLocaleString()}` : ''}
        </span>
        <${Button} kind="neutral" size="sm" loading=${scanning} onClick=${handleScan}>Rescan</${Button}>
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
              onClick=${() => toggle(row.mod_id)}
            >
              <button
                type="button"
                class="feat-mods-errors__toggle"
                onClick=${(e) => { e.stopPropagation(); toggle(row.mod_id); }}
              >
                ${open ? 'Hide details' : 'Show samples & fix'}
              </button>
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
                        : 'Run Report to generate conflict analysis and fix steps for this mod.'}
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

function ForensicsTab({ factsOptional }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const mf = factsOptional?.mod_forensics ?? {};
  const health = factsOptional?.config_health ?? [];
  const corrupt = mf.corrupt_jars ?? [];

  async function refresh() {
    setLoading(true);
    try {
      setStatus(await forensicsStatus());
    } catch (e) {
      addToast({ tone: 'danger', message: e?.message || 'Forensics status failed' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const indexState = status?.index?.state ?? mf.class_index_status ?? '—';
  const masterOff = status?.config?.mod_forensics_scan === false;
  const skipped = masterOff || indexState === 'skipped';

  return html`
    <div class="feat-mods-forensics">
      <div class="feat-toolbar">
        <span class="feat-hint">Class index, corrupt jars, and config health from the latest report</span>
        <${Button} kind="neutral" size="sm" loading=${loading} onClick=${refresh}>Refresh status</${Button}>
      </div>
      ${skipped ? html`
        <${EmptyState}
          title="Forensics disabled"
          body="Set MOD_FORENSICS_SCAN=true in watchtower.conf to enable the toolbox."
        />
      ` : html`
        <${Section} title="Index status">
          <p>State: <strong>${indexState}</strong>
            ${status?.index?.jar_count != null ? html` · ${status.index.jar_count} jars · ${status.index.entry_count ?? 0} entries` : null}
            ${status?.index?.stale ? html` · <${Badge} tone="warn">stale</${Badge}>` : null}
          </p>
          ${indexState === 'idle' ? html`
            <p class="ui-text-low">No class index yet — it builds on first Find owning jar / CLI find-class (or set FORENSICS_INDEX_ON_REPORT=true).</p>
          ` : html`
            <p class="ui-text-low">Use Crashes → Find owning jar, or CLI <code>watchtower forensics find-class</code>.</p>
          `}
        </${Section}>
        <${Section} title="Corrupt jars (${corrupt.length})">
          ${corrupt.length ? html`
            <ul>${corrupt.slice(0, 20).map((c, i) => html`
              <li key=${i}><code>${c.path || '?'}</code> · ${c.reason} · ${c.source || ''}</li>
            `)}</ul>
          ` : html`<p class="ui-text-low">None in latest report.</p>`}
        </${Section}>
        <${Section} title="Config health (${health.length})">
          ${health.length ? html`
            <ul>${health.slice(0, 20).map((c, i) => html`
              <li key=${i}><code>${c.path}</code> · ${c.reason}</li>
            `)}</ul>
          ` : html`<p class="ui-text-low">No config issues in latest report.</p>`}
        </${Section}>
      `}
    </div>
  `;
}

export function PageView() {
  const { params } = ui.value.route;
  const activeView = params?.view ?? 'overview';

  const opsCacheData = opsCache.value.data;
  const runningMods = opsCacheData?.running_mods;
  const modsInventory = opsCacheData?.mods_inventory;
  const modLogErrors = opsCacheData?.mod_log_errors;
  const modIssues = opsCacheData?.mod_issues?.entries ?? [];
  const recommendations = reports.value?.facts?.optional?.mod_recommendations ?? [];
  const factsOptional = reports.value?.facts?.optional ?? {};

  const badgeMaps = useMemo(() => {
    const sideById = new Map();
    const clientBucketById = new Map();
    const metaById = new Map();
    const connectorById = new Map();
    const securityById = new Map();
    const mods = factsOptional.mods ?? [];
    for (const m of mods) {
      const id = m.id ?? m.mod_id;
      if (!id) continue;
      if (m.side_score) sideById.set(id, m.side_score);
      metaById.set(id, { is_mcreator: !!m.is_mcreator, loader_hint: m.loader_hint });
    }
    for (const m of factsOptional.client_only_mods ?? []) {
      if (m.mod_id) clientBucketById.set(m.mod_id, m.bucket);
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
      sideById, clientBucketById, metaById, connectorById, securityById,
      hasFacts: mods.length > 0,
      connectorWarnings: factsOptional.connector_warnings ?? [],
      securityFlags: factsOptional.security_flags ?? [],
    };
  }, [factsOptional]);

  const [search, setSearch] = useState('');
  const [showTechNames, setShowTechNames] = useState(() => {
    try { return localStorage.getItem('wt.techNames') === 'true'; } catch { return false; }
  });

  function handleTechNames(v) {
    setShowTechNames(v);
    try { localStorage.setItem('wt.techNames', String(v)); } catch {}
  }

  function handleViewChange(v) {
    setRoute('mods', { view: v });
  }

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
      <${Subnav}
        options=${SUBNAV}
        value=${activeView}
        onChange=${handleViewChange}
      />

      ${activeView !== 'dependencies' ? html`
        <div class="feat-subnav-search">
          <${FilterBar}
            search=${search}
            onSearch=${setSearch}
            placeholder="Search mods…"
          />
        </div>
      ` : null}

      ${activeView === 'overview' && html`
        <${OverviewTab}
          runningMods=${runningMods}
          modsInventory=${modsInventory}
          showTechNames=${showTechNames}
          search=${search}
          badgeMaps=${badgeMaps}
        />
      `}
      ${activeView === 'conflicts' && html`<${ConflictsTab} recommendations=${recommendations} />`}
      ${activeView === 'changes' && html`<${ChangesTab} modsInventory=${modsInventory} />`}
      ${activeView === 'client-only' && html`
        <${ClientOnlyTab} runningMods=${runningMods} search=${search} />
      `}
      ${activeView === 'dependencies' && html`
        <${DependenciesTab} runningMods=${runningMods} />
      `}
      ${activeView === 'log-errors' && html`
        <${LogErrorsTab}
          modLogErrors=${modLogErrors}
          factsErrors=${factsOptional.mod_log_errors}
          recommendations=${recommendations}
          modIssues=${modIssues}
          hasReport=${!!reports.value?.facts}
          search=${search}
        />
      `}
      ${activeView === 'forensics' && html`
        <${ForensicsTab} factsOptional=${factsOptional} />
      `}
    </${Page}>
  `;
}
