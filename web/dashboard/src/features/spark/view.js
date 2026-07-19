import { html } from '../../lib/preact.js';
import { useEffect } from '../../lib/preact.js';
import { spark } from '../../state/stores.js';
import { loadSparkProfiles, loadSparkProfile } from '../../state/actions.js';
import { Section, EmptyState, DataTable, KeyValue, Subnav, TimeSeries, ListRow, HealthGrade, BarMeter, Page } from '../../ui/patterns/index.js';
import { Badge, Card, Combobox, CopyButton, ScrollRegion } from '../../ui/primitives/index.js';
import { formatTps, formatMspt, formatMb } from '../../domain/formats.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const SUBNAV_OPTIONS = [
  { value: 'summary',  label: 'Summary' },
  { value: 'mods',     label: 'Mods' },
  { value: 'world',    label: 'World' },
  { value: 'window',   label: 'Window' },
  { value: 'advanced', label: 'Advanced' },
];

const SPARK_COMMANDS = `/spark profiler start
/spark profiler stop`;

/** Map parser grades (critical/degraded/healthy) onto HealthGrade A–F letters. */
const VERDICT_TO_LETTER = {
  critical: 'F',
  degraded: 'D',
  healthy: 'A',
  ok: 'A',
  good: 'B',
  fair: 'C',
  warn: 'C',
  warning: 'C',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function letterGrade(grade) {
  if (!grade) return null;
  const g = String(grade);
  if (/^[A-F]$/i.test(g)) return g.toUpperCase();
  return VERDICT_TO_LETTER[g.toLowerCase()] ?? null;
}

function gradeLabel(grade) {
  const raw = String(grade ?? '');
  const letter = letterGrade(grade);
  const byLetter = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Needs work', F: 'Critical' };
  const byParser = {
    critical: 'Critical',
    degraded: 'Degraded',
    healthy: 'Healthy',
  };
  return byParser[raw.toLowerCase()] ?? byLetter[letter] ?? (raw || '—');
}

function gradeTone(grade) {
  const letter = letterGrade(grade);
  if (!letter) return 'neutral';
  if (letter === 'A' || letter === 'B') return 'ok';
  if (letter === 'C') return 'warn';
  return 'danger';
}

function fmtPct(v) {
  if (v == null) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function pctTone(pct) {
  if (pct == null) return null;
  if (pct >= 25) return 'danger';
  if (pct >= 10) return 'warn';
  return 'ok';
}

function formatJvmHeap(heap) {
  if (heap == null) return '—';
  if (typeof heap === 'number') return formatMb(heap);
  if (typeof heap === 'object') {
    const used = heap.used_mb ?? heap.used;
    const max = heap.max_mb ?? heap.max;
    if (used != null && max != null) return `${formatMb(used)} / ${formatMb(max)}`;
    if (used != null) return formatMb(used);
  }
  return String(heap);
}

function methodLabel(m) {
  return m?.label ?? (m?.class && m?.method ? `${m.class}.${m.method}` : null) ?? m?.name ?? m?.method ?? String(m);
}

function hotMethods(profile) {
  return profile?.deep?.top_methods ?? profile?.top_methods ?? profile?.hot_methods ?? [];
}

function narrativeText(item) {
  if (typeof item === 'string') return item;
  if (item?.title && item?.detail) return `${item.title} — ${item.detail}`;
  return item?.title ?? item?.detail ?? item?.summary ?? item?.text ?? item?.message ?? item?.name ?? JSON.stringify(item);
}

function narrativeTone(item) {
  const s = String(item?.severity ?? item?.level ?? item?.tone ?? '').toLowerCase();
  if (['critical', 'error', 'danger', 'high'].includes(s)) return 'danger';
  if (['warning', 'warn', 'medium', 'degraded'].includes(s)) return 'warn';
  if (['ok', 'success', 'good', 'low', 'healthy'].includes(s)) return 'ok';
  if (['info'].includes(s)) return 'info';
  return 'info';
}

function flattenSystem(system) {
  const items = [];
  for (const [k, v] of Object.entries(system ?? {})) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [sk, sv] of Object.entries(v)) {
        items.push({
          key: `${k.replace(/_/g, ' ')} · ${sk.replace(/_/g, ' ')}`,
          value: typeof sv === 'number' ? String(Number(sv.toFixed?.(2) ?? sv)) : String(sv ?? '—'),
        });
      }
    } else {
      items.push({
        key: k.replace(/_/g, ' '),
        value: typeof v === 'number' ? String(Number(v.toFixed?.(2) ?? v)) : String(v ?? '—'),
      });
    }
  }
  return items;
}

