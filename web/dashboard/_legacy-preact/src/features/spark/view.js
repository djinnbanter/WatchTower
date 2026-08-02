import { html } from '../../lib/preact.js';
import { useEffect, useMemo, useState } from '../../lib/preact.js';
import { spark } from '../../state/stores.js';
import { loadSparkProfiles, loadSparkProfile, importSparkFromUrl } from '../../state/actions.js';
import { getRoute } from '../../app/router.js';
import { set as persistSet } from '../../state/persist.js';
import { Section, EmptyState, DataTable, KeyValue, Subnav, TimeSeries, ListRow, HealthGrade, BarMeter, Page } from '../../ui/patterns/index.js';
import { Badge, Card, Combobox, CopyButton, ScrollRegion, Button, TextField } from '../../ui/primitives/index.js';
import { formatTps, formatMspt, formatMb } from '../../domain/formats.js';
import { openSupportBuilder } from '../support/bundle-builder-modal.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const SUBNAV_OPTIONS = [
  { value: 'summary',  label: 'Overview' },
  { value: 'mods',     label: 'Mods' },
  { value: 'world',    label: 'World' },
  { value: 'window',   label: 'Over time' },
  { value: 'advanced', label: 'Technical' },
];

const VANILLA_MOD_IDS = new Set([
  'minecraft', 'neoforge', 'forge', 'fabric', 'quilt', 'java', 'native', 'jdk', 'server',
]);

const SPARK_COMMANDS = `/spark profiler start
/spark profiler stop --save-to-file`;

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

