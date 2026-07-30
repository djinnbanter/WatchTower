import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useCanWrite } from '@/app/permissions';
import { isFixturePreview, requiresLiveAuth } from '@/app/runtime';
import { Button } from '@/ui/patterns';
import { asArray, asRecord, num, str } from '@/lib/utils';

const VIEW_ONLY_TITLE = 'Your account can view Watchtower but not change it';

const CATEGORIES = [
  { id: 'server_lag', label: 'Lag' },
  { id: 'crash', label: 'Crash' },
  { id: 'wont_start', label: "Won't start" },
  { id: 'join', label: "Can't join" },
  { id: 'watchtower_bug', label: 'Watchtower bug' },
  { id: 'other', label: 'Other' },
] as const;

export const SUPPORT_PRESETS = [
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
] as const;

const FIXTURE_CATALOG = {
  bundle_version: 4,
  soft_budget_bytes: 25 * 1024 * 1024,
  hard_budget_bytes: 100 * 1024 * 1024,
  logs: [
    { name: 'latest.log', size: 120000, mtime: Date.now() / 1000, gz: false },
    { name: 'debug.log', size: 80000, mtime: Date.now() / 1000 - 3600, gz: false },
  ],
  crashes: [{ file: 'crash-sample-server.txt', label: 'Sample crash', size: 12000 }],
  spark: [] as { path: string; size?: number }[],
  stores: {
    ops_cache: { present: true, size: 50000 },
    performance_rollups: { present: true, size: 20000 },
    watchtower_conf: { present: true, size: 2000 },
  },
};