function configEntries(configs) {
  if (!configs) return [];
  if (Array.isArray(configs)) {
    return configs.map((c) => ({
      key: c.key ?? c.name ?? String(c),
      value: String(c.value ?? '—'),
    }));
  }
  if (typeof configs === 'object') {
    return Object.entries(configs).map(([key, value]) => {
      let display = value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          display = typeof parsed === 'object' ? JSON.stringify(parsed, null, 0) : String(parsed);
        } catch {
          display = value;
        }
      }
      const str = String(display ?? '—');
      return { key, value: str.length > 160 ? `${str.slice(0, 157)}…` : str };
    });
  }
  return [];
}

function NarrativeList({ items, badgeLabel = 'Note' }) {
  return html`
    <div class="feat-list">
      ${items.map((item, i) => {
        const tone = narrativeTone(item);
        const label = typeof item === 'object' && item?.severity
          ? String(item.severity)
          : badgeLabel;
        return html`
          <${ListRow}
            key=${i}
            tone=${tone}
            title=${narrativeText(item)}
            badge=${html`<${Badge} tone=${tone}>${label}</${Badge}>`}
          />
        `;
      })}
    </div>
  `;
}

// ── Profile selector ───────────────────────────────────────────────────────────

function ProfileSelector({ profiles, activePath, loading }) {
  const options = profiles.map((p) => ({
    value: p.source_path ?? p.path ?? p.file ?? p.id ?? String(p),
    label: p.source_file ?? p.label ?? p.name ?? p.source_path ?? p.path ?? String(p),
    hint: p.captured_at ? new Date(p.captured_at).toLocaleString() : undefined,
  }));

  return html`
    <div class="spark-selector">
      <${Combobox}
        id="spark-profile-select"
        label="Profile"
        options=${options}
        value=${activePath}
        onSelect=${(path) => loadSparkProfile(path)}
        placeholder=${loading ? 'Loading…' : 'Select a Spark profile…'}
        disabled=${loading || options.length === 0}
      />
    </div>
  `;
}

// ── Summary view ───────────────────────────────────────────────────────────────