function friendlyEntityName(id) {
  if (id == null || id === '') return 'Unknown';
  const raw = String(id);
  const bare = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
  const words = bare.replace(/[_-]+/g, ' ').trim();
  if (!words) return raw;
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyDimension(dim) {
  if (dim == null || dim === '') return 'Unknown dimension';
  const raw = String(dim);
  const bare = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
  const map = {
    overworld: 'Overworld',
    the_nether: 'Nether',
    the_end: 'The End',
    nether: 'Nether',
    end: 'The End',
  };
  if (map[bare.toLowerCase()]) return map[bare.toLowerCase()];
  return friendlyEntityName(bare);
}

function isVanillaMod(id) {
  if (id == null || id === '') return true;
  const key = String(id).toLowerCase().trim();
  if (VANILLA_MOD_IDS.has(key)) return true;
  if (key.startsWith('java.') || key.startsWith('jdk.')) return true;
  return false;
}

function captureWindowLabel(profile) {
  const win = profile?.window ?? {};
  const parts = [];
  let durationSec = win.duration_sec;
  if (durationSec == null && win.start_ms != null && win.end_ms != null) {
    durationSec = Math.max(0, (Number(win.end_ms) - Number(win.start_ms)) / 1000);
  }
  if (durationSec != null && !Number.isNaN(Number(durationSec))) {
    const s = Number(durationSec);
    parts.push(s >= 60 ? `${(s / 60).toFixed(1)} min capture` : `${Math.round(s)}s capture`);
  }
  if (win.ticks != null) parts.push(`${win.ticks} ticks`);
  if (win.sample_interval_us != null) {
    const ms = Number(win.sample_interval_us) / 1000;
    if (!Number.isNaN(ms)) parts.push(ms >= 1 ? `${ms.toFixed(0)} ms sample` : `${(ms * 1000).toFixed(0)} µs sample`);
  }
  return {
    primary: parts[0] ?? null,
    secondary: parts.slice(1).join(' · ') || null,
  };
}

function heapSummaryItems(heap) {
  if (!heap || typeof heap !== 'object') return [];
  const items = [];
  const entries = Array.isArray(heap.top_entries) ? heap.top_entries : null;
  if (entries?.length) {
    for (const e of entries.slice(0, 8)) {
      const name = friendlyEntityName(e.type ?? e.class ?? e.name ?? 'object');
      const size = e.size_mb != null ? formatMb(e.size_mb) : null;
      const n = e.instances != null ? `${e.instances} instances` : null;
      items.push({
        key: name,
        value: [size, n, e.mod_id].filter(Boolean).join(' · ') || '—',
      });
    }
    return items;
  }
  for (const [key, value] of Object.entries(heap)) {
    if (value == null || typeof value === 'object') continue;
    items.push({
      key: key.replace(/_/g, ' '),
      value: typeof value === 'number' ? formatMb(value) : String(value),
    });
    if (items.length >= 8) break;
  }
  return items;
}

function FindingList({ items }) {
  return html`
    <div class="feat-list spark-findings-list">
      ${items.map((item, i) => {
        const tone = narrativeTone(item);
        const title = item?.title ?? item?.summary ?? narrativeText(item);
        const detail = item?.detail ?? item?.text ?? null;
        const label = item?.severity ? String(item.severity) : 'Finding';
        return html`
          <${ListRow}
            key=${i}
            tone=${tone}
            title=${title}
            meta=${detail && detail !== title ? detail : null}
            badge=${html`<${Badge} tone=${tone}>${label}</${Badge}>`}
          />
        `;
      })}
    </div>
  `;
}

function RecommendationCards({ items }) {
  if (!items?.length) return null;
  return html`
    <div class="spark-rec-cards">
      ${items.map((rec, i) => {
        const tone = narrativeTone(rec);
        const actions = Array.isArray(rec?.actions)
          ? rec.actions.map((a) => String(a)).filter(Boolean)
          : [];
        return html`
          <${Card} key=${i} className=${`spark-rec spark-rec--${tone}`} padding="20">
            <div class="spark-rec__head">
              <${Badge} tone=${tone}>${rec?.severity ?? 'Action'}</${Badge}>
              ${rec?.category ? html`<span class="spark-rec__cat">${rec.category}</span>` : null}
            </div>
            ${rec?.title ? html`<h4 class="spark-rec__title">${rec.title}</h4>` : null}
            ${rec?.detail ? html`<p class="spark-rec__detail">${rec.detail}</p>` : null}
            ${actions.length ? html`
              <ol class="spark-rec__actions">
                ${actions.map((step, j) => html`<li key=${j}>${step}</li>`)}
              </ol>
            ` : null}
          </${Card}>
        `;
      })}
    </div>
  `;
}

function MetricStrip({ metrics }) {
  const visible = (metrics ?? []).filter((m) => m && m.value != null && m.value !== '');
  if (!visible.length) return null;
  return html`
    <div class="spark-metrics" role="list">
      ${visible.map((m, i) => html`
        <div class="spark-metric" role="listitem" key=${i} title=${m.hint || undefined}>
          <span class="spark-metric__label">${m.label}</span>
          <span class="spark-metric__value">${m.value}</span>
          ${m.hint ? html`<span class="spark-metric__hint">${m.hint}</span>` : null}
        </div>
      `)}
    </div>
  `;
}

function ShowMoreToggle({ expanded, total, preview, onToggle, noun = 'items' }) {
  if (total <= preview) return null;
  return html`
    <button type="button" class="spark-show-more" onClick=${onToggle}>
      ${expanded ? 'Show less' : `Show all ${total} ${noun}`}
    </button>
  `;
}

function isAutoCapturedProfile(p) {
  const file = String(p?.source_file ?? p?.label ?? p?.name ?? '');
  const path = String(p?.source_path ?? p?.path ?? p?.file ?? '');
  const base = file || path.split(/[/\\]/).pop() || '';
  return base.startsWith('auto-') || path.includes('/auto-') || path.includes('\\auto-');
}

// ── Profile selector ───────────────────────────────────────────────────────────

function formatBytes(size) {
  if (size == null || Number.isNaN(Number(size))) return null;
  const n = Number(size);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ProfileSelector({ profiles, activePath, loading, title = 'Profiles' }) {
  const options = profiles.map((p) => ({
    value: p.source_path ?? p.path ?? p.file ?? p.id ?? String(p),
    label: p.source_file ?? p.label ?? p.name ?? p.source_path ?? p.path ?? String(p),
    hint: p.captured_at ? new Date(p.captured_at).toLocaleString() : undefined,
  }));

  const active = profiles.find((p) => {
    const path = p.source_path ?? p.path ?? p.file ?? '';
    return path === activePath;
  }) ?? null;

  const sizeLabel = formatBytes(active?.size_bytes ?? active?.size);
  const capturedLabel = active?.captured_at
    ? new Date(active.captured_at).toLocaleString()
    : null;

  return html`
    <${Card} className="spark-profile-panel" padding="20">
      <div class="spark-profile-chrome">
        <div class="spark-selector">
          <${Combobox}
            id=${`spark-profile-select-${title.replace(/\s+/g, '-').toLowerCase()}`}
            label=${title === 'Profiles' ? 'Profile' : title}
            options=${options}
            value=${activePath}
            onSelect=${(path) => loadSparkProfile(path)}
            placeholder=${loading ? 'Loading…' : 'Select a Spark profile…'}
            disabled=${loading || options.length === 0}
          />
        </div>
        ${active ? html`
          <div class="spark-profile-meta">
            ${active.fresh ? html`<${Badge} tone="ok">Fresh</${Badge}>` : null}
            ${capturedLabel ? html`<span>${capturedLabel}</span>` : null}
            ${sizeLabel ? html`<span>${sizeLabel}</span>` : null}
            ${active.source_path ? html`
              <span class="spark-profile-meta__path" title=${active.source_path}>${active.source_path}</span>
            ` : null}
          </div>
        ` : null}
      </div>
    </${Card}>
  `;
}

// ── Overview (summary) ─────────────────────────────────────────────────────────

function SummaryView({ profile }) {
  const verdict = profile?.verdict ?? {};
  const ctx = profile?.context ?? {};
  const heap = profile?.heap_summary ?? profile?.heap ?? null;
  const findings = profile?.key_findings ?? [];
  const recommendations = profile?.recommendations ?? [];
  const methods = hotMethods(profile);
  const heapItems = heapSummaryItems(heap);

  const grade = verdict.grade ?? null;
  const letter = letterGrade(grade);
  const tone = gradeTone(grade);

  const hasContext = Object.values(ctx).some((v) => v != null);
  const metrics = [
    {
      label: 'Tick rate (TPS)',
      value: ctx.tps_1m != null ? formatTps(ctx.tps_1m) : null,
      hint: '20 is healthy',
    },
    {
      label: 'Tick time (MSPT)',
      value: ctx.mspt_p95_1m != null ? formatMspt(ctx.mspt_p95_1m) : null,
      hint: 'Under ~50 ms is healthy',
    },
    {
      label: 'Players online',
      value: ctx.players != null ? String(ctx.players) : null,
      hint: 'During this capture',
    },
    {
      label: 'Entities in world',
      value: ctx.world_entities != null ? String(ctx.world_entities) : null,
      hint: 'Mobs, items, orbs, etc.',
    },
    {
      label: 'Memory (heap)',
      value: formatJvmHeap(ctx.jvm_heap) !== '—' ? formatJvmHeap(ctx.jvm_heap) : null,
      hint: 'Java heap used / max',
    },
  ];

  const topMethodColumns = [
    { key: 'name', label: 'Activity', width: '55%' },
    { key: 'pct', label: '% of sample', align: 'right', width: '15%', render: (v) => fmtPct(v) },
    { key: 'category', label: 'Likely mod', width: '30%' },
  ];
  const topMethodRows = methods.slice(0, 5).map((m, i) => ({
    id: i,
    name: methodLabel(m),
    pct: m.pct ?? m.percent ?? null,
    category: m.mod_id ?? m.category ?? '—',
  }));

  return html`
    <div class="spark-summary">

      ${hasContext ? html`
        <div class="spark-span-full">
          <${Section} title="How it looked">
            <${MetricStrip} metrics=${metrics} />
          </${Section}>
        </div>
      ` : null}

      ${grade || verdict.headline ? html`
        <${Card} tone=${tone} className="spark-verdict" padding="20">
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

      ${recommendations.length > 0 ? html`
        <div class="spark-span-full">
          <${Section} title="Do this next">
            <${RecommendationCards} items=${recommendations} />
          </${Section}>
        </div>
      ` : null}

      ${findings.length > 0 ? html`
        <${Section} title="What we noticed">
          <${FindingList} items=${findings} />
        </${Section}>
      ` : null}

      ${topMethodRows.length > 0 ? html`
        <${Section} title="Where time went">
          <p class="spark-intro">Top activities in this sample. Full list is on the Technical tab.</p>
          <${DataTable}
            columns=${topMethodColumns}
            rows=${topMethodRows}
            rowKey="id"
            density=${32}
          />
        </${Section}>
      ` : null}

      ${heapItems.length > 0 ? html`
        <div class="spark-span-full">
          <${Section} title="Heap summary">
            <${KeyValue} columns=${2} items=${heapItems} />
          </${Section}>
        </div>
      ` : null}

    </div>
  `;
}

// ── Mods view ──────────────────────────────────────────────────────────────────

function ModsView({ profile }) {
  const [showAll, setShowAll] = useState(false);
  const modRollups = profile?.mod_rollups ?? [];
  const modHints = profile?.mod_hints ?? [];

  const hintByMod = useMemo(() => {
    const map = new Map();
    for (const h of modHints) {
      const id = h.mod_id ?? h.id;
      if (id) map.set(String(id), h.summary ?? h.title ?? h.detail ?? narrativeText(h));
    }
    return map;
  }, [modHints]);

  const sorted = useMemo(
    () => [...modRollups].sort((a, b) => (b.pct ?? b.percent ?? 0) - (a.pct ?? a.percent ?? 0)),
    [modRollups],
  );

  const spotlight = sorted.filter((m) => !isVanillaMod(m.mod_id)).slice(0, 5);
  // If everything is vanilla-ish, still show top 5 overall
  const spotlightRows = spotlight.length ? spotlight : sorted.slice(0, 5);

  const columns = [
    { key: 'name', label: 'Mod', width: '35%' },
    {
      key: 'pct',
      label: 'Share of time',
      width: '30%',
      render: (v) => v != null
        ? html`<${BarMeter} value=${v} max=${100} valueLabel=${fmtPct(v)} tone=${pctTone(v)} compact=${true} />`
        : '—',
    },
    { key: 'methods', label: 'Hot frames', align: 'right', width: '12%' },
    { key: 'category', label: 'Top activity', width: '23%' },
  ];

  const allRows = sorted.map((m, i) => ({
    id: m.mod_id ?? i,
    name: m.display_name ?? m.name ?? m.mod_id ?? String(m),
    pct: m.pct ?? m.percent ?? null,
    methods: m.method_count ?? '—',
    category: m.top_label ?? m.top_category ?? m.category ?? '—',
  }));

  const tableRows = showAll ? allRows : allRows.slice(0, 12);

  if (allRows.length === 0 && modHints.length === 0) {
    return html`
      <${EmptyState}
        title="No mod breakdown"
        body="This profile doesn’t break down time by mod."
      />
    `;
  }

  return html`
    <div class="spark-mods">
      <p class="spark-intro">Share of sampled server time attributed to each mod. Vanilla and loader time is often large — focus on third-party mods first.</p>

      ${spotlightRows.length > 0 ? html`
        <${Section} title="What is dragging">
          <div class="spark-mod-spotlight">
            ${spotlightRows.map((m, i) => {
              const id = m.mod_id ?? i;
              const name = m.display_name ?? m.name ?? m.mod_id ?? 'Unknown mod';
              const pct = m.pct ?? m.percent ?? null;
              const hint = hintByMod.get(String(m.mod_id)) ?? m.top_label ?? null;
              const vanillaNote = isVanillaMod(m.mod_id) ? 'Vanilla / loader' : null;
              return html`
                <${Card} key=${id} className="spark-mod-card" padding="20">
                  <div class="spark-mod-card__head">
                    <strong class="spark-mod-card__name">${name}</strong>
                    ${pct != null ? html`<span class="spark-mod-card__pct">${fmtPct(pct)}</span>` : null}
                  </div>
                  ${pct != null ? html`
                    <${BarMeter} value=${pct} max=${100} valueLabel=${fmtPct(pct)} tone=${pctTone(pct)} compact=${true} />
                  ` : null}
                  ${hint ? html`<p class="spark-mod-card__hint">${hint}</p>` : null}
                  ${vanillaNote ? html`<p class="spark-mod-card__note">${vanillaNote}</p>` : null}
                </${Card}>
              `;
            })}
          </div>
        </${Section}>
      ` : null}

      ${allRows.length > 0 ? html`
        <${Section} title="All mods" collapsible=${true} defaultOpen=${allRows.length <= 12}>
          <${DataTable}
            columns=${columns}
            rows=${tableRows}
            rowKey="id"
            density=${32}
          />
          <${ShowMoreToggle}
            expanded=${showAll}
            total=${allRows.length}
            preview=${12}
            onToggle=${() => setShowAll((v) => !v)}
            noun="mods"
          />
        </${Section}>
      ` : null}

      ${modHints.length > 0 && spotlightRows.length === 0 ? html`
        <${Section} title="Mod signals">
          <${NarrativeList} items=${modHints} badgeLabel="Hint" />
        </${Section}>
      ` : null}
    </div>
  `;
}

// ── World view ─────────────────────────────────────────────────────────────────

function WorldView({ profile }) {
  const [showAllEntities, setShowAllEntities] = useState(false);
  const [showAllHotspots, setShowAllHotspots] = useState(false);
  const ctx = profile?.context ?? {};
  const topEntities = Array.isArray(ctx.top_entities) ? ctx.top_entities : [];
  const hotspots = Array.isArray(ctx.entity_hotspots) ? ctx.entity_hotspots : [];
  const hasEntityRecs = (profile?.recommendations ?? []).some((r) => r?.category === 'entities');

  const hasData = topEntities.length > 0 || hotspots.length > 0 || ctx.world_entities != null;

  if (!hasData) {
    return html`
      <${EmptyState}
        title="No world data"
        body="Entity counts are not available in this profile."
      />
    `;
  }

  const entityColumns = [
    { key: 'type', label: 'Entity', width: '70%' },
    { key: 'count', label: 'Count', align: 'right', width: '30%' },
  ];

  const entityRows = topEntities.map((e, i) => ({
    id: e.id ?? e.type ?? i,
    type: friendlyEntityName(e.id ?? e.type ?? e.name ?? String(e)),
    count: e.count ?? '—',
  }));
  const entityPreview = showAllEntities ? entityRows : entityRows.slice(0, 10);

  const hotspotColumns = [
    { key: 'where', label: 'Where', width: '55%' },
    { key: 'type', label: 'Mostly', width: '30%' },
    { key: 'count', label: 'Count', align: 'right', width: '15%' },
  ];

  const hotspotRows = hotspots.map((h, i) => {
    const dim = friendlyDimension(h.dimension);
    const cx = h.chunk_x ?? '?';
    const cz = h.chunk_z ?? '?';
    const total = h.total_entities;
    const top = friendlyEntityName(h.top_type);
    const where = total != null
      ? `${dim} chunk (${cx}, ${cz}): ${total} entities`
      : `${dim} chunk (${cx}, ${cz})`;
    return {
      id: i,
      where,
      type: top,
      count: h.top_count ?? h.total_entities ?? '—',
    };
  });
  const hotspotPreview = showAllHotspots ? hotspotRows : hotspotRows.slice(0, 10);

  return html`
    <div class="spark-world">
      ${ctx.world_entities != null ? html`
        <p class="spark-world__total">
          About <strong>${ctx.world_entities}</strong> entities were loaded during this capture
          (mobs, items, experience orbs, and similar).
        </p>
      ` : null}

      ${hasEntityRecs ? html`
        <p class="spark-nudge">See <strong>Overview → Do this next</strong> for clear/farm tips tied to these counts.</p>
      ` : null}

      ${entityRows.length > 0 ? html`
        <${Section} title="Most common entities">
          <${DataTable} columns=${entityColumns} rows=${entityPreview} rowKey="id" density=${32} />
          <${ShowMoreToggle}
            expanded=${showAllEntities}
            total=${entityRows.length}
            preview=${10}
            onToggle=${() => setShowAllEntities((v) => !v)}
            noun="entity types"
          />
        </${Section}>
      ` : null}

      ${hotspotRows.length > 0 ? html`
        <${Section} title="Busy chunks">
          <p class="spark-intro">Chunks with the most entities — often farms or hopper lines.</p>
          <${DataTable} columns=${hotspotColumns} rows=${hotspotPreview} rowKey="id" density=${32} />
          <${ShowMoreToggle}
            expanded=${showAllHotspots}
            total=${hotspotRows.length}
            preview=${10}
            onToggle=${() => setShowAllHotspots((v) => !v)}
            noun="chunks"
          />
        </${Section}>
      ` : null}
    </div>
  `;
}

// ── Over time (window) ─────────────────────────────────────────────────────────

function WindowView({ profile }) {
  const timeline = profile?.timeline ?? [];
  const winLabel = captureWindowLabel(profile);

  if (!timeline.length) {
    return html`
      <${EmptyState}
        title="No timeline data"
        body="This profile doesn’t include a performance timeline."
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
    hasKey('tps') && { key: 'tps', label: 'Tick rate', unit: '', color: 'ch-tps' },
    hasMspt && { key: 'mspt', label: 'Tick time', unit: ' ms', color: 'ch-mspt', scale: 'mspt' },
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
        return v <= 1 ? v * 100 : v;
      });
    } else {
      data[s.key] = timeline.map((p) => p[s.key] ?? null);
    }
  }

  const shortCapture = timeline.length <= 2;

  return html`
    <div class="spark-window">
      ${winLabel.primary || winLabel.secondary ? html`
        <p class="spark-window-meta">
          ${winLabel.primary ? html`<strong>${winLabel.primary}</strong>` : null}
          ${winLabel.secondary ? html`<span>${winLabel.primary ? ' · ' : ''}${winLabel.secondary}</span>` : null}
        </p>
      ` : null}

      ${shortCapture ? html`
        <p class="spark-nudge">Short capture — the chart may look sparse. Try 30–60 seconds while the server is lagging.</p>
      ` : null}

      ${seriesConfig.length > 0 ? html`
        <${Section} title="During the capture">
          <${TimeSeries}
            series=${seriesConfig}
            data=${data}
            height=${200}
          />
        </${Section}>
      ` : html`
        <${EmptyState} title="No chart data" body="Timeline entries have no numeric metrics." />
      `}
    </div>
  `;
}

