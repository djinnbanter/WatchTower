import { html, useState, useEffect, useMemo } from '../../lib/preact.js';
import { kickRenderNow } from '../../app/kick-render.js';
import { Modal } from '../../ui/patterns/index.js';
import { Button, Segmented, TextField, Toggle, ScrollRegion, Spinner } from '../../ui/primitives/index.js';
import { supportCatalog, supportCompose, supportBundleDownload, reportsStatus } from '../../api/endpoints.js';
import { isEmbedded } from '../../api/index.js';
import { opsCache, reports, ui } from '../../state/stores.js';
import { addToast, kickReportPoll, openModal, closeModal } from '../../state/actions.js';

/**
 * Open the Support Bundle Builder (preview + live).
 * Uses ui.modal — same path as crash/lag modals, tracked in main.js effect.
 */
export function openSupportBuilder(prefill = null) {
  openModal('support-builder', { prefill: prefill || null });
}

export function closeSupportBuilder() {
  closeModal();
}

const CATEGORIES = [
  { id: 'server_lag', label: 'Lag' },
  { id: 'crash', label: 'Crash' },
  { id: 'wont_start', label: "Won't start" },
  { id: 'join', label: "Can't join" },
  { id: 'watchtower_bug', label: 'Watchtower bug' },
  { id: 'other', label: 'Other' },
];

const PRESET_CARDS = [
  {
    id: 'QUICK',
    label: 'Quick',
    hint: 'Small redacted pack — versions, ops snapshot, recent log tail. Best for Discord.',
  },
  {
    id: 'SERVER_TRIAGE',
    label: 'Server issue',
    hint: 'Logs, last crashes, Spark if present. Use for lag, crashes, join problems.',
  },
  {
    id: 'WATCHTOWER_BUG',
    label: 'Watchtower bug',
    hint: 'Config + state + light evidence so we can reproduce a Watchtower problem.',
  },
  {
    id: 'FULL_EVIDENCE',
    label: 'Full evidence',
    hint: 'Everything, at full detail — complete metric history. Often tens of MB.',
  },
  {
    id: 'CUSTOM',
    label: 'Custom',
    hint: 'Pick files yourself. Starts from Quick, then edit below.',
  },
];

const FIXTURE_CATALOG = {
  bundle_version: 4,
  soft_budget_bytes: 25 * 1024 * 1024,
  hard_budget_bytes: 100 * 1024 * 1024,
  logs: [
    { name: 'latest.log', size: 120000, mtime: Date.now() / 1000, gz: false },
    { name: 'debug.log', size: 80000, mtime: Date.now() / 1000 - 3600, gz: false },
  ],
  crashes: [
    { file: 'crash-2026-07-20_12.00.00-server.txt', label: 'Sample crash', size: 12000 },
  ],
  spark: [],
  stores: {
    ops_cache: { present: true, size: 50000 },
    performance_rollups: { present: true, size: 20000 },
    watchtower_conf: { present: true, size: 2000 },
  },
  presets: [],
};

const STORE_FLAGS = {
  ops_cache: null,
  performance_rollups: 'include_rollups',
  live_history: 'include_live_history',
  snapshot: 'include_snapshot',
  state: 'include_state',
  watchtower_conf: 'include_conf',
  server_toml: 'include_server_toml',
  server_properties: 'include_server_properties',
};

