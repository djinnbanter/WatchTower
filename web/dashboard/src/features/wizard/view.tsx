import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useSessionStore } from '@/app/session-store';
import { requiresLiveAuth } from '@/app/runtime';
import { navigate, type RouteState } from '@/app/router';
import { LocalFolderSetup } from '@/features/backups/local-folder-setup';
import {
  completeSetupWizard,
  patchSetupWizard,
  readSetupWizard,
} from '@/features/wizard/persist';
import {
  clampLookbackDays,
  daysToHours,
  hoursToLookbackSelection,
  LOOKBACK_PRESET_DAYS,
} from '@/features/wizard/lookback-days';
import { Archive, Check, RefreshCw, Search, Shield, SlidersHorizontal, Radar } from '@/ui/icons';
import { PageEnter } from '@/ui/motion';
import { Button, SpecularCtaButton } from '@/ui/patterns';
import { asArray, asRecord, bool, num, str, totpQrSrc } from '@/lib/utils';

const STEPS = [
  { id: 'welcome', title: 'Set up Watchtower', icon: Radar },
  { id: 'options', title: 'Options', icon: SlidersHorizontal },
  { id: 'audit', title: 'Initial discovery', icon: Search },
  { id: 'backups', title: 'Backups', icon: Archive },
  { id: 'security', title: 'Security', icon: Shield },
] as const;

const DISCOVERY_STAGES = [
  { id: 'window', label: 'Computing time window' },
  { id: 'collect', label: 'Collecting logs, crashes, mods, host metrics' },
  { id: 'analyze', label: 'Analyzing health and crashes' },
  { id: 'enrich', label: 'Enriching incidents and scorecard' },
  { id: 'write', label: 'Writing facts and brief' },
  { id: 'finalize', label: 'Saving state and ops cache' },
  { id: 'done', label: 'Done' },
];

type StepId = (typeof STEPS)[number]['id'];