function SummaryView({ profile }) {
  const verdict = profile?.verdict ?? {};
  const ctx = profile?.context ?? {};
  const heap = profile?.heap_summary ?? profile?.heap ?? null;
  const findings = profile?.key_findings ?? [];
  const recommendations = profile?.recommendations ?? [];
  const methods = hotMethods(profile);

  const grade = verdict.grade ?? null;
  const letter = letterGrade(grade);
  const tone = gradeTone(grade);

  const contextItems = [
    { key: 'TPS (1m avg)', value: ctx.tps_1m != null ? formatTps(ctx.tps_1m) : '—' },
    { key: 'MSPT P95 (1m)', value: ctx.mspt_p95_1m != null ? formatMspt(ctx.mspt_p95_1m) : '—' },
    { key: 'Players', value: ctx.players != null ? String(ctx.players) : '—' },
    { key: 'World entities', value: ctx.world_entities != null ? String(ctx.world_entities) : '—' },
    { key: 'JVM heap', value: formatJvmHeap(ctx.jvm_heap) },
  ];

  const topMethodColumns = [
    { key: 'name', label: 'Method', width: '55%' },
    { key: 'pct', label: '%', align: 'right', width: '10%', render: (v) => fmtPct(v) },
    { key: 'category', label: 'Mod / category', width: '35%' },
  ];
  const topMethodRows = methods.slice(0, 20).map((m, i) => ({
    id: i,
    name: methodLabel(m),
    pct: m.pct ?? m.percent ?? null,
    category: m.mod_id ?? m.category ?? '—',
  }));

  return html`
    <div class="spark-summary">

      <!-- Verdict card -->
      ${grade || verdict.headline ? html`
        <${Card} tone=${tone} className="spark-verdict">
          <div class="spark-verdict__header">
            ${letter ? html`
              <${HealthGrade}
                grade=${letter}
                label=${gradeLabel(grade)}
                size=${56}
              />
            ` : null}
            <div class="spark-verdict__text">
              ${verdict.headline ? html`<h3 class="spark-verdict__headline">${verdict.headline}</h3>` : null}
              ${verdict.summary ? html`<p class="spark-verdict__desc">${verdict.summary}</p>` : null}
            </div>
          </div>
        </${Card}>
      ` : null}

      <!-- Capture context -->
      ${Object.values(ctx).some((v) => v != null) ? html`
        <${Section} title="Capture context">
          <${KeyValue} items=${contextItems} columns=${3} />
        </${Section}>
      ` : null}

      <!-- Key findings -->
      ${findings.length > 0 ? html`
        <${Section} title="Key findings">
          <${NarrativeList} items=${findings} badgeLabel="Finding" />
        </${Section}>
      ` : null}

      <!-- Top methods table -->
      ${topMethodRows.length > 0 ? html`
        <${Section} title="Hot methods">
          <${DataTable}
            columns=${topMethodColumns}
            rows=${topMethodRows}
            rowKey="id"
            density=${32}
          />
        </${Section}>
      ` : null}

      <!-- Heap summary (only when .sparkheap present) -->
      ${heap && typeof heap === 'object' && Object.keys(heap).length > 0 ? html`
        <${Section} title="Heap summary">
          <${KeyValue}
            columns=${2}
            items=${Object.entries(heap).slice(0, 8).map(([key, value]) => ({
              key: key.replace(/_/g, ' '),
              value: typeof value === 'number' ? formatMb(value) : String(value ?? '—'),
            }))}
          />
        </${Section}>
      ` : null}

      <!-- Recommendations -->
      ${recommendations.length > 0 ? html`
        <${Section} title="Recommendations">
          <${NarrativeList} items=${recommendations} badgeLabel="Action" />
        </${Section}>
      ` : null}

    </div>
  `;
}

// ── Mods view ──────────────────────────────────────────────────────────────────

function ModsView({ profile }) {
  const modRollups = profile?.mod_rollups ?? [];
  const modHints = profile?.mod_hints ?? [];

  const columns = [
    { key: 'name', label: 'Mod', width: '40%' },
    {
      key: 'pct',
      label: 'CPU %',
      width: '35%',
      render: (v) => v != null
        ? html`<${BarMeter} value=${v} max=${100} valueLabel=${fmtPct(v)} tone=${pctTone(v)} compact=${true} />`
        : '—',
    },
    { key: 'category', label: 'Top method', width: '25%' },
  ];

  const rows = modRollups.map((m, i) => ({
    id: m.mod_id ?? i,
    name: m.display_name ?? m.name ?? m.mod_id ?? String(m),
    pct: m.pct ?? m.percent ?? null,
    category: m.top_label ?? m.top_category ?? m.category ?? '—',
  }));

  if (rows.length === 0 && modHints.length === 0) {
    return html`
      <${EmptyState}
        title="No mod data"
        body="Mod rollup data is not available in this profile."
      />
    `;
  }

  return html`
    <div class="spark-mods">
      ${rows.length > 0 ? html`
        <${Section} title="Mod CPU usage">
          <${DataTable}
            columns=${columns}
            rows=${rows}
            rowKey="id"
            density=${32}
          />
        </${Section}>
      ` : null}
      ${modHints.length > 0 ? html`
        <${Section} title="Mod signals">
          <${NarrativeList} items=${modHints} badgeLabel="Hint" />
        </${Section}>
      ` : null}
    </div>
  `;
}