// ── Technical (advanced) ───────────────────────────────────────────────────────

function AdvancedView({ profile }) {
  const [showAllSystem, setShowAllSystem] = useState(false);
  const [showAllConfigs, setShowAllConfigs] = useState(false);
  const systemItems = flattenSystem(profile?.system ?? {});
  const threads = profile?.threads_other ?? profile?.other_threads ?? [];
  const threadsAnalyzed = profile?.threads_analyzed ?? [];
  const serverConfigs = configEntries(profile?.server_configurations ?? profile?.capture?.server_configurations);
  const methods = hotMethods(profile);
  const platform = profile?.platform ?? {};
  const mode = profile?.mode ?? profile?.capture?.mode;
  const engine = profile?.engine ?? profile?.capture?.engine;
  const viewerUrl = profile?.spark_viewer_url;

  const captureMeta = [
    platform.loader && {
      key: 'Loader',
      value: platform.loader_version
        ? `${platform.loader} ${platform.loader_version}`
        : String(platform.loader),
    },
    platform.minecraft && { key: 'Minecraft', value: String(platform.minecraft) },
    platform.spark_version != null && { key: 'Spark version', value: String(platform.spark_version) },
    mode && { key: 'Profiler mode', value: String(mode) },
    engine && { key: 'Engine', value: String(engine) },
    threadsAnalyzed.length > 0 && { key: 'Threads analyzed', value: threadsAnalyzed.join(', ') },
  ].filter(Boolean);

  const systemPreview = showAllSystem ? systemItems : systemItems.slice(0, 16);
  const configPreview = showAllConfigs ? serverConfigs : serverConfigs.slice(0, 16);

  return html`
    <div class="spark-advanced">
      <p class="spark-intro">Raw capture details for power users. For day-to-day triage, use the Overview tab.</p>

      <div class="spark-tech-badges">
        ${mode ? html`<${Badge} tone="info">${mode}</${Badge}>` : null}
        ${engine ? html`<${Badge} tone="neutral">${engine}</${Badge}>` : null}
        ${viewerUrl ? html`
          <a class="spark-tech-link" href=${viewerUrl} target="_blank" rel="noopener noreferrer">
            Open in Spark viewer
          </a>
        ` : null}
      </div>

      ${captureMeta.length > 0 ? html`
        <${Section} title="Capture details">
          <${KeyValue} columns=${2} items=${captureMeta} />
        </${Section}>
      ` : null}

      ${systemItems.length > 0 ? html`
        <${Section} title="System">
          <${KeyValue} columns=${2} items=${systemPreview} />
          <${ShowMoreToggle}
            expanded=${showAllSystem}
            total=${systemItems.length}
            preview=${16}
            onToggle=${() => setShowAllSystem((v) => !v)}
            noun="system fields"
          />
        </${Section}>
      ` : null}

      ${serverConfigs.length > 0 ? html`
        <${Section} title="Server configuration">
          <${KeyValue} columns=${2} items=${configPreview} />
          <${ShowMoreToggle}
            expanded=${showAllConfigs}
            total=${serverConfigs.length}
            preview=${16}
            onToggle=${() => setShowAllConfigs((v) => !v)}
            noun="config entries"
          />
        </${Section}>
      ` : null}

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

function WorkflowCard({ open, onOpenChange }) {
  return html`
    <${Section}
      title="How to capture a profile"
      collapsible=${true}
      open=${open}
      onOpenChange=${onOpenChange}
      actions=${html`<${CopyButton} text=${SPARK_COMMANDS} label="Copy Spark commands" />`}
    >
      <div class="spark-workflow__inner">
        <p class="spark-workflow__desc">
          Run these commands in-game or via console. When the profile is saved on disk, click
          <strong> Refresh</strong> on this tab to load it — or Import a spark.lucko.me link.
        </p>
        <pre class="spark-workflow__code">${SPARK_COMMANDS}</pre>
      </div>
    </${Section}>
  `;
}

function ImportStrip({ open, importing, importError, onClose, onImport }) {
  const [url, setUrl] = useState('');
  if (!open) return null;

  async function submit(e) {
    e?.preventDefault?.();
    const trimmed = url.trim();
    if (!trimmed || importing) return;
    const ok = await onImport(trimmed);
    if (ok) setUrl('');
  }

  return html`
    <${Card} className="spark-import" padding="20">
      <h3 class="spark-import__title">Import Spark profile</h3>
      <form class="spark-import__form" onSubmit=${submit}>
        <${TextField}
          id="spark-import-url"
          label="Spark viewer URL or key"
          placeholder="https://spark.lucko.me/AbCdEfGhIj"
          value=${url}
          onInput=${(e) => setUrl(e.target.value)}
          mono=${true}
          disabled=${importing}
          error=${importError || undefined}
          hint="Downloads once from lucko’s bytebin and saves under watchtower/spark-upload/. Uploaded profiles expire on their side."
        />
        <div class="spark-import__actions">
          <${Button} kind="accent" size="md" type="submit" loading=${importing} disabled=${!url.trim()}>
            Import
          </${Button}>
          <${Button} kind="neutral" size="md" type="button" onClick=${onClose} disabled=${importing}>
            Cancel
          </${Button}>
        </div>
      </form>
    </${Card}>
  `;
}

function formatRefreshed(at) {
  if (!at) return null;
  const sec = Math.round((Date.now() - at) / 1000);
  if (sec < 5) return 'Updated just now';
  if (sec < 60) return `Updated ${sec}s ago`;
  return `Updated ${new Date(at).toLocaleTimeString()}`;
}

// ── PageView ───────────────────────────────────────────────────────────────────

export function PageView() {
  const {
    enabled, profiles, skipped, searchDirs, activePath, profile, loading, listLoading,
    error, view, importing, importError, importOpen, lastRefreshedAt, reportProfilePath,
  } = spark.value;
  const route = getRoute();
  const deepLinkProfile = (() => {
    const raw = route?.params?.profile;
    if (!raw) return null;
    try {
      // URLSearchParams already decodes once; only re-decode if still encoded.
      return raw.includes('%') ? decodeURIComponent(raw) : raw;
    } catch {
      return raw;
    }
  })();

  const { autoProfiles, manualProfiles } = useMemo(() => {
    const auto = [];
    const manual = [];
    for (const p of profiles ?? []) {
      if (isAutoCapturedProfile(p)) auto.push(p);
      else manual.push(p);
    }
    return { autoProfiles: auto, manualProfiles: manual };
  }, [profiles]);

  // Load profile list on mount; honor ?profile= deep link
  useEffect(() => {
    loadSparkProfiles();
  }, []);

  useEffect(() => {
    if (!deepLinkProfile || !profiles?.length) return;
    const match = profiles.find((p) => {
      const path = p.source_path ?? p.path ?? p.file ?? '';
      return path === deepLinkProfile || path.endsWith(deepLinkProfile) || deepLinkProfile.endsWith(path);
    });
    const target = match
      ? (match.source_path ?? match.path ?? match.file)
      : deepLinkProfile;
    if (target && target !== activePath) {
      loadSparkProfile(target);
    }
  }, [deepLinkProfile, profiles, activePath]);

  // Prefer report profile when list loads and nothing selected / deep-linked
  useEffect(() => {
    if (deepLinkProfile || activePath || !profiles?.length || !reportProfilePath) return;
    const match = profiles.find((p) => {
      const path = p.source_path ?? p.path ?? p.file ?? '';
      return path === reportProfilePath || path.endsWith(reportProfilePath) || reportProfilePath.endsWith(path);
    });
    const target = match?.source_path ?? match?.path ?? reportProfilePath;
    if (target) loadSparkProfile(target);
  }, [reportProfilePath, profiles, activePath, deepLinkProfile]);

  function setView(v) {
    spark.value = { ...spark.value, view: v };
    persistSet('sparkView', v);
  }

  function toggleImport() {
    spark.value = {
      ...spark.value,
      importOpen: !spark.value.importOpen,
      importError: null,
    };
  }

  async function handleImport(url) {
    const data = await importSparkFromUrl(url);
    return !!data;
  }

  const [captureOpen, setCaptureOpen] = useState(true);

  useEffect(() => {
    if (profile) setCaptureOpen(false);
  }, [profile ? activePath : null]);

  // Disabled state
  if (!enabled) {
    return html`
      <${Page} tour="spark" title="Spark" subtitle="Performance profiling via Spark">
        <${EmptyState}
          title="Spark integration disabled"
          body="Spark integration is off. Set SPARK_ENABLED=true in watchtower.conf and restart the server."
        />
      </${Page}>
    `;
  }

  const refreshedLabel = formatRefreshed(lastRefreshedAt);
  const dirsLabel = (searchDirs ?? []).length
    ? (searchDirs ?? []).join(' · ')
    : 'watchtower/spark-upload/ · config/spark/';
  const hasAnyProfiles = (manualProfiles.length + autoProfiles.length) > 0;

  return html`
    <${Page}
      tour="spark"
      title="Spark"
      subtitle="Performance profiling via Spark"
      actions=${html`
        <div class="spark-page-actions">
          ${refreshedLabel ? html`<span class="spark-refreshed">${refreshedLabel}</span>` : null}
          <${Button}
            kind="neutral"
            size="md"
            loading=${listLoading}
            onClick=${() => loadSparkProfiles()}
          >Refresh</${Button}>
          <${Button}
            kind=${importOpen ? 'neutral' : 'accent'}
            size="md"
            aria-expanded=${importOpen}
            onClick=${toggleImport}
          >Import from URL</${Button}>
        </div>
      `}
    >
        <${WorkflowCard} open=${captureOpen} onOpenChange=${setCaptureOpen} />

        <${ImportStrip}
          open=${importOpen}
          importing=${importing}
          importError=${importError}
          onClose=${() => { spark.value = { ...spark.value, importOpen: false, importError: null }; }}
          onImport=${handleImport}
        />

        ${skipped?.length ? html`
          <p class="spark-skipped" role="status">
            <span>${skipped.length} file${skipped.length === 1 ? '' : 's'} found but unreadable</span>
            ${skipped.slice(0, 3).map((s) => html`
              <span class="spark-skipped__item" title=${s.reason}>${s.source_path}</span>
            `)}
            ${skipped.length > 3 ? html`<span class="ui-text-low">+${skipped.length - 3} more</span>` : null}
          </p>
        ` : null}

        ${autoProfiles.length ? html`
          <${Section} title="Auto-captured">
            <p class="spark-auto-hint ui-text-low">
              Profiles captured automatically during critical lag (opt-in in Settings → Monitoring).
            </p>
            <${ProfileSelector}
              profiles=${autoProfiles}
              activePath=${activePath}
              loading=${loading || listLoading}
              title="Auto-captured"
            />
          </${Section}>
        ` : null}

        <${Section} title="Profiles">
          ${activePath ? html`
            <p class="spark-auto-hint">
              <${Button}
                kind="neutral"
                size="sm"
                onClick=${() => openSupportBuilder({
                  preset: 'CUSTOM',
                  spark_paths: [activePath],
                })}
              >Add active profile to support pack</${Button}>
            </p>
          ` : null}
          ${!hasAnyProfiles && !listLoading ? html`
            <div class="spark-empty-block">
              <${EmptyState}
                title="No Spark profiles found"
                body=${`Looking in: ${dirsLabel}. Save with /spark profiler stop --save-to-file, then Refresh — or Import a spark.lucko.me link.`}
                action=${html`
                  <div class="spark-empty-actions">
                    <${Button}
                      kind="neutral"
                      size="md"
                      loading=${listLoading}
                      onClick=${() => loadSparkProfiles()}
                    >Refresh</${Button}>
                    <${Button}
                      kind="accent"
                      size="md"
                      onClick=${() => { spark.value = { ...spark.value, importOpen: true, importError: null }; }}
                    >Import from URL</${Button}>
                  </div>
                `}
              />
            </div>
          ` : manualProfiles.length === 0 && !listLoading ? html`
            <p class="spark-no-profiles">No manual profiles yet — use the capture commands above, or open an auto-captured profile.</p>
          ` : html`
            <${ProfileSelector}
              profiles=${manualProfiles.length ? manualProfiles : profiles}
              activePath=${activePath}
              loading=${loading || listLoading}
            />
          `}
        </${Section}>

        ${error ? html`
          <div class="spark-error">
            <${Badge} tone="critical">Error</${Badge}>
            <span>${error}</span>
          </div>
        ` : null}

        ${loading ? html`
          <div class="spark-loading">Loading profile…</div>
        ` : null}

        ${!loading && !error && !profile && hasAnyProfiles ? html`
          <${EmptyState}
            title="No profile selected"
            body="Select a Spark profile above to view analysis results."
          />
        ` : null}

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