const STORE_FLAGS: Record<string, string | null> = {
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

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function defaultOptionsForPreset(preset: string, catalog: Record<string, unknown> | null) {
  const logs = asArray<Record<string, unknown>>(catalog?.logs);
  const crashes = asArray<Record<string, unknown>>(catalog?.crashes);
  const spark = asArray<Record<string, unknown>>(catalog?.spark);
  const base = {
    preset,
    category: '',
    note: '',
    include_ops: true,
    include_settings: true,
    include_logs: true,
    include_crashes: true,
    include_spark: true,
    log_mode: 'tail' as string,
    logs: logs.slice(0, 2).map((l) => str(l.name)),
    crash_files: crashes.slice(0, 3).map((c) => str(c.file || c.name)),
    spark_paths: spark.slice(0, 2).map((s) => str(s.path || s.name)),
  };
  if (preset === 'QUICK') {
    return { ...base, include_spark: false, include_crashes: false, log_mode: 'tail' };
  }
  if (preset === 'WATCHTOWER_BUG') {
    return { ...base, include_spark: false, log_mode: 'tail' };
  }
  if (preset === 'FULL_EVIDENCE') {
    return {
      ...base,
      log_mode: 'full',
      logs: logs.map((l) => str(l.name)),
      crash_files: crashes.map((c) => str(c.file || c.name)),
      spark_paths: spark.map((s) => str(s.path || s.name)),
    };
  }
  return base;
}

function categorySuggestsPreset(category: string): string | null {
  if (category === 'watchtower_bug') return 'WATCHTOWER_BUG';
  if (category === 'server_lag' || category === 'crash' || category === 'join' || category === 'wont_start') {
    return 'SERVER_TRIAGE';
  }
  return null;
}

export function SupportBuilderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canWrite = useCanWrite();
  const [catalog, setCatalog] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [preset, setPreset] = useState('QUICK');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [opts, setOpts] = useState(() => defaultOptionsForPreset('QUICK', null));
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const data = isFixturePreview()
          ? FIXTURE_CATALOG
          : asRecord(await api.supportCatalog());
        if (cancelled) return;
        setCatalog(data);
        const next = defaultOptionsForPreset('QUICK', data);
        setOpts(next);
        setPreset('QUICK');
      } catch (err) {
        if (!cancelled) {
          setCatalog(FIXTURE_CATALOG);
          setError(err instanceof Error ? err.message : 'Could not load support catalog');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const presetOptions = useMemo(() => {
    const rows = asArray<Record<string, unknown>>(catalog?.presets);
    return asRecord(rows.find((r) => str(r.id) === preset)?.options);
  }, [catalog, preset]);

  const estimate = useMemo(() => {
    const logs = asArray<Record<string, unknown>>(catalog?.logs);
    const crashes = asArray<Record<string, unknown>>(catalog?.crashes);
    const stores = asRecord(catalog?.stores);
    // Backend preset defaults cover flags this modal never sets (live history, snapshot, state).
    const effective: Record<string, unknown> = { ...presetOptions, ...opts };
    let n = 50_000;
    for (const name of opts.logs || []) {
      const hit = logs.find((l) => str(l.name) === name);
      n += num(hit?.size, 20_000);
    }
    if (effective.include_crashes) {
      for (const file of opts.crash_files || []) {
        const hit = crashes.find((c) => str(c.file || c.name) === file);
        n += num(hit?.size, 12_000);
      }
    }
    for (const [storeKey, flag] of Object.entries(STORE_FLAGS)) {
      if (flag !== null && effective[flag] !== true) continue;
      const row = asRecord(stores[storeKey]);
      if (row.present === true) n += num(row.size, 0);
    }
    return n;
  }, [catalog, opts, presetOptions]);

  function applyPreset(id: string) {
    setPreset(id);
    setOpts((prev) => ({
      ...defaultOptionsForPreset(id, catalog),
      category: prev.category,
      note: prev.note,
    }));
  }

  function applyCategory(id: string) {
    setCategory(id);
    const suggested = categorySuggestsPreset(id);
    if (suggested && preset === 'QUICK') applyPreset(suggested);
    setOpts((o) => ({ ...o, category: id }));
  }

  async function waitForZipReady(timeoutMs = 120_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const data = asRecord(await api.reportsStatus());
      if (data.zip_ready) return;
      if (data.running === false && data.success === false) {
        throw new Error(str(data.message, 'Support compose failed'));
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('Timed out waiting for support bundle');
  }

  async function handleBuild() {
    setBuilding(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        ...opts,
        preset,
        category,
        note,
      };
      const res = asRecord(await api.supportCompose(payload));
      if (isFixturePreview() || !requiresLiveAuth()) {
        setResult(str(res.message, 'Support compose simulated (no zip in preview)'));
        return;
      }
      await waitForZipReady();
      const blob = await api.supportBundleDownload();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchtower-support-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setResult('Support bundle downloaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed');
    } finally {
      setBuilding(false);
    }
  }

  if (!open) return null;

  const logNames = asArray<Record<string, unknown>>(catalog?.logs).map((l) => str(l.name));
  const crashNames = asArray<Record<string, unknown>>(catalog?.crashes).map((c) =>
    str(c.file || c.name),
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Build support pack"
    >
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close dialog" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 shadow-[var(--wt-shadow)]">
        <div className="border-b border-wt-line px-5 py-4">
          <h2 className="text-lg font-semibold">Build support pack</h2>
          <p className="mt-1 text-sm text-wt-text-mid">
            {isFixturePreview()
              ? 'Preview mode — sample catalog; compose is simulated (no zip file).'
              : 'Redacted zip for Discord or bug reports.'}
          </p>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {loading ? <p className="text-sm text-wt-text-low">Loading catalog…</p> : null}
          {error ? (
            <p className="text-sm text-wt-danger" role="alert">
              {error}
            </p>
          ) : null}
          {result ? <p className="text-sm text-wt-ok">{result}</p> : null}
          {building ? (
            <p className="text-sm text-wt-text-mid" role="status">
              Building… stay on this page — download starts when ready.
            </p>
          ) : null}

          <section>
            <h3 className="mb-2 text-sm font-semibold">1. What&apos;s going on?</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`rounded-[var(--radius-wt-sm)] border px-2.5 py-1 text-xs font-semibold ${
                    category === c.id
                      ? 'border-wt-accent bg-wt-accent-soft text-wt-accent'
                      : 'border-wt-line text-wt-text-mid'
                  }`}
                  onClick={() => applyCategory(c.id)}
                  disabled={building}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm">
              Short note (optional)
              <input
                className="mt-1 w-full rounded-xl border border-wt-line bg-wt-bg2 px-3 py-2"
                name="note"
                autoComplete="off"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setOpts((o) => ({ ...o, note: e.target.value }));
                }}
                placeholder="e.g. TPS drops when exploring new chunks"
                disabled={building}
              />
            </label>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">2. Pack type</h3>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Pack type">
              {SUPPORT_PRESETS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  role="radio"
                  aria-checked={preset === card.id}
                  disabled={building}
                  onClick={() => applyPreset(card.id)}
                  className={`rounded-xl border p-3 text-left ${
                    preset === card.id
                      ? 'border-wt-accent bg-wt-accent-soft/40'
                      : 'border-wt-line bg-wt-bg2/40'
                  }`}
                >
                  <strong className="text-sm">{card.label}</strong>
                  <span className="mt-1 block text-xs text-wt-text-low">{card.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">3. What will be included</h3>
            <div className="rounded-xl border border-wt-line bg-wt-bg2/40 p-3 text-sm">
              <div>
                <strong>{formatBytes(estimate)}</strong> estimated
              </div>
              <div className="text-xs text-wt-text-low">Secrets, IPs and UUIDs stripped</div>
              {estimate > EMAIL_LIMIT ? (
                <div className="mt-1 text-xs text-wt-warn">
                  Large pack — too big for Discord or email. Nothing is trimmed; upload it somewhere
                  with a link instead.
                </div>
              ) : estimate > DISCORD_LIMIT ? (
                <div className="mt-1 text-xs text-wt-warn">
                  Over Discord&apos;s 10 MB limit — fine for email or a file host.
                </div>
              ) : (
                <div className="mt-1 text-xs text-wt-text-low">Small enough to attach in Discord.</div>
              )}
            </div>
            <button
              type="button"
              className="mt-2 text-sm text-wt-accent hover:underline"
              disabled={building || loading}
              onClick={() => setShowCustomize((v) => !v)}
              aria-expanded={showCustomize}
            >
              {showCustomize ? 'Hide file choices' : 'Customize files…'}
            </button>
            {showCustomize ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-wt-text-low">
                    Logs
                  </p>
                  {logNames.map((name) => (
                    <label key={name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(opts.logs || []).includes(name)}
                        onChange={(e) => {
                          setOpts((o) => ({
                            ...o,
                            logs: e.target.checked
                              ? [...(o.logs || []), name]
                              : (o.logs || []).filter((x) => x !== name),
                          }));
                          setPreset('CUSTOM');
                        }}
                      />
                      {name}
                    </label>
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-wt-text-low">
                    Crashes
                  </p>
                  {crashNames.map((name) => (
                    <label key={name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={(opts.crash_files || []).includes(name)}
                        onChange={(e) => {
                          setOpts((o) => ({
                            ...o,
                            include_crashes: true,
                            crash_files: e.target.checked
                              ? [...(o.crash_files || []), name]
                              : (o.crash_files || []).filter((x) => x !== name),
                          }));
                          setPreset('CUSTOM');
                        }}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
        <div className="flex justify-end gap-2 border-t border-wt-line px-5 py-3">
          <Button kind="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            kind="primary"
            disabled={!canWrite || building || loading}
            title={canWrite ? undefined : VIEW_ONLY_TITLE}
            onClick={() => void handleBuild()}
          >
            {building ? 'Building…' : 'Build & download'}
          </Button>
        </div>
      </div>
    </div>
  );
}