const DISCORD_LIMIT = 10 * 1024 * 1024;
const EMAIL_LIMIT = 25 * 1024 * 1024;

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateSize(opts, catalog) {
  let bytes = 80_000;
  const logMap = new Map((catalog?.logs ?? []).map((l) => [l.name, l]));
  for (const sel of opts.logs ?? []) {
    if (sel.mode === 'OFF') continue;
    const meta = logMap.get(sel.file);
    if (!meta) continue;
    bytes += sel.mode === 'FULL' ? meta.size : Math.min(meta.size, (sel.tail_lines || 2000) * 120);
  }
  if (opts.include_crashes) {
    const crashes = catalog?.crashes ?? [];
    const n = opts.crash_files?.length || opts.crash_last_n || 0;
    for (let i = 0; i < Math.min(n, crashes.length); i++) {
      bytes += crashes[i].size || 50_000;
    }
  }
  if (opts.include_spark && (catalog?.spark?.length ?? 0) > 0) {
    bytes += catalog.spark[0].size || 0;
  }
  const stores = catalog?.stores ?? {};
  for (const [storeKey, flag] of Object.entries(STORE_FLAGS)) {
    if (flag !== null && opts[flag] !== true) continue;
    const row = stores[storeKey];
    if (row?.present) bytes += row.size ?? 0;
  }
  return bytes;
}

function defaultOptionsForPreset(presetId, catalog) {
  const base = {
    preset: presetId,
    category: '',
    note: '',
    include_latest_log_tail: true,
    include_spark: false,
    include_crashes: false,
    include_boot_excerpt: false,
    include_conf: true,
    include_server_toml: true,
    include_state: false,
    include_mods_list: true,
    include_jvm_flags: false,
    include_server_properties: false,
    include_snapshot: false,
    include_rollups: true,
    include_live_history: false,
    crash_last_n: 0,
    crash_files: [],
    spark_paths: [],
    logs: [{ file: 'latest.log', mode: 'TAIL', tail_lines: 2000 }],
  };
  if (presetId === 'QUICK') {
    return { ...base, include_spark: false, logs: [{ file: 'latest.log', mode: 'TAIL', tail_lines: 2000 }] };
  }
  if (presetId === 'SERVER_TRIAGE') {
    return {
      ...base,
      include_spark: true,
      include_crashes: true,
      crash_last_n: 3,
      include_boot_excerpt: true,
      include_snapshot: true,
      logs: [
        { file: 'latest.log', mode: 'TAIL', tail_lines: 5000 },
        { file: 'stderr.log', mode: 'TAIL', tail_lines: 2000 },
      ],
    };
  }
  if (presetId === 'WATCHTOWER_BUG') {
    return {
      ...base,
      category: 'watchtower_bug',
      include_state: true,
      include_jvm_flags: true,
      include_crashes: true,
      crash_last_n: 1,
      logs: [{ file: 'latest.log', mode: 'TAIL', tail_lines: 2000 }],
    };
  }
  if (presetId === 'FULL_EVIDENCE') {
    const logs = (catalog?.logs ?? []).slice(0, 6).map((l) => ({
      file: l.name,
      mode: 'TAIL',
      tail_lines: 5000,
    }));
    return {
      ...base,
      include_spark: true,
      include_crashes: true,
      crash_last_n: 5,
      include_boot_excerpt: true,
      include_state: true,
      include_jvm_flags: true,
      include_server_properties: true,
      include_snapshot: true,
      include_live_history: true,
      live_history_minutes: 0,
      logs: logs.length ? logs : base.logs,
    };
  }
  return { ...base, preset: 'CUSTOM' };
}

function categorySuggestsPreset(categoryId) {
  if (categoryId === 'watchtower_bug') return 'WATCHTOWER_BUG';
  if (categoryId === 'crash' || categoryId === 'server_lag' || categoryId === 'join' || categoryId === 'wont_start') {
    return 'SERVER_TRIAGE';
  }
  return null;
}

function summarizeOpts(opts, catalog) {
  const bits = [];
  const logCount = (opts.logs || []).filter((l) => l.mode !== 'OFF').length;
  if (logCount) bits.push(`${logCount} log${logCount === 1 ? '' : 's'}`);
  if (opts.include_crashes) bits.push(`crashes ×${opts.crash_last_n || opts.crash_files?.length || 0}`);
  if (opts.include_spark) bits.push('Spark');
  if (opts.include_conf) bits.push('config');
  if (opts.include_state) bits.push('state');
  if (opts.include_mods_list) bits.push('mods list');
  if (!bits.length) bits.push('core only');
  const crashAvail = catalog?.crashes?.length ?? 0;
  return bits.join(' · ') + (opts.include_crashes && crashAvail === 0 ? ' (no crashes on disk)' : '');
}

