import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { isFixturePreview, requiresLiveAuth } from '@/app/runtime';
import { Button } from '@/ui/patterns';
import { asArray, asRecord, num, str } from '@/lib/utils';
import './support.css';

/** Primary chooser only — CUSTOM is set when the operator edits file picks. */
export const SUPPORT_PRESETS = [
  {
    id: 'QUICK',
    label: 'Quick',
    hint: 'Small pack: versions, ops snapshot, recent log tail.',
  },
  {
    id: 'SERVER_TRIAGE',
    label: 'Server issue',
    hint: 'Logs, last crashes, Spark if present.',
  },
  {
    id: 'WATCHTOWER_BUG',
    label: 'WatchTower bug',
    hint: 'Config, state, light evidence for a WatchTower issue.',
  },
  {
    id: 'FULL_EVIDENCE',
    label: 'Full evidence',
    hint: 'Everything at full detail. Often large.',
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
  if (!Number.isFinite(n) || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryForPreset(preset: string): string {
  if (preset === 'WATCHTOWER_BUG') return 'watchtower_bug';
  if (preset === 'SERVER_TRIAGE' || preset === 'FULL_EVIDENCE') return 'server_lag';
  return 'other';
}

function defaultOptionsForPreset(preset: string, catalog: Record<string, unknown> | null) {
  const logs = asArray<Record<string, unknown>>(catalog?.logs);
  const crashes = asArray<Record<string, unknown>>(catalog?.crashes);
  const spark = asArray<Record<string, unknown>>(catalog?.spark);
  const base = {
    preset,
    category: categoryForPreset(preset),
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

export function SupportBuilderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canWrite = useCanWrite();
  const [catalog, setCatalog] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [preset, setPreset] = useState('QUICK');
  const [note, setNote] = useState('');
  const [opts, setOpts] = useState(() => defaultOptionsForPreset('QUICK', null));
  const [showCustomize, setShowCustomize] = useState(false);
  const [gate, setGate] = useState<Record<string, unknown> | null>(null);
  const [awaitingOverride, setAwaitingOverride] = useState(false);

  function clearGate() {
    setGate(null);
    setAwaitingOverride(false);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      setResult(null);
      setShowCustomize(false);
      setNote('');
      clearGate();
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
    const lookupId = preset === 'CUSTOM' ? 'QUICK' : preset;
    return asRecord(rows.find((r) => str(r.id) === lookupId)?.options);
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
    clearGate();
    setPreset(id);
    setOpts((prev) => ({
      ...defaultOptionsForPreset(id, catalog),
      note: prev.note,
    }));
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

  async function handleBuild(optsExtra?: { quality_gate_override?: boolean }) {
    setBuilding(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        ...opts,
        preset,
        category: categoryForPreset(preset),
        note,
        ...optsExtra,
      };
      if (!optsExtra?.quality_gate_override) {
        const gateRes = asRecord(await api.supportQualityGate(payload));
        const checks = asArray(gateRes.checks);
        const warned = checks.some(
          (c) => str(asRecord(c).status).toLowerCase() === 'warn',
        );
        if (warned) {
          setGate(gateRes);
          setAwaitingOverride(true);
          setBuilding(false);
          return;
        }
      }
      clearGate();
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

  const sizeHint =
    estimate > EMAIL_LIMIT
      ? 'Too big for Discord or email. Upload somewhere and share a link.'
      : estimate > DISCORD_LIMIT
        ? "Over Discord's 10 MB limit. Fine for email or a file host."
        : "Fits Discord's 10 MB attach limit.";

  const sizeWarn = estimate > DISCORD_LIMIT;

  /** Which primary card looks selected when Custom is active (last known base). */
  const selectedCardId =
    preset === 'CUSTOM'
      ? null
      : SUPPORT_PRESETS.some((p) => p.id === preset)
        ? preset
        : 'QUICK';

  const gateChecks = asArray<Record<string, unknown>>(gate?.checks);

  return (
    <div className="sp-modal-root" role="dialog" aria-modal="true" aria-label="Build support pack">
      <button type="button" className="sp-modal-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="sp-modal">
        <div className="sp-modal__head">
          <h2 className="sp-modal__title">Build support pack</h2>
          <p className="sp-modal__sub">
            {isFixturePreview()
              ? 'Fixture preview - compose is simulated; no zip.'
              : 'Redacted zip for Discord or a bug report.'}
          </p>
        </div>

        <div className="sp-modal__body">
          {loading ? <p className="sp-modal__status sp-modal__status--low">Loading catalog…</p> : null}
          {error ? (
            <p className="sp-modal__status sp-modal__status--err" role="alert">
              {error}
            </p>
          ) : null}
          {result ? <p className="sp-modal__status sp-modal__status--ok">{result}</p> : null}
          {building ? (
            <p className="sp-modal__status sp-modal__status--mid" role="status">
              Building… stay on this page. Download starts when ready.
            </p>
          ) : null}

          {awaitingOverride && gate ? (
            <section className="sp-gate" aria-label="Pack checklist">
              <h3 className="sp-section-label">Before you download</h3>
              <ul className="sp-gate__list">
                {gateChecks.map((check) => {
                  const status = str(check.status).toLowerCase();
                  const rowClass =
                    status === 'warn'
                      ? 'sp-gate__row--warn'
                      : status === 'skip'
                        ? 'sp-gate__row--skip'
                        : 'sp-gate__row--pass';
                  return (
                    <li key={str(check.id)} className={`sp-gate__row ${rowClass}`}>
                      <span className="sp-gate__status">{status || 'pass'}</span>
                      <span className="sp-gate__msg">{str(check.message)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="sp-gate__hint">
                You can still download. Warnings are stored in the zip manifest.
              </p>
            </section>
          ) : (
            <>
              <section>
                <h3 className="sp-section-label">Pack type</h3>
                <div className="sp-presets" role="radiogroup" aria-label="Pack type">
                  {SUPPORT_PRESETS.map((card) => {
                    const on = selectedCardId === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={building}
                        onClick={() => applyPreset(card.id)}
                        className={`sp-preset${on ? ' sp-preset--on' : ''}`}
                      >
                        <span className="sp-preset__label">{card.label}</span>
                        <span className="sp-preset__hint">{card.hint}</span>
                      </button>
                    );
                  })}
                </div>
                {preset === 'CUSTOM' ? <p className="sp-custom-flag">Custom file list</p> : null}
              </section>

              <label className="sp-note">
                <span className="sp-note__label">Note for whoever opens the zip (optional)</span>
                <input
                  className="sp-note__input"
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

              <button
                type="button"
                className="sp-customize-toggle"
                disabled={building || loading}
                onClick={() => setShowCustomize((v) => !v)}
                aria-expanded={showCustomize}
              >
                {showCustomize ? 'Hide file choices' : 'Customize files…'}
              </button>

              {showCustomize ? (
                <div className="sp-customize">
                  <div className="sp-customize__col">
                    <p className="sp-customize__head">Logs</p>
                    {logNames.map((name) => (
                      <label key={name} className="sp-customize__row">
                        <input
                          type="checkbox"
                          checked={(opts.logs || []).includes(name)}
                          onChange={(e) => {
                            clearGate();
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
                  <div className="sp-customize__col">
                    <p className="sp-customize__head">Crashes</p>
                    {crashNames.length === 0 ? (
                      <span className="sp-modal__status sp-modal__status--low">None on disk</span>
                    ) : (
                      crashNames.map((name) => (
                        <label key={name} className="sp-customize__row">
                          <input
                            type="checkbox"
                            checked={(opts.crash_files || []).includes(name)}
                            onChange={(e) => {
                              clearGate();
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
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="sp-modal__foot">
          <div className="sp-size">
            <div className="sp-size__main">
              <strong>{formatBytes(estimate)}</strong> estimated
            </div>
            <div className="sp-size__meta">Secrets, IPs, and UUIDs stripped</div>
            <div className={sizeWarn ? 'sp-size__warn' : 'sp-size__meta'}>{sizeHint}</div>
          </div>
          <div className="sp-modal__actions">
            <Button kind="ghost" onClick={onClose}>
              Cancel
            </Button>
            {awaitingOverride ? (
              <>
                <Button kind="ghost" disabled={building} onClick={() => clearGate()}>
                  Back
                </Button>
                <Button
                  kind="primary"
                  disabled={!canWrite || building || loading}
                  title={canWrite ? undefined : VIEW_ONLY_TITLE}
                  onClick={() => void handleBuild({ quality_gate_override: true })}
                >
                  {building ? 'Building…' : 'Download anyway'}
                </Button>
              </>
            ) : (
              <Button
                kind="primary"
                disabled={!canWrite || building || loading}
                title={canWrite ? undefined : VIEW_ONLY_TITLE}
                onClick={() => void handleBuild()}
              >
                {building ? 'Building…' : 'Build and download'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
