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

// ── Helpers ────────────────────────────────────────────────────────────────────

function gradeLabel(grade) {
  const m = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Needs work', F: 'Critical' };
  return m[grade] ?? grade ?? '—';
}

function gradeTone(grade) {
  if (!grade) return 'neutral';
  if (grade === 'A' || grade === 'B') return 'ok';
  if (grade === 'C') return 'warn';
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

function narrativeText(item) {
  if (typeof item === 'string') return item;
  return item?.text ?? item?.message ?? item?.name ?? JSON.stringify(item);
}

function narrativeTone(item) {
  const s = String(item?.severity ?? item?.level ?? item?.tone ?? '').toLowerCase();
  if (['critical', 'error', 'danger', 'high'].includes(s)) return 'danger';
  if (['warning', 'warn', 'medium'].includes(s)) return 'warn';
  if (['ok', 'success', 'good', 'low'].includes(s)) return 'ok';
  if (['info'].includes(s)) return 'info';
  return 'info';
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
    value: p.path ?? p.file ?? p.id ?? String(p),
    label: p.label ?? p.name ?? p.path ?? String(p),
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
  const heap = profile?.heap ?? {};
  const findings = profile?.key_findings ?? [];
  const recommendations = profile?.recommendations ?? [];
  const hotMethods = profile?.hot_methods ?? [];

  const grade = verdict.grade ?? null;
  const tone = gradeTone(grade);

  const contextItems = [
    { key: 'TPS (1m avg)', value: ctx.tps_1m != null ? formatTps(ctx.tps_1m) : '—' },
    { key: 'MSPT P95 (1m)', value: ctx.mspt_p95_1m != null ? formatMspt(ctx.mspt_p95_1m) : '—' },
    { key: 'Players', value: ctx.players != null ? String(ctx.players) : '—' },
    { key: 'World entities', value: ctx.world_entities != null ? String(ctx.world_entities) : '—' },
    { key: 'JVM heap', value: ctx.jvm_heap != null ? formatMb(ctx.jvm_heap) : '—' },
  ];

  const topMethodColumns = [
    { key: 'name', label: 'Method', width: '60%' },
    { key: 'pct', label: '%', align: 'right', width: '10%', render: (v) => fmtPct(v) },
    { key: 'category', label: 'Category', width: '30%' },
  ];
  const topMethodRows = hotMethods.slice(0, 20).map((m, i) => ({
    id: i,
    name: m.name ?? m.method ?? String(m),
    pct: m.pct ?? m.percent ?? null,
    category: m.category ?? '—',
  }));

  return html`
    <div class="spark-summary">

      <!-- Verdict card -->
      ${grade || verdict.headline ? html`
        <${Card} tone=${tone} className="spark-verdict">
          <div class="spark-verdict__header">
            ${grade ? html`
              <${HealthGrade}
                grade=${grade}
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

      <!-- Heap summary -->
      ${heap && Object.keys(heap).length > 0 ? html`
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
    { key: 'category', label: 'Top category', width: '25%' },
  ];

  const rows = modRollups.map((m, i) => ({
    id: m.mod_id ?? i,
    name: m.name ?? m.mod_id ?? String(m),
    pct: m.pct ?? m.percent ?? null,
    category: m.top_category ?? m.category ?? '—',
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
        <${Section} title="Mod hints">
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
  const topEntities = ctx.top_entities ?? ctx.entity_hotspots ?? [];

  const hasData = dimRollups.length > 0 || topEntities.length > 0 || ctx.world_entities != null;

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
    id: d.name ?? i,
    name: d.name ?? d.dimension ?? String(d),
    pct: d.pct ?? null,
    entities: d.entities ?? '—',
    chunks: d.chunks ?? '—',
  }));

  const entityColumns = [
    { key: 'type', label: 'Entity type', width: '60%' },
    { key: 'count', label: 'Count', align: 'right', width: '20%' },
    { key: 'pct', label: '%', align: 'right', width: '20%', render: (v) => fmtPct(v) },
  ];

  const entityRows = (Array.isArray(topEntities) ? topEntities : []).slice(0, 15).map((e, i) => ({
    id: e.type ?? i,
    type: e.type ?? e.name ?? String(e),
    count: e.count ?? '—',
    pct: e.pct ?? null,
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
        <${Section} title="Entity hotspots">
          <${DataTable} columns=${entityColumns} rows=${entityRows} rowKey="id" density=${32} />
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

  // Build uPlot-compatible data from timeline entries
  const tArr = timeline.map((p) => {
    const ms = typeof p.t === 'number' ? p.t * 1000 : Date.parse(p.t);
    return Math.floor((isNaN(ms) ? 0 : ms) / 1000);
  });

  const hasKey = (key) => timeline.some((p) => p[key] != null);

  const seriesConfig = [
    hasKey('tps') && { key: 'tps', label: 'TPS', unit: '', color: 'ch-tps' },
    hasKey('mspt') && { key: 'mspt', label: 'MSPT', unit: ' ms', color: 'ch-mspt', scale: 'mspt' },
    hasKey('cpu') && { key: 'cpu', label: 'CPU %', unit: '%', color: 'ch-cpu' },
  ].filter(Boolean);

  const data = { t: tArr };
  for (const s of seriesConfig) {
    data[s.key] = timeline.map((p) => p[s.key] ?? null);
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
  const system = profile?.system ?? {};
  const threads = profile?.other_threads ?? [];
  const serverConfigs = profile?.server_configurations ?? profile?.capture?.server_configurations ?? [];
  const hotMethods = profile?.hot_methods ?? [];

  return html`
    <div class="spark-advanced">

      <!-- System info -->
      ${Object.keys(system).length > 0 ? html`
        <${Section} title="System">
          <${KeyValue}
            columns=${2}
            items=${Object.entries(system).slice(0, 12).map(([k, v]) => ({
              key: k.replace(/_/g, ' '),
              value: String(v ?? '—'),
            }))}
          />
        </${Section}>
      ` : null}

      <!-- Server configuration -->
      ${serverConfigs.length > 0 ? html`
        <${Section} title="Server configuration">
          <${KeyValue}
            columns=${2}
            items=${serverConfigs.slice(0, 16).map((c) => ({
              key: c.key ?? c.name ?? String(c),
              value: String(c.value ?? '—'),
            }))}
          />
        </${Section}>
      ` : null}

      <!-- All hot methods -->
      ${hotMethods.length > 0 ? html`
        <${Section} title="All hot methods" collapsible=${true} defaultOpen=${false}>
          <${ScrollRegion} maxHeight="400px" label="Hot methods list">
            <${DataTable}
              columns=${[
                { key: 'name', label: 'Method' },
                { key: 'pct', label: '%', align: 'right', width: '80px', render: (v) => fmtPct(v) },
                { key: 'category', label: 'Category', width: '140px' },
              ]}
              rows=${hotMethods.map((m, i) => ({
                id: i,
                name: m.name ?? m.method ?? String(m),
                pct: m.pct ?? null,
                category: m.category ?? '—',
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