async function waitForZipReady(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    kickReportPoll();
    try {
      if (isEmbedded()) {
        const data = await reportsStatus();
        if (data?.zip_ready) return true;
        if (data?.running === false && data?.success === false) {
          throw new Error(data.message || 'Support compose failed');
        }
      } else {
        const run = reports.value.run;
        if (run && run.running === false && run.success === true) return true;
        if (run && run.running === false && run.success === false) {
          throw new Error(run.message || 'Support compose failed');
        }
      }
    } catch (err) {
      if (err?.message && !String(err.message).includes('fetch') && !String(err.message).includes('Failed to fetch')) {
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Timed out waiting for support bundle');
}

async function downloadReadyZip() {
  if (!isEmbedded()) {
    addToast('Preview mode — compose simulated; no zip download.', 'info');
    return;
  }
  const blob = await supportBundleDownload();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `watchtower-support-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  addToast('Support bundle downloaded', 'success');
}

export async function composeAndDownloadSupport(options) {
  if (!isEmbedded()) {
    addToast('Preview mode — compose simulated; no zip download.', 'info');
    reports.value = {
      ...reports.value,
      run: {
        running: false,
        startedAt: Date.now(),
        message: 'Support bundle ready (preview)',
        success: true,
        stage: null,
        stageLabel: null,
        stageDetail: null,
      },
    };
    kickRenderNow();
    return;
  }
  const startedAt = Date.now();
  reports.value = {
    ...reports.value,
    run: {
      running: true,
      startedAt,
      message: 'Starting support compose…',
      success: null,
      stage: 'compose',
      stageLabel: 'Composing support bundle',
      stageDetail: 'Starting…',
    },
  };
  kickRenderNow();
  kickReportPoll();
  const res = await supportCompose(options);
  if (res?.status === 'already_running') {
    addToast('Support compose already running — waiting for it to finish…', 'info');
    kickReportPoll();
  }
  await waitForZipReady();
  await downloadReadyZip();
}

function buildDiscordBlurb(opts, catalog) {
  const issues = opsCache.value?.data?.issues_live
    || opsCache.value?.data?.issues
    || [];
  const active = Array.isArray(issues)
    ? issues.filter((i) => (i.status || 'open') !== 'resolved').slice(0, 5)
    : [];
  const catLabel = CATEGORIES.find((c) => c.id === opts.category)?.label || opts.category || 'unspecified';
  const lines = [
    'Watchtower support request',
    `Category: ${catLabel}`,
    `Preset: ${opts.preset}`,
    opts.note ? `Note: ${opts.note}` : null,
    `Bundle: v${catalog?.bundle_version ?? 4} (redacted)`,
    active.length
      ? `Top issues: ${active.map((i) => i.id || i.key || i.message).join(', ')}`
      : 'Top issues: none open',
    'Full pack attached as watchtower-support-*.zip',
  ].filter(Boolean);
  return lines.join('\n');
}

export function SupportBundleBuilderModal() {
  const modal = ui.value.modal;
  const open = modal?.type === 'support-builder';
  const prefill = modal?.props?.prefill ?? null;
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState('QUICK');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [opts, setOpts] = useState(() => defaultOptionsForPreset('QUICK', null));
  const [showCustomize, setShowCustomize] = useState(false);
  const run = reports.value.run;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setShowCustomize(!!(prefill?.logs?.length || prefill?.crash_files?.length || prefill?.spark_paths?.length));
      try {
        const data = isEmbedded() ? await supportCatalog() : FIXTURE_CATALOG;
        if (cancelled) return;
        setCatalog(data);
        let nextPreset = 'QUICK';
        let next = defaultOptionsForPreset('QUICK', data);
        let nextCategory = '';
        let nextNote = '';
        if (prefill?.preset) {
          nextPreset = prefill.preset;
          next = defaultOptionsForPreset(prefill.preset, data);
        }
        if (prefill?.category) {
          nextCategory = prefill.category;
          next.category = prefill.category;
          const suggested = categorySuggestsPreset(prefill.category);
          if (suggested && !prefill.preset) {
            nextPreset = suggested;
            next = defaultOptionsForPreset(suggested, data);
            next.category = prefill.category;
          }
        }
        if (prefill?.note) {
          nextNote = prefill.note;
          next.note = prefill.note;
        }
        if (prefill?.logs?.length) {
          nextPreset = 'CUSTOM';
          next.preset = 'CUSTOM';
          next.logs = prefill.logs;
        }
        if (prefill?.crash_files?.length) {
          nextPreset = 'CUSTOM';
          next.preset = 'CUSTOM';
          next.include_crashes = true;
          next.crash_files = prefill.crash_files;
          next.crash_last_n = prefill.crash_files.length;
        }
        if (prefill?.spark_paths?.length) {
          nextPreset = 'CUSTOM';
          next.preset = 'CUSTOM';
          next.include_spark = true;
          next.spark_paths = prefill.spark_paths;
        }
        setPreset(nextPreset);
        setCategory(nextCategory);
        setNote(nextNote);
        setOpts(next);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load catalog');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, prefill]);

  const estimate = useMemo(() => estimateSize(opts, catalog), [opts, catalog]);
  const summary = useMemo(() => summarizeOpts(opts, catalog), [opts, catalog]);

  function applyPreset(id) {
    setPreset(id);
    const next = defaultOptionsForPreset(id, catalog);
    next.category = category;
    next.note = note;
    if (id === 'WATCHTOWER_BUG' && !category) {
      setCategory('watchtower_bug');
      next.category = 'watchtower_bug';
    }
    setOpts(next);
    if (id === 'CUSTOM') setShowCustomize(true);
  }

  function applyCategory(id) {
    setCategory(id);
    const suggested = categorySuggestsPreset(id);
    if (suggested && (preset === 'QUICK' || preset === 'SERVER_TRIAGE' || preset === 'WATCHTOWER_BUG' || !preset)) {
      const next = defaultOptionsForPreset(suggested, catalog);
      next.category = id;
      next.note = note;
      setPreset(suggested);
      setOpts(next);
      return;
    }
    setOpts((o) => ({ ...o, category: id }));
  }

  function setLogMode(file, mode) {
    setPreset('CUSTOM');
    setOpts((prev) => {
      const logs = [...(prev.logs || [])];
      const idx = logs.findIndex((l) => l.file === file);
      if (mode === 'OFF') {
        if (idx >= 0) logs.splice(idx, 1);
      } else if (idx >= 0) {
        logs[idx] = { ...logs[idx], mode, tail_lines: logs[idx].tail_lines || 2000 };
      } else {
        logs.push({ file, mode, tail_lines: 2000 });
      }
      return { ...prev, preset: 'CUSTOM', logs };
    });
  }

  function logMode(file) {
    const row = (opts.logs || []).find((l) => l.file === file);
    return row?.mode || 'OFF';
  }

  async function handleBuild() {
    setBuilding(true);
    setError('');
    try {
      const payload = {
        ...opts,
        preset,
        category: category || 'other',
        note,
      };
      await composeAndDownloadSupport(payload);
      closeSupportBuilder();
    } catch (err) {
      setError(err?.message || 'Compose failed');
      addToast(err?.message || 'Compose failed', 'error');
    } finally {
      setBuilding(false);
      kickRenderNow();
    }
  }

  const blurb = buildDiscordBlurb({ ...opts, preset, category, note }, catalog);
  const stageLabel = run?.stageLabel || run?.message || 'Composing support bundle…';

  return html`
    <${Modal}
      open=${open}
      title="Build support pack"
      size="lg"
      onClose=${() => !building && closeSupportBuilder()}
      footer=${html`
        <${Button} kind="neutral" disabled=${building} onClick=${closeSupportBuilder}>Cancel</${Button}>
        <${Button}
          kind="neutral"
          disabled=${building}
          onClick=${() => {
            navigator.clipboard?.writeText(blurb)
              .then(() => addToast('Copied Discord blurb', 'success'))
              .catch(() => addToast('Could not copy', 'error'));
          }}
        >Copy for Discord</${Button}>
        <${Button} kind="accent" loading=${building} disabled=${loading || !!error && !catalog} onClick=${handleBuild}>
          ${building ? 'Building…' : 'Build & download'}
        </${Button}>
      `}
    >
      <div class="feat-support-builder">
        ${!isEmbedded() && html`
          <p class="feat-support-builder__banner feat-support-builder__banner--info">
            Preview mode — sample catalog; compose is simulated (no zip file).
          </p>
        `}

        ${building && html`
          <div class="feat-support-builder__banner feat-support-builder__banner--progress" role="status">
            <${Spinner} size=${16} />
            <div class="feat-support-builder__progress-text">
              <strong>${stageLabel}</strong>
              <span class="ui-text-low">Stay on this page — download starts when ready.</span>
            </div>
          </div>
        `}

        ${error && html`<p class="feat-support-builder__error" role="alert">${error}</p>`}
        ${loading && html`
          <p class="feat-support-builder__banner feat-support-builder__banner--info">
            <${Spinner} size=${14} /> Loading what’s available on this server…
          </p>
        `}

        <section class="feat-support-builder__section">
          <h3 class="feat-support-builder__heading">1. What’s going on?</h3>
          <${Segmented}
            value=${category || ''}
            onChange=${applyCategory}
            options=${CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
          />
          <${TextField}
            label="Short note for whoever helps you (optional)"
            value=${note}
            onInput=${(e) => {
              const v = e?.target?.value ?? '';
              setNote(v);
              setOpts((o) => ({ ...o, note: v }));
            }}
            placeholder="e.g. TPS drops when exploring new chunks"
          />
        </section>

        <section class="feat-support-builder__section">
          <h3 class="feat-support-builder__heading">2. Pack type</h3>
          <div class="feat-support-builder__presets" role="radiogroup" aria-label="Pack type">
            ${PRESET_CARDS.map((card) => html`
              <button
                type="button"
                key=${card.id}
                class=${`feat-support-builder__preset${preset === card.id ? ' feat-support-builder__preset--active' : ''}`}
                role="radio"
                aria-checked=${preset === card.id}
                disabled=${building}
                onClick=${() => applyPreset(card.id)}
              >
                <strong>${card.label}</strong>
                <span>${card.hint}</span>
              </button>
            `)}
          </div>
        </section>

        <section class="feat-support-builder__section">
          <h3 class="feat-support-builder__heading">3. What will be included</h3>
          <div class="feat-support-builder__summary">
            <div class="feat-support-builder__summary-main">
              <div><strong>${formatBytes(estimate)}</strong> estimated</div>
              <div class="ui-text-low">${summary}</div>
              <div class="ui-text-low">Secrets, IPs and UUIDs stripped</div>
            </div>
            <div class="feat-support-builder__badge">Secrets stripped</div>
          </div>
          ${estimate > EMAIL_LIMIT
            ? html`<div class="feat-support-builder__warn">Large pack — too big for Discord or email. Nothing is trimmed; upload it somewhere with a link instead.</div>`
            : estimate > DISCORD_LIMIT
              ? html`<div class="feat-support-builder__warn">Over Discord's 10 MB limit — fine for email or a file host.</div>`
              : html`<div class="ui-text-low">Small enough to attach in Discord.</div>`}

          <button
            type="button"
            class="feat-support-builder__customize-toggle"
            disabled=${building || loading}
            onClick=${() => setShowCustomize((v) => !v)}
            aria-expanded=${showCustomize}
          >
            ${showCustomize ? 'Hide file choices' : 'Customize files…'}
          </button>
        </section>

        ${showCustomize && html`
          <${ScrollRegion} className="feat-support-builder__scroll" label="Customize pack contents">
            <section class="feat-support-builder__section">
              <h3 class="feat-support-builder__heading">Logs</h3>
              ${(catalog?.logs ?? []).length === 0
                ? html`<p class="ui-text-low">No log files found under logs/.</p>`
                : (catalog?.logs ?? []).map((log) => html`
                  <div class="feat-support-builder__row" key=${log.name}>
                    <div class="feat-support-builder__row-main">
                      <strong>${log.name}</strong>
                      <span class="ui-text-low">${formatBytes(log.size)}</span>
                    </div>
                    <${Segmented}
                      size="sm"
                      value=${logMode(log.name)}
                      onChange=${(v) => setLogMode(log.name, v)}
                      options=${[
                        { value: 'OFF', label: 'Off' },
                        { value: 'TAIL', label: 'Tail' },
                        { value: 'FULL', label: 'Full' },
                      ]}
                    />
                  </div>
                `)}
            </section>

            <section class="feat-support-builder__section">
              <h3 class="feat-support-builder__heading">Crashes & Spark</h3>
              <label class="feat-support-builder__toggle">
                <${Toggle}
                  checked=${!!opts.include_crashes}
                  onChange=${(v) => {
                    setPreset('CUSTOM');
                    setOpts((o) => ({
                      ...o,
                      include_crashes: v,
                      preset: 'CUSTOM',
                      crash_last_n: v ? (o.crash_last_n || 3) : 0,
                    }));
                  }}
                />
                Include crash reports (last ${opts.crash_last_n || 0}${catalog?.crashes?.length != null ? ` of ${catalog.crashes.length}` : ''})
              </label>
              <label class="feat-support-builder__toggle">
                <${Toggle}
                  checked=${!!opts.include_spark}
                  onChange=${(v) => {
                    setPreset('CUSTOM');
                    setOpts((o) => ({ ...o, include_spark: v, preset: 'CUSTOM' }));
                  }}
                />
                Include latest Spark profile
              </label>
              <label class="feat-support-builder__toggle">
                <${Toggle}
                  checked=${!!opts.include_boot_excerpt}
                  onChange=${(v) => {
                    setPreset('CUSTOM');
                    setOpts((o) => ({ ...o, include_boot_excerpt: v, preset: 'CUSTOM' }));
                  }}
                />
                Boot excerpt (head + tail of latest.log)
              </label>
            </section>

            <section class="feat-support-builder__section">
              <h3 class="feat-support-builder__heading">Watchtower & extras</h3>
              <label class="feat-support-builder__toggle">
                <${Toggle} checked=${!!opts.include_conf} onChange=${(v) => setOpts((o) => ({ ...o, include_conf: v }))} />
                Redacted watchtower.conf
              </label>
              <label class="feat-support-builder__toggle">
                <${Toggle} checked=${!!opts.include_state} onChange=${(v) => setOpts((o) => ({ ...o, include_state: v }))} />
                Sanitized Watchtower state
              </label>
              <label class="feat-support-builder__toggle">
                <${Toggle} checked=${!!opts.include_mods_list} onChange=${(v) => setOpts((o) => ({ ...o, include_mods_list: v }))} />
                Mods list
              </label>
              <label class="feat-support-builder__toggle">
                <${Toggle} checked=${!!opts.include_jvm_flags} onChange=${(v) => setOpts((o) => ({ ...o, include_jvm_flags: v }))} />
                JVM flags (classified)
              </label>
              <label class="feat-support-builder__toggle">
                <${Toggle} checked=${!!opts.include_server_properties} onChange=${(v) => setOpts((o) => ({ ...o, include_server_properties: v }))} />
                server.properties (redacted)
              </label>
              <label class="feat-support-builder__toggle">
                <${Toggle} checked=${!!opts.include_live_history} onChange=${(v) => setOpts((o) => ({ ...o, include_live_history: v }))} />
                Live history window
              </label>
            </section>
          </${ScrollRegion}>
        `}
      </div>
    </${Modal}>
  `;
}

export default SupportBundleBuilderModal;