export function PageView({ route: _route }: { route: RouteState }) {
  const setBootPhase = useSessionStore((s) => s.setBootPhase);
  const session = useSessionStore((s) => s.session);
  const paused = readSetupWizard();
  const [step, setStep] = useState(() => {
    if (paused && paused.completed !== true && typeof paused.stepIdx === 'number') {
      return Math.min(Math.max(0, paused.stepIdx), STEPS.length - 1);
    }
    return 0;
  });
  const [discoveryDone, setDiscoveryDone] = useState(
    () => paused?.discovery === 'ok',
  );
  const [backupSaved, setBackupSaved] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [baselineDays, setBaselineDays] = useState(() =>
    clampLookbackDays(typeof paused?.baselineDays === 'number' ? paused.baselineDays : 1),
  );
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [savingLookback, setSavingLookback] = useState(false);
  const current = STEPS[step]!;
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const discoveryBlocked = current.id === 'audit' && !discoveryDone;

  const persistBaselineDays = useCallback(async (days: number): Promise<boolean> => {
    const d = clampLookbackDays(days);
    setSavingLookback(true);
    setOptionsError(null);
    try {
      await api.saveSettings({ lookbackHours: daysToHours(d) });
      setBaselineDays(d);
      patchSetupWizard({ baselineDays: d });
      return true;
    } catch (err) {
      setOptionsError(err instanceof Error ? err.message : 'Could not save baseline window.');
      return false;
    } finally {
      setSavingLookback(false);
    }
  }, []);

  const finish = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      completeSetupWizard({
        discovery: discoveryDone ? 'ok' : 'skipped',
        ...extra,
      });
      setBootPhase('ready');
      navigate({ tab: 'overview', setup: null });
      if (requiresLiveAuth()) {
        await Promise.allSettled([
          api.reportsIndex(),
          api.settings(),
          api.overviewMeta(),
          api.opsCache(),
          api.live(),
          api.samples(60, 500),
        ]);
      }
    },
    [discoveryDone, setBootPhase],
  );

  const canNext = !discoveryBlocked;

  return (
    <PageEnter className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <div className="overflow-hidden rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1">
        <div className="p-8">
          <div className="grid h-14 w-14 place-items-center rounded-[var(--radius-wt-lg)] bg-wt-accent/15 text-wt-accent">
            <Icon size={26} />
          </div>
          <div className="mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-wt-bg2">
            <div
              className="h-full w-full origin-left rounded-full bg-wt-accent transition-transform duration-300"
              style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }}
            />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-wt-text-low">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{current.title}</h2>
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 w-1.5 rounded-full ${i <= step ? 'bg-wt-accent' : 'bg-wt-line'}`}
              />
            ))}
          </div>
        </div>
        <div className="space-y-4 px-6 pb-6 pt-2">
          {current.id === 'welcome' ? <WelcomeStep /> : null}
          {current.id === 'options' ? (
            <OptionsStep
              days={baselineDays}
              onDaysChange={setBaselineDays}
              onPersist={persistBaselineDays}
              persistError={optionsError}
              savingLookback={savingLookback}
            />
          ) : null}
          {current.id === 'audit' ? (
            <DiscoveryStep
              onCompleteChange={setDiscoveryDone}
              baselineDays={baselineDays}
              persistBaselineDays={persistBaselineDays}
            />
          ) : null}
          {current.id === 'backups' ? (
            <BackupsStep
              onLater={() => setStep((s) => s + 1)}
              onFolderSaved={() => setBackupSaved(true)}
              folderSaved={backupSaved}
            />
          ) : null}
          {current.id === 'security' ? <SecurityStep session={session} /> : null}

          {current.id === 'options' && optionsError ? (
            <p className="text-sm text-wt-danger">{optionsError}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button kind="ghost" onClick={() => setSkipConfirm(true)}>
              Skip setup
            </Button>
            <div className="flex gap-2">
              {step > 0 ? (
                <Button kind="default" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              ) : null}
              {isLast ? (
                <SpecularCtaButton kind="primary" onClick={() => void finish()}>
                  Finish
                </SpecularCtaButton>
              ) : (
                <SpecularCtaButton
                  kind="primary"
                  disabled={!canNext || savingLookback}
                  onClick={() => {
                    void (async () => {
                      if (current.id === 'options') {
                        const ok = await persistBaselineDays(baselineDays);
                        if (!ok) return;
                      }
                      setStep((s) => s + 1);
                    })();
                  }}
                >
                  {discoveryBlocked
                    ? 'Waiting for discovery…'
                    : savingLookback
                      ? 'Saving…'
                      : 'Next'}
                </SpecularCtaButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {skipConfirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Cancel"
            onClick={() => setSkipConfirm(false)}
          />
          <div className="relative z-[1] w-full max-w-md rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 p-5 shadow-[var(--wt-shadow)]">
            <h3 className="text-lg font-semibold">Skip setup?</h3>
            <p className="mt-2 text-sm text-wt-text-mid">
              You can relaunch the wizard later from Settings → About. Discovery and backup folder
              setup can wait, but Overview will have less data until you finish them.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button kind="default" onClick={() => setSkipConfirm(false)}>
                Keep going
              </Button>
              <Button
                kind="primary"
                onClick={() => void finish({ skipped: true, discovery: discoveryDone ? 'ok' : 'skipped' })}
              >
                Skip for now
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageEnter>
  );
}

function WelcomeStep() {
  return (
    <div className="space-y-3 text-sm text-wt-text-mid">
      <p>
        WatchTower is your ops control panel for this Minecraft server — live charts, crash triage,
        and backups health. Everything stays on your host. It is not player analytics.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Change the default username/password <strong>before</strong> discovery (sign-in gate)
        </li>
        <li>
          On the next step, pick how far back the <strong>first baseline</strong> looks — not your
          whole server lifetime
        </li>
        <li>
          Optionally enable Modrinth lookups, then run the <strong>deep audit baseline</strong>
        </li>
        <li>Point WatchTower at your <strong>backup folder</strong> so freshness stays accurate</li>
        <li>After that, Watching + Scanning keep day-to-day tabs current with deltas</li>
      </ul>
      <p className="text-xs text-wt-text-low">
        The baseline can take a few minutes on large packs. Live charts still start from now.
      </p>
    </div>
  );
}

function OptionsStep({
  days,
  onDaysChange,
  onPersist,
  persistError,
  savingLookback,
}: {
  days: number;
  onDaysChange: (days: number) => void;
  onPersist: (days: number) => Promise<boolean>;
  persistError: string | null;
  savingLookback: boolean;
}) {
  const [lookup, setLookup] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(
    () => !LOOKBACK_PRESET_DAYS.includes(days as (typeof LOOKBACK_PRESET_DAYS)[number]),
  );
  const [customDraft, setCustomDraft] = useState(String(days));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = asRecord(await api.settings());
        if (cancelled) return;
        setLookup(bool(data.modrinth_lookup));
        setAutoScan(bool(data.modrinth_auto_scan_on_mod_changes));
        const sel = hoursToLookbackSelection(num(data.lookback_hours, 24));
        onDaysChange(sel.days);
        setCustomMode(sel.kind === 'custom');
        setCustomDraft(String(sel.days));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Sync from settings once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only hydrate
  }, []);

  async function selectDays(next: number, asCustom: boolean) {
    const d = clampLookbackDays(next);
    setCustomMode(asCustom);
    setCustomDraft(String(d));
    onDaysChange(d);
    await onPersist(d);
  }

  async function apply(nextLookup: boolean, nextAuto: boolean) {
    setSaving(true);
    setError(null);
    setLookup(nextLookup);
    const auto = nextLookup ? nextAuto : false;
    setAutoScan(auto);
    try {
      await api.saveSettings({
        modrinthLookup: nextLookup,
        modrinthAutoScanOnModChanges: auto,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Modrinth setting.');
    } finally {
      setSaving(false);
    }
  }

  const presetLabels: Record<number, string> = {
    1: 'Recent (recommended)',
    7: 'This week',
    30: 'This month',
  };

  return (
    <div className="space-y-4 text-sm text-wt-text-mid">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-wt-text">Baseline history</h3>
          <p className="mt-1 text-xs text-wt-text-low">
            Charts and continuous Scanning start from <strong className="text-wt-text-mid">now</strong>.
            This window only shapes the first deep-audit baseline (logs and crashes in range). A longer
            window means a slower first scan on large packs. Older files can stay on disk — WatchTower
            does not import your whole server lifetime.
          </p>
        </div>
        <div className="space-y-2" role="radiogroup" aria-label="Baseline history window">
          {LOOKBACK_PRESET_DAYS.map((preset) => (
            <label key={preset} className="flex items-start gap-3 wt-form-row p-3">
              <input
                type="radio"
                className="mt-1"
                name="baseline-lookback"
                checked={!customMode && days === preset}
                disabled={savingLookback}
                onChange={() => void selectDays(preset, false)}
              />
              <span>
                <strong className="text-wt-text">{presetLabels[preset]}</strong>
                <span className="mt-0.5 block text-xs text-wt-text-low">{preset} day{preset === 1 ? '' : 's'}</span>
              </span>
            </label>
          ))}
          <label className="flex items-start gap-3 wt-form-row p-3">
            <input
              type="radio"
              className="mt-1"
              name="baseline-lookback"
              checked={customMode}
              disabled={savingLookback}
              onChange={() => void selectDays(clampLookbackDays(Number(customDraft) || days), true)}
            />
            <span className="min-w-0 flex-1">
              <strong className="text-wt-text">Custom</strong>
              <span className="mt-1 flex items-center gap-2 text-xs text-wt-text-low">
                <input
                  type="number"
                  min={1}
                  max={30}
                  className="w-20 rounded border border-wt-line bg-wt-bg2 px-2 py-1 font-mono text-sm text-wt-text"
                  value={customDraft}
                  disabled={savingLookback}
                  onFocus={() => setCustomMode(true)}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onBlur={() => {
                    const d = clampLookbackDays(Number(customDraft));
                    setCustomDraft(String(d));
                    void selectDays(d, true);
                  }}
                />
                days (1–30)
              </span>
            </span>
          </label>
        </div>
        {persistError ? <p className="text-wt-danger">{persistError}</p> : null}
      </div>

      <div className="space-y-3 border-t border-wt-line pt-4">
        <p>
          Optional network lookups help identify mods on Modrinth during and after Initial discovery.
          Leave off if this host should never call out.
        </p>
        <label className="flex items-start gap-3 wt-form-row p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={lookup}
            disabled={saving}
            onChange={(e) => void apply(e.target.checked, autoScan)}
          />
          <span>
            <strong className="text-wt-text">Enable Modrinth lookup</strong>
            <span className="mt-0.5 block text-xs text-wt-text-low">
              Sends jar SHA-512 hashes to api.modrinth.com (no world, logs, or player data).
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 wt-form-row p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={autoScan}
            disabled={saving || !lookup}
            onChange={(e) => void apply(lookup, e.target.checked)}
          />
          <span>
            <strong className="text-wt-text">Auto-scan when mods change</strong>
            <span className="mt-0.5 block text-xs text-wt-text-low">
              After discovery, re-check Modrinth when jars are added or updated.
            </span>
          </span>
        </label>
        {error ? <p className="text-wt-danger">{error}</p> : null}
        <p className="text-xs text-wt-text-low">You can change Modrinth later in Settings → Monitoring.</p>
      </div>
    </div>
  );
}

function formatElapsed(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

type DiscoveryCounts = {
  logs: number | null;
  crashes: number | null;
  jars: number | null;
  active_issues: number | null;
};

type CountTile = { key: keyof DiscoveryCounts; label: string; value: number | null };

/** Prefer a finite number from the API; null means unknown / not reported yet. */
function countOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Math.max(0, Math.trunc(Number(v)));
  }
  return null;
}

function DiscoveryCountTiles({
  counts,
  pulse,
}: {
  counts: DiscoveryCounts;
  pulse?: boolean;
}) {
  const tiles: CountTile[] = [
    { key: 'logs', label: 'Logs', value: counts.logs },
    { key: 'crashes', label: 'Crashes', value: counts.crashes },
    { key: 'jars', label: 'Mods', value: counts.jars },
    { key: 'active_issues', label: 'Issues', value: counts.active_issues },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.key}
          className={`wt-form-row px-3 py-2 text-center ${
            pulse && t.value != null && t.value > 0 ? 'ring-1 ring-wt-accent/25' : ''
          }`}
        >
          <div className="font-mono text-lg font-semibold tabular-nums text-wt-text">
            {t.value == null ? '—' : t.value}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-wt-text-low">
            {t.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgressTrack({
  done,
  total,
  label,
  meta,
}: {
  done: number;
  total: number;
  label?: string | null;
  meta?: string | null;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      {label ? <p className="text-xs font-medium text-wt-text">{label}</p> : null}
      <div
        className="h-2 overflow-hidden rounded-full bg-wt-bg2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total || 100}
        aria-valuenow={done}
      >
        <div
          className="h-full w-full origin-left rounded-full bg-wt-accent transition-transform duration-300"
          style={{ transform: `scaleX(${(total > 0 ? pct : 12) / 100})` }}
        />
      </div>
      <p className="text-xs text-wt-text-low">
        {total > 0 ? `${done}/${total}` : 'Working…'}
        {meta ? ` · ${meta}` : ''}
      </p>
    </div>
  );
}

function DiscoveryStep({
  onCompleteChange,
  baselineDays,
  persistBaselineDays,
}: {
  onCompleteChange: (ok: boolean) => void;
  baselineDays: number;
  persistBaselineDays: (days: number) => Promise<boolean>;
}) {
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stageId, setStageId] = useState('window');
  const [stageLabel, setStageLabel] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [counts, setCounts] = useState<DiscoveryCounts>({
    logs: null,
    crashes: null,
    jars: null,
    active_issues: null,
  });
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [modrinthWanted, setModrinthWanted] = useState(false);
  const [modrinthPhase, setModrinthPhase] = useState<'idle' | 'running' | 'done' | 'skipped' | 'failed'>(
    'idle',
  );
  const [modrinthDetail, setModrinthDetail] = useState<string | null>(null);
  const [modrinthProgress, setModrinthProgress] = useState({ done: 0, total: 0 });
  const [modrinthLabel, setModrinthLabel] = useState<string | null>(null);
  const alreadyOk = readSetupWizard()?.discovery === 'ok';

  const baselineReady = success === true || (alreadyOk && success !== false);

  // Unlock Next only after discovery ok AND Modrinth finished/skipped (not while idle mid-handoff).
  useEffect(() => {
    const modrinthSettled = modrinthPhase === 'done' || modrinthPhase === 'skipped';
    const ready =
      success !== false &&
      !running &&
      baselineReady &&
      modrinthSettled;
    onCompleteChange(!!ready);
  }, [baselineReady, running, modrinthPhase, success, onCompleteChange]);

  const applyDiscoveryStatus = useCallback((status: Record<string, unknown>) => {
    setStageId(str(status.stage, 'window'));
    setStageLabel(status.stage_label ? str(status.stage_label) : null);
    setDetail(status.stage_detail ? str(status.stage_detail) : null);
    const c = asRecord(status.counts);
    setCounts({
      logs: countOrNull(c.logs),
      crashes: countOrNull(c.crashes),
      jars: countOrNull(c.jars),
      active_issues: countOrNull(c.active_issues),
    });
    const p = asRecord(status.progress);
    setProgress({ done: num(p.done), total: num(p.total) });
    if (status.elapsed_ms != null) setElapsedMs(num(status.elapsed_ms));
  }, []);

  const startModrinthIfNeeded = useCallback(async (): Promise<'done' | 'skipped' | 'failed'> => {
    let wanted = false;
    try {
      const settings = asRecord(await api.settings());
      wanted = bool(settings.modrinth_lookup);
    } catch {
      wanted = false;
    }
    setModrinthWanted(wanted);
    if (!wanted) {
      setModrinthPhase('skipped');
      return 'skipped';
    }

    setModrinthPhase('running');
    setModrinthLabel('Preparing Modrinth scan');
    setModrinthDetail('Hashing jars and looking up Modrinth…');
    try {
      await api.modrinthScanStart();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Modrinth scan failed to start';
      if (/409|already_running|already running/i.test(msg)) {
        /* keep polling */
      } else if (/400|disabled/i.test(msg)) {
        setModrinthPhase('skipped');
        setModrinthDetail('Modrinth lookup is disabled');
        return 'skipped';
      } else {
        setModrinthPhase('failed');
        setModrinthDetail(msg);
        return 'failed';
      }
    }

    for (;;) {
      await new Promise((r) => setTimeout(r, 900));
      try {
        const st = asRecord(await api.modrinthStatus());
        setModrinthLabel(st.stage_label ? str(st.stage_label) : str(st.stage, 'Scanning'));
        setModrinthDetail(st.stage_detail ? str(st.stage_detail) : null);
        const p = asRecord(st.progress);
        setModrinthProgress({ done: num(p.done), total: num(p.total) });
        if (st.running) continue;
        if (st.success === false || st.error) {
          setModrinthPhase('failed');
          setModrinthDetail(str(st.error || st.message, 'Modrinth scan finished with errors'));
          return 'failed';
        }
        setModrinthPhase('done');
        const stats = asRecord(st.stats);
        const matched = num(stats.matched);
        const considered = num(stats.jars_considered);
        setModrinthDetail(
          considered > 0
            ? `Matched ${matched}/${considered} jars on Modrinth`
            : 'Modrinth scan complete',
        );
        return 'done';
      } catch (err) {
        setModrinthPhase('failed');
        setModrinthDetail(err instanceof Error ? err.message : 'Modrinth status failed');
        return 'failed';
      }
    }
  }, []);

  const pollOnce = useCallback(async () => {
    const status = asRecord(await api.discoveryStatus());
    applyDiscoveryStatus(status);
    if (status.running) {
      setRunning(true);
      return { done: false as const };
    }
    setRunning(false);
    const ok = status.success === true;
    setSuccess(ok);
    if (ok) {
      patchSetupWizard({ discovery: 'ok' });
      // Hold Next until Modrinth settles (or is skipped).
      setModrinthPhase('running');
      await startModrinthIfNeeded();
    } else {
      setError(str(status.error || status.message, 'Discovery finished with errors.'));
      patchSetupWizard({ discovery: 'failed' });
      setModrinthPhase('skipped');
    }
    return { done: true as const, ok };
  }, [applyDiscoveryStatus, startModrinthIfNeeded]);

  const start = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setStarting(true);
    setRunning(true);
    setStageId('window');
    setModrinthPhase('idle');
    setModrinthProgress({ done: 0, total: 0 });
    try {
      const ok = await persistBaselineDays(baselineDays);
      if (!ok) {
        setRunning(false);
        setSuccess(false);
        setError('Could not save baseline window. Go back to Options and try again.');
        setStarting(false);
        return;
      }
      await api.discoveryStart();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start discovery';
      if (!/409|already_running|already running/i.test(msg)) {
        setRunning(false);
        setSuccess(false);
        setError(msg);
        setStarting(false);
        return;
      }
    } finally {
      setStarting(false);
    }
  }, [baselineDays, persistBaselineDays]);

  useEffect(() => {
    if (alreadyOk) {
      setSuccess(true);
      void (async () => {
        try {
          const status = asRecord(await api.discoveryStatus());
          applyDiscoveryStatus(status);
        } catch {
          /* counts stay unknown until a re-run */
        }
        try {
          const settings = asRecord(await api.settings());
          if (bool(settings.modrinth_lookup)) {
            setModrinthWanted(true);
            // Don't re-run Modrinth on resume if discovery already ok — mark skipped/done lightly
            setModrinthPhase('done');
            setModrinthDetail('Modrinth lookup was enabled — scan can be re-run from Mods later');
          } else {
            setModrinthPhase('skipped');
          }
        } catch {
          setModrinthPhase('skipped');
        }
      })();
      return undefined;
    }
    let cancelled = false;
    let timer: number | undefined;
    void (async () => {
      await start();
      if (cancelled) return;
      const tick = async () => {
        if (cancelled) return;
        try {
          const result = await pollOnce();
          if (!result.done && !cancelled) {
            timer = window.setTimeout(() => void tick(), 1000);
          }
        } catch (err) {
          if (!cancelled) {
            setRunning(false);
            setSuccess(false);
            setError(err instanceof Error ? err.message : 'Discovery status failed');
          }
        }
      };
      void tick();
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once like prod
  }, []);

  async function handleRetry() {
    patchSetupWizard({ discovery: 'pending' });
    setSuccess(null);
    setModrinthPhase('idle');
    await start();
    const tick = async () => {
      try {
        const result = await pollOnce();
        if (!result.done) window.setTimeout(() => void tick(), 1000);
      } catch (err) {
        setRunning(false);
        setSuccess(false);
        setError(err instanceof Error ? err.message : 'Discovery status failed');
      }
    };
    void tick();
  }

  const activeIdx = DISCOVERY_STAGES.findIndex((s) => s.id === stageId);
  const busy = running || starting || modrinthPhase === 'running';
  const elapsed = formatElapsed(elapsedMs);

  return (
    <div className="space-y-4 text-sm text-wt-text-mid">
      <p>
        Watchtower is running a <strong>full deep audit</strong> to build your first baseline —
        logs, crashes, mods, host metrics, Issues, and a facts file. This can take a few minutes on
        large packs. <strong>Live charts still start from now</strong>.
      </p>
      <p className="text-xs text-wt-text-low">
        Next stays locked until the baseline
        {modrinthWanted || modrinthPhase === 'running' ? ' and Modrinth scan' : ''} finish so Overview
        opens with real data.
      </p>

      <DiscoveryCountTiles counts={counts} pulse={busy} />

      {(running || starting || success != null) && (
        <ol className="space-y-1.5">
          {DISCOVERY_STAGES.map((stage, i) => {
            const done = success === true || i < activeIdx;
            const active = (running || starting) && i === activeIdx;
            return (
              <li
                key={stage.id}
                className={`flex items-center gap-2 rounded-[var(--radius-wt)] px-2 py-1.5 text-xs ${
                  active ? 'bg-wt-accent-soft text-wt-text' : 'text-wt-text-low'
                }`}
              >
                <span className="grid h-5 w-5 place-items-center rounded-full border border-wt-line text-[10px]">
                  {done ? (
                    <Check size={12} />
                  ) : active ? (
                    <RefreshCw size={11} className="animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                {stage.label}
              </li>
            );
          })}
        </ol>
      )}

      {(running || starting) && baselineDays > 1 ? (
        <p className="text-xs text-wt-text-low">Scanning {baselineDays} days of history…</p>
      ) : null}

      {(running || starting) && (
        <div className="space-y-2 wt-form-row p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-wt-text">
              {stageLabel || DISCOVERY_STAGES.find((s) => s.id === stageId)?.label || 'Working…'}
            </span>
            {elapsed ? <span className="tabular-nums text-wt-text-low">Elapsed {elapsed}</span> : null}
          </div>
          <ProgressTrack
            done={progress.done}
            total={progress.total}
            meta={
              stageId === 'collect' && progress.total > 0
                ? 'processing files in this batch'
                : progress.total > 0
                  ? 'stage progress'
                  : null
            }
          />
          {detail ? (
            <p className="text-xs text-wt-text-low" aria-live="polite">
              {detail}
            </p>
          ) : (
            <p className="text-xs text-wt-text-low">
              Large packs can take a while — counts above update as items are found.
            </p>
          )}
        </div>
      )}

      {success === true && modrinthPhase !== 'idle' ? (
        <div className="space-y-2 wt-form-row p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-wt-text">
            {modrinthPhase === 'done' ? (
              <Check size={16} className="text-wt-ok" />
            ) : modrinthPhase === 'running' ? (
              <RefreshCw size={16} className="animate-spin text-wt-accent" />
            ) : null}
            Modrinth lookup
            {modrinthPhase === 'skipped' ? (
              <span className="text-xs font-normal text-wt-text-low">· skipped (lookup off)</span>
            ) : null}
            {modrinthPhase === 'failed' ? (
              <span className="text-xs font-normal text-wt-danger">· failed</span>
            ) : null}
          </div>
          {modrinthPhase === 'running' ? (
            <ProgressTrack
              done={modrinthProgress.done}
              total={modrinthProgress.total}
              label={modrinthLabel}
              meta={modrinthDetail}
            />
          ) : (
            <p className="text-xs text-wt-text-low">{modrinthDetail}</p>
          )}
        </div>
      ) : null}

      {success === true && (modrinthPhase === 'done' || modrinthPhase === 'skipped') ? (
        <div className="space-y-2 wt-form-row p-3">
          <p className="flex items-center gap-2 text-wt-ok">
            <Check size={16} /> Baseline ready
          </p>
          <p className="text-sm text-wt-text-mid">
            Window:{' '}
            <strong className="text-wt-text">
              {baselineDays} day{baselineDays === 1 ? '' : 's'}
            </strong>
            {(() => {
              const parts = [
                counts.logs != null && counts.logs > 0 ? `${counts.logs} logs` : null,
                counts.crashes != null && counts.crashes > 0 ? `${counts.crashes} crashes` : null,
                counts.jars != null && counts.jars > 0 ? `${counts.jars} mods` : null,
                counts.active_issues != null && counts.active_issues > 0
                  ? `${counts.active_issues} issues`
                  : null,
              ].filter(Boolean);
              return parts.length ? (
                <span className="text-xs text-wt-text-low"> · {parts.join(' · ')}</span>
              ) : null;
            })()}
          </p>
          <p className="text-xs text-wt-text-low">
            Older crash files on disk stay available. Day-to-day updates come from Watching + Scanning.
          </p>
        </div>
      ) : null}

      {success === false || modrinthPhase === 'failed' ? (
        <div className="space-y-2">
          {error ? <p className="text-wt-danger">{error}</p> : null}
          {modrinthPhase === 'failed' && modrinthDetail ? (
            <p className="text-wt-danger">{modrinthDetail}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {success === false ? (
              <Button kind="primary" onClick={() => void handleRetry()}>
                Retry deep audit
              </Button>
            ) : null}
            {modrinthPhase === 'failed' ? (
              <Button
                kind="default"
                onClick={() => {
                  void (async () => {
                    setModrinthPhase('running');
                    await startModrinthIfNeeded();
                  })();
                }}
              >
                Retry Modrinth scan
              </Button>
            ) : null}
            {modrinthPhase === 'failed' ? (
              <Button kind="ghost" onClick={() => setModrinthPhase('skipped')}>
                Continue without Modrinth
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BackupsStep({
  onLater,
  onFolderSaved,
  folderSaved,
}: {
  onLater: () => void;
  onFolderSaved: () => void;
  folderSaved: boolean;
}) {
  const [settingsData, setSettingsData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = asRecord(await api.settings());
        if (!cancelled) setSettingsData(data);
      } catch {
        if (!cancelled) setSettingsData({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4 text-sm text-wt-text-mid">
      <p>
        WatchTower does <strong>not</strong> guess where your backups live. Set the folder here, or
        finish later from Settings → Backups.
      </p>

      <div className="wt-form-row p-4">
        <LocalFolderSetup
          settingsData={settingsData}
          compact
          onSaved={(dirs) => {
            onFolderSaved();
            setSettingsData((prev) => ({
              ...(prev ?? {}),
              backup_dirs: dirs.join(', '),
              backup_dir: dirs[0] ?? '',
            }));
          }}
        />
        {folderSaved ? (
          <p className="mt-3 flex items-center gap-2 text-wt-ok">
            <Check size={14} /> Folder saved — you can continue.
          </p>
        ) : null}
      </div>

      <Button kind="ghost" onClick={onLater}>
        I’ll do this later
      </Button>
    </div>
  );
}

function SecurityStep({ session }: { session: Record<string, unknown> | null }) {
  const setSession = useSessionStore((s) => s.setGate);
  const mustChange = !!(session?.must_change_password || session?.mustChangePassword);
  const [totpEnabled, setTotpEnabled] = useState(
    !!(session?.totp_enabled || session?.totpEnabled),
  );
  const [totpStep, setTotpStep] = useState<'idle' | 'qr' | 'codes'>('idle');
  const [qrData, setQrData] = useState<Record<string, unknown> | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = requiresLiveAuth();
  const qrSrc = totpQrSrc(qrData);

  async function startTotp() {
    setError(null);
    setBusy(true);
    try {
      if (!live) {
        // Fixture preview: fake QR + secret so the wizard path is exerciseable.
        setQrData({
          secret: 'WATCHTOWERPREVIEW',
          qr_data_url:
            'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=otpauth://totp/WatchTower:preview',
          preview: true,
        });
        setTotpStep('qr');
        return;
      }
      const res = asRecord(await api.totpSetup());
      setQrData(res);
      setTotpStep('qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start 2FA setup');
    } finally {
      setBusy(false);
    }
  }

  async function confirmTotp() {
    setError(null);
    setBusy(true);
    try {
      if (!live) {
        setRecoveryCodes(['PREVIEW-CODE-1', 'PREVIEW-CODE-2', 'PREVIEW-CODE-3']);
        setTotpStep('codes');
        setTotpEnabled(true);
        return;
      }
      const res = asRecord(await api.totpConfirm(totpCode.trim()));
      setRecoveryCodes(asArray<string>(res.recovery_codes));
      setTotpStep('codes');
      setTotpEnabled(true);
      setSession('none', {
        ...(session ?? {}),
        totp_enabled: true,
        must_change_password: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code — try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm text-wt-text-mid">
      <p>
        Dashboard access uses a signed session cookie. Passwords are stored with bcrypt. Two-factor
        authentication is strongly recommended if this port is reachable beyond localhost.
      </p>
      <ul className="space-y-2">
        <li className="flex items-start gap-2 wt-form-row px-3 py-2">
          <Check size={16} className={mustChange ? 'text-wt-warn' : 'text-wt-ok'} />
          <div>
            <strong className="text-wt-text">Password</strong>
            <p className="text-xs text-wt-text-low">
              {mustChange
                ? 'Change still required — finish the password gate if you see it again'
                : 'Password gate cleared for this account'}
            </p>
          </div>
        </li>
        <li className="flex items-start gap-2 wt-form-row px-3 py-2">
          <Check size={16} className={totpEnabled ? 'text-wt-ok' : 'text-wt-warn'} />
          <div>
            <strong className="text-wt-text">Two-factor authentication</strong>
            <p className="text-xs text-wt-text-low">
              {totpEnabled ? 'Enabled' : 'Not enabled yet — optional below'}
            </p>
          </div>
        </li>
      </ul>

      {totpEnabled && totpStep === 'idle' ? (
        <p className="text-xs text-wt-text-low">You are set — finish setup to open the dashboard.</p>
      ) : null}

      {!totpEnabled && totpStep === 'idle' ? (
        <div className="space-y-2 wt-form-row p-4">
          <p className="text-xs text-wt-text-low">
            Scan a QR code with Google Authenticator, Authy, or similar. You can skip and enable later
            in Settings → Security.
          </p>
          <Button kind="primary" disabled={busy} onClick={() => void startTotp()}>
            {busy ? 'Starting…' : 'Set up 2FA now'}
          </Button>
        </div>
      ) : null}

      {totpStep === 'qr' ? (
        <div className="space-y-3 wt-form-row p-4">
          <p className="text-sm font-medium text-wt-text">Scan this QR code</p>
          {qrSrc ? (
            <img
              className="rounded-[var(--radius-wt)] border border-wt-line bg-white"
              src={qrSrc}
              alt="TOTP QR code"
              width={180}
              height={180}
            />
          ) : null}
          {str(qrData?.secret) ? (
            <p className="text-xs text-wt-text-low">
              Manual key: <code className="rounded bg-wt-bg1 px-1">{str(qrData?.secret)}</code>
            </p>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium text-wt-text">Authenticator code</span>
            <input
              className="mt-1.5 w-full rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 px-3 py-2 font-mono text-sm outline-none focus-visible:border-wt-accent focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wt-accent)_35%,transparent)]"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\s+/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="000000"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              kind="primary"
              disabled={busy || totpCode.length < 6}
              onClick={() => void confirmTotp()}
            >
              {busy ? 'Verifying…' : 'Verify and enable'}
            </Button>
            <Button
              kind="ghost"
              disabled={busy}
              onClick={() => {
                setTotpStep('idle');
                setTotpCode('');
                setQrData(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {totpStep === 'codes' ? (
        <div className="space-y-3 wt-form-row p-4">
          <p className="flex items-center gap-2 text-wt-ok">
            <Check size={16} /> 2FA enabled — save these recovery codes
          </p>
          <ul className="space-y-1 font-mono text-xs">
            {recoveryCodes.map((c) => (
              <li key={c}>
                <code className="rounded bg-wt-bg1 px-1">{c}</code>
              </li>
            ))}
          </ul>
          <p className="text-xs text-wt-text-low">
            They appear only once. Store them somewhere safe, then finish setup.
          </p>
          <Button kind="default" onClick={() => setTotpStep('idle')}>
            Done
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-wt-danger">{error}</p> : null}
    </div>
  );
}

void (['welcome', 'options', 'audit', 'backups', 'security'] as StepId[]);