// ── World view ─────────────────────────────────────────────────────────────────

function WorldView({ profile }) {
  const ctx = profile?.context ?? {};
  const dimRollups = profile?.dimension_rollups ?? profile?.world_rollups ?? [];
  const topEntities = ctx.top_entities ?? [];
  const hotspots = ctx.entity_hotspots ?? [];

  const hasData = dimRollups.length > 0 || topEntities.length > 0 || hotspots.length > 0 || ctx.world_entities != null;

  if (!hasData) {
    return html`
      <${EmptyState}
        title="No world data"
        body="Dimension or entity data is not available in this profile."
      />
    `;
  }

  const dimColumns = [
    { key: 'name', label: 'Dimension', width: '50%' },
    { key: 'pct', label: 'CPU %', align: 'right', width: '15%', render: (v) => fmtPct(v) },
    { key: 'entities', label: 'Entities', align: 'right', width: '15%' },
    { key: 'chunks', label: 'Chunks', align: 'right', width: '15%' },
  ];

  const dimRows = dimRollups.map((d, i) => ({
    id: d.name ?? d.dimension ?? i,
    name: d.name ?? d.dimension ?? String(d),
    pct: d.pct ?? null,
    entities: d.entities ?? '—',
    chunks: d.chunks ?? '—',
  }));

  const entityColumns = [
    { key: 'type', label: 'Entity type', width: '70%' },
    { key: 'count', label: 'Count', align: 'right', width: '30%' },
  ];

  const entityRows = (Array.isArray(topEntities) ? topEntities : []).slice(0, 15).map((e, i) => ({
    id: e.id ?? e.type ?? i,
    type: e.id ?? e.type ?? e.name ?? String(e),
    count: e.count ?? '—',
  }));

  const hotspotColumns = [
    { key: 'where', label: 'Chunk', width: '40%' },
    { key: 'type', label: 'Top type', width: '40%' },
    { key: 'count', label: 'Count', align: 'right', width: '20%' },
  ];

  const hotspotRows = (Array.isArray(hotspots) ? hotspots : []).slice(0, 15).map((h, i) => ({
    id: i,
    where: `${h.dimension ?? '?'} ${h.chunk_x ?? '?'},${h.chunk_z ?? '?'}`,
    type: h.top_type ?? '—',
    count: h.top_count ?? h.total_entities ?? '—',
  }));

  return html`
    <div class="spark-world">
      ${ctx.world_entities != null ? html`
        <p class="spark-world__total">Total world entities: <strong>${ctx.world_entities}</strong></p>
      ` : null}
      ${dimRows.length > 0 ? html`
        <${Section} title="Dimension rollups">
          <${DataTable} columns=${dimColumns} rows=${dimRows} rowKey="id" density=${32} />
        </${Section}>
      ` : null}
      ${entityRows.length > 0 ? html`
        <${Section} title="Top entities">
          <${DataTable} columns=${entityColumns} rows=${entityRows} rowKey="id" density=${32} />
        </${Section}>
      ` : null}
      ${hotspotRows.length > 0 ? html`
        <${Section} title="Entity hotspots">
          <${DataTable} columns=${hotspotColumns} rows=${hotspotRows} rowKey="id" density=${32} />
        </${Section}>
      ` : null}
    </div>
  `;
}

// ── Window view (timeline) ─────────────────────────────────────────────────────

function WindowView({ profile }) {
  const timeline = profile?.timeline ?? [];
  const correlations = profile?.correlations ?? [];

  if (!timeline.length) {
    return html`
      <${EmptyState}
        title="No timeline data"
        body="Timeline data is not available in this profile."
      />
    `;
  }

  const tArr = timeline.map((p) => {
    const raw = p.start_at ?? p.t ?? p.end_at;
    const ms = typeof raw === 'number' ? (raw > 1e12 ? raw : raw * 1000) : Date.parse(raw);
    return Math.floor((isNaN(ms) ? 0 : ms) / 1000);
  });

  const hasKey = (key) => timeline.some((p) => p[key] != null);
  const hasMspt = hasKey('mspt') || hasKey('mspt_median');
  const hasCpu = hasKey('cpu') || hasKey('cpu_process');

  const seriesConfig = [
    hasKey('tps') && { key: 'tps', label: 'TPS', unit: '', color: 'ch-tps' },
    hasMspt && { key: 'mspt', label: 'MSPT', unit: ' ms', color: 'ch-mspt', scale: 'mspt' },
    hasCpu && { key: 'cpu', label: 'CPU %', unit: '%', color: 'ch-cpu' },
  ].filter(Boolean);

  const data = { t: tArr };
  for (const s of seriesConfig) {
    if (s.key === 'mspt') {
      data.mspt = timeline.map((p) => p.mspt ?? p.mspt_median ?? null);
    } else if (s.key === 'cpu') {
      data.cpu = timeline.map((p) => {
        if (p.cpu != null) return p.cpu;
        if (p.cpu_process == null) return null;
        const v = Number(p.cpu_process);
        // Spark stores process CPU as 0–1 fraction.
        return v <= 1 ? v * 100 : v;
      });
    } else {
      data[s.key] = timeline.map((p) => p[s.key] ?? null);
    }
  }

  return html`
    <div class="spark-window">
      ${seriesConfig.length > 0 ? html`
        <${Section} title="Performance window">
          <${TimeSeries}
            series=${seriesConfig}
            data=${data}
            height=${200}
          />
        </${Section}>
      ` : html`
        <${EmptyState} title="No chart data" body="Timeline entries have no numeric metrics." />
      `}
      ${correlations.length > 0 ? html`
        <${Section} title="Correlations">
          <${NarrativeList} items=${correlations} badgeLabel="Signal" />
        </${Section}>
      ` : null}
    </div>
  `;
}

// ── Advanced view ──────────────────────────────────────────────────────────────

function AdvancedView({ profile }) {
  const systemItems = flattenSystem(profile?.system ?? {});
  const threads = profile?.threads_other ?? profile?.other_threads ?? [];
  const threadsAnalyzed = profile?.threads_analyzed ?? [];
  const serverConfigs = configEntries(profile?.server_configurations ?? profile?.capture?.server_configurations);
  const methods = hotMethods(profile);
  const platform = profile?.platform ?? {};
  const captureMeta = [
    platform.loader && { key: 'Loader', value: String(platform.loader) },
    platform.minecraft && { key: 'Minecraft', value: String(platform.minecraft) },
    platform.spark_version != null && { key: 'Spark version', value: String(platform.spark_version) },
    profile?.spark_viewer_url && { key: 'Viewer', value: String(profile.spark_viewer_url) },
    threadsAnalyzed.length > 0 && { key: 'Threads analyzed', value: threadsAnalyzed.join(', ') },
  ].filter(Boolean);

  return html`
    <div class="spark-advanced">

      ${captureMeta.length > 0 ? html`
        <${Section} title="Capture details">
          <${KeyValue} columns=${2} items=${captureMeta} />
        </${Section}>
      ` : null}

      <!-- System info -->
      ${systemItems.length > 0 ? html`
        <${Section} title="System">
          <${KeyValue} columns=${2} items=${systemItems.slice(0, 16)} />
        </${Section}>
      ` : null}

      <!-- Server configuration -->
      ${serverConfigs.length > 0 ? html`
        <${Section} title="Server configuration">
          <${KeyValue} columns=${2} items=${serverConfigs.slice(0, 16)} />
        </${Section}>
      ` : null}

      <!-- All hot methods -->
      ${methods.length > 0 ? html`
        <${Section} title="All hot methods" collapsible=${true} defaultOpen=${false}>
          <${ScrollRegion} maxHeight="400px" label="Hot methods list">
            <${DataTable}
              columns=${[
                { key: 'name', label: 'Method' },
                { key: 'pct', label: '%', align: 'right', width: '80px', render: (v) => fmtPct(v) },
                { key: 'category', label: 'Mod', width: '140px' },
              ]}
              rows=${methods.map((m, i) => ({
                id: i,
                name: methodLabel(m),
                pct: m.pct ?? null,
                category: m.mod_id ?? m.category ?? '—',
              }))}
              rowKey="id"
              density=${28}
              stickyHeader=${true}
            />
          </${ScrollRegion}>
        </${Section}>
      ` : null}

      <!-- Thread list -->
      ${threads.length > 0 ? html`
        <${Section} title="Other threads" collapsible=${true} defaultOpen=${false}>
          <${ScrollRegion} maxHeight="300px" label="Thread list">
            <div class="feat-list">
              ${threads.map((t, i) => html`
                <${ListRow}
                  key=${i}
                  tone="neutral"
                  title=${t.name ?? String(t)}
                  badge=${t.pct != null ? html`<${Badge} tone="neutral">${fmtPct(t.pct)}</${Badge}>` : null}
                />
              `)}
            </div>
          </${ScrollRegion}>
        </${Section}>
      ` : null}

    </div>
  `;
}

// ── Workflow card ──────────────────────────────────────────────────────────────

function WorkflowCard() {
  return html`
    <${Card} className="spark-workflow">
      <div class="spark-workflow__header">
        <strong>How to capture a profile</strong>
        <${CopyButton} text=${SPARK_COMMANDS} label="Copy Spark commands" />
      </div>
      <p class="spark-workflow__desc">
        Run these commands in-game or via console. The profiler will capture 30–60 seconds of
        server activity. When done, WatchTower will parse the profile automatically.
      </p>
      <pre class="spark-workflow__code">${SPARK_COMMANDS}</pre>
    </${Card}>
  `;
}

// ── PageView ───────────────────────────────────────────────────────────────────

export function PageView() {
  const { enabled, profiles, activePath, profile, loading, error, view } = spark.value;

  // Load profile list on mount
  useEffect(() => {
    loadSparkProfiles();
  }, []);

  function setView(v) {
    spark.value = { ...spark.value, view: v };
  }

  // Disabled state
  if (!enabled) {
    return html`
      <${Page} tour="spark" title="Spark" subtitle="Performance profiling via Spark">
        <${EmptyState}
          title="Spark integration disabled"
          body="Enable Spark profiler integration in Settings to use this feature."
        />
      </${Page}>
    `;
  }

  return html`
    <${Page} tour="spark" title="Spark" subtitle="Performance profiling via Spark">
        <${WorkflowCard} />

        <!-- Profile selector -->
        <${Section} title="Profiles">
          ${profiles.length === 0 && !loading ? html`
            <p class="spark-no-profiles">No Spark profiles found in the configured search directories.</p>
          ` : html`
            <${ProfileSelector}
              profiles=${profiles}
              activePath=${activePath}
              loading=${loading}
            />
          `}
        </${Section}>

        <!-- Error state -->
        ${error ? html`
          <div class="spark-error">
            <${Badge} tone="critical">Error</${Badge}>
            <span>${error}</span>
          </div>
        ` : null}

        <!-- Loading state -->
        ${loading ? html`
          <div class="spark-loading">Loading profile…</div>
        ` : null}

        <!-- No profile selected -->
        ${!loading && !error && !profile ? html`
          <${EmptyState}
            title="No profile selected"
            body="Select a Spark profile above to view analysis results."
          />
        ` : null}

        <!-- Profile content -->
        ${!loading && profile ? html`
          <${Subnav}
            options=${SUBNAV_OPTIONS}
            value=${view}
            onChange=${setView}
          />

          <div class="spark-view-body">
            ${view === 'summary'  ? html`<${SummaryView}  profile=${profile} />` : null}
            ${view === 'mods'     ? html`<${ModsView}     profile=${profile} />` : null}
            ${view === 'world'    ? html`<${WorldView}    profile=${profile} />` : null}
            ${view === 'window'   ? html`<${WindowView}   profile=${profile} />` : null}
            ${view === 'advanced' ? html`<${AdvancedView} profile=${profile} />` : null}
          </div>
        ` : null}
    </${Page}>
  `;
}
