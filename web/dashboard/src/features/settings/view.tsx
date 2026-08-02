import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Package,
  Save,
  ScrollText,
  ServerCog,
  Shield,
  SlidersHorizontal,
  Users,
  Wrench,
} from '@/ui/icons';
import { api } from '@/api/client';
import { useCanWrite, useIsOwner, VIEW_ONLY_TITLE } from '@/app/permissions';
import { navigate, type RouteState } from '@/app/router';
import { isFixturePreview } from '@/app/runtime';
import { useSessionStore } from '@/app/session-store';
import { AppearanceControls } from '@/app/appearance-controls';
import '@/app/appearance-controls.css';
import { LocalFolderSetup } from '@/features/backups/local-folder-setup';
import { ExternalTrackingSetup } from '@/features/backups/external-tracking-setup';
import { relaunchSetupWizard } from '@/features/wizard/persist';
import { PageEnter } from '@/ui/motion';
import { Button, ErrorState, Section, StatusPill } from '@/ui/patterns';
import { asRecord, bool, num, str, totpQrSrc } from '@/lib/utils';
import { useDashboardTimezone } from '@/app/timezone';
import { AccountsPanel } from './accounts-panel';
import { AuditLogPanel } from './audit-log-panel';
import { SelfMinecraftLink } from './minecraft-link';
import './settings.css';

const PANELS = [
  { id: 'general', label: 'General', icon: ServerCog },
  { id: 'monitoring', label: 'Monitoring', icon: SlidersHorizontal },
  { id: 'backups', label: 'Backups', icon: Wrench },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'integrations', label: 'Integrations', icon: Package },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'audit', label: 'Audit log', icon: ScrollText },
  { id: 'about', label: 'About', icon: Info },
] as const;

type PanelId = (typeof PANELS)[number]['id'];

const CONF_PANELS: ReadonlySet<PanelId> = new Set(['general', 'monitoring', 'alerts', 'integrations', 'backups']);

/** Snake keys that participate in dirty tracking / Save. */
const EDITABLE_KEYS = [
  'update_check',
  'metrics_context_banner',
  'tps_warn',
  'mspt_warn',
  'ops_poll_sec',
  'ops_log_scan_sec',
  'baseline_auto_capture',
  'baseline_regression_threshold_pct',
  'spark_enabled',
  'spark_auto_capture_on_lag',
  'spark_auto_capture_window_sec',
  'spark_auto_capture_cooldown_sec',
  'modrinth_lookup',
  'modrinth_auto_scan_on_mod_changes',
  'disk_warn_pct',
  'disk_fill_warn_days',
  'disk_io_latency_warn_ms',
  'chunk_write_pressure_enabled',
  'chunk_write_growth_chunks',
  'chunk_write_sustained_scans',
  'backup_stale_hours',
  'report_retention_days',
  'report_retention_count',
] as const;

type FormState = Record<string, unknown>;

function resolvePanel(raw: string | undefined, canWrite: boolean, isOwner: boolean): PanelId {
  if (raw === 'rules') return 'alerts';
  if (raw === 'advanced') return 'integrations';
  if (raw === 'audit' && !canWrite) return 'general';
  if (raw === 'accounts' && !isOwner) return 'general';
  if (PANELS.some((p) => p.id === raw)) return raw as PanelId;
  return 'general';
}

function panelVisible(id: PanelId, canWrite: boolean, isOwner: boolean): boolean {
  if (id === 'audit') return canWrite;
  if (id === 'accounts') return isOwner;
  return true;
}

/** Live POST /api/settings only accepts camelCase write keys. */
function toSettingsWritePayload(form: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: Record<string, string> = {
    update_check: 'updateCheck',
    metrics_context_banner: 'metricsContextBanner',
    tps_warn: 'tpsWarn',
    mspt_warn: 'msptWarn',
    ops_poll_sec: 'opsPollSec',
    ops_log_scan_sec: 'opsLogScanSec',
    modrinth_lookup: 'modrinthLookup',
    modrinth_auto_scan_on_mod_changes: 'modrinthAutoScanOnModChanges',
    spark_enabled: 'sparkEnabled',
    spark_auto_capture_on_lag: 'sparkAutoCaptureOnLag',
    spark_auto_capture_window_sec: 'sparkAutoCaptureWindowSec',
    spark_auto_capture_cooldown_sec: 'sparkAutoCaptureCooldownSec',
    baseline_auto_capture: 'baselineAutoCapture',
    baseline_regression_threshold_pct: 'baselineRegressionThresholdPct',
    disk_warn_pct: 'diskWarnPct',
    disk_fill_warn_days: 'diskFillWarnDays',
    disk_io_latency_warn_ms: 'diskIoLatencyWarnMs',
    chunk_write_pressure_enabled: 'chunkWritePressureEnabled',
    chunk_write_growth_chunks: 'chunkWriteGrowthChunks',
    chunk_write_sustained_scans: 'chunkWriteSustainedScans',
    backup_stale_hours: 'backupStaleHours',
    report_retention_days: 'reportRetentionDays',
    report_retention_count: 'reportRetentionCount',
  };
  for (const [snake, camel] of Object.entries(map)) {
    if (form[snake] !== undefined) out[camel] = form[snake];
    if (form[camel] !== undefined) out[camel] = form[camel];
  }
  return out;
}

function pickEditable(form: FormState): FormState {
  const out: FormState = {};
  for (const k of EDITABLE_KEYS) {
    if (form[k] !== undefined) out[k] = form[k];
  }
  return out;
}

function formsEqual(a: FormState, b: FormState): boolean {
  for (const k of EDITABLE_KEYS) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}

function ToggleField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border border-wt-line bg-wt-bg2/50 px-4 py-3 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-wt-text-low">{hint}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!value);
        }}
        className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition ${
          value ? 'bg-wt-accent' : 'bg-wt-bg3'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function TimezonePreferenceField() {
  const { preference, resolvedZone, setBrowser, setUtc, setIana, availableZones } =
    useDashboardTimezone();
  const mode = preference.mode === 'iana' ? 'iana' : preference.mode;
  const zoneValue = preference.mode === 'iana' ? preference.zone || resolvedZone : resolvedZone;

  return (
    <div className="mt-3 rounded-xl border border-wt-line bg-wt-bg2/50 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">Timezone</div>
          <div className="mt-0.5 text-xs text-wt-text-low">
            Browser-local only — Schedule and restart advice times. Backend data stays UTC. Resolved:{' '}
            <span className="font-medium text-wt-text-mid">{resolvedZone}</span>
          </div>
        </div>
        <Button kind="ghost" onClick={() => setBrowser()}>
          Reset
        </Button>
      </div>

      <div className="mt-3">
        <div className="text-xs text-wt-text-low">Mode</div>
        <div
          className="mt-1.5 inline-flex flex-wrap gap-0.5"
          role="radiogroup"
          aria-label="Timezone mode"
        >
          {(
            [
              { id: 'browser', label: 'Browser default' },
              { id: 'utc', label: 'UTC' },
              { id: 'iana', label: 'Specific timezone' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={mode === opt.id}
              onClick={() => {
                if (opt.id === 'browser') setBrowser();
                else if (opt.id === 'utc') setUtc();
                else setIana(preference.zone || resolvedZone || 'UTC');
              }}
              className={`rounded-[var(--radius-wt-sm)] border px-3 py-1.5 text-sm font-medium transition ${
                mode === opt.id
                  ? 'border-transparent bg-wt-accent text-[var(--wt-accent-ink)]'
                  : 'border-wt-line bg-wt-bg2/70 text-wt-text-mid hover:border-wt-accent/40 hover:bg-wt-bg1 hover:text-wt-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-3 block">
        <span className="text-xs text-wt-text-low">IANA zone</span>
        <span className="relative mt-1.5 block">
          <select
            className="w-full appearance-none rounded-lg border border-wt-line bg-wt-bg1 px-2.5 py-1.5 pr-9 text-sm text-wt-text outline-none focus:border-wt-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={mode !== 'iana'}
            value={zoneValue}
            onChange={(e) => setIana(e.target.value)}
          >
            {availableZones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-wt-text-low"
            aria-hidden
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      </label>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`block rounded-xl border border-wt-line bg-wt-bg2/50 px-4 py-3 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      {hint ? <div className="mb-1.5 mt-0.5 text-xs text-wt-text-low">{hint}</div> : null}
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          disabled={disabled}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 rounded-lg border border-wt-line bg-wt-bg1 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-wt-accent disabled:cursor-not-allowed"
        />
        {unit ? <span className="text-xs text-wt-text-low">{unit}</span> : null}
      </div>
    </label>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password';
  autoComplete?: string;
}) {
  return (
    <label className="block rounded-xl border border-wt-line bg-wt-bg2/50 px-4 py-3">
      <div className="text-sm font-medium">{label}</div>
      {hint ? <div className="mb-1.5 mt-0.5 text-xs text-wt-text-low">{hint}</div> : null}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-wt-line bg-wt-bg1 px-2.5 py-1.5 text-sm outline-none focus:border-wt-accent"
      />
    </label>
  );
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-wt-line bg-wt-bg2/40 px-4 py-3">
      <div className="text-sm font-medium">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-wt-text-low">{hint}</div> : null}
      <div className="mt-1.5 font-mono text-sm text-wt-text">{value || '—'}</div>
    </div>
  );
}

export function PageView({ route }: { route: RouteState }) {
  const canWrite = useCanWrite();
  const isOwner = useIsOwner();
  const panel = resolvePanel(route.panel, canWrite, isOwner);
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [form, setForm] = useState<FormState>({});
  const [baseline, setBaseline] = useState<FormState>({});
  const [saveAck, setSaveAck] = useState(false);

  useEffect(() => {
    if (!settingsQ.data) return;
    const next = asRecord(settingsQ.data);
    setForm(next);
    setBaseline(pickEditable(next));
    setSaveAck(false);
  }, [settingsQ.data]);

  const dirty = useMemo(() => !formsEqual(pickEditable(form), baseline), [form, baseline]);

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => api.saveSettings(toSettingsWritePayload(payload)),
    onSuccess: async (res) => {
      const body = asRecord(res);
      const settings = asRecord(body.settings);
      if (Object.keys(settings).length) {
        setForm(settings);
        setBaseline(pickEditable(settings));
      } else {
        const refreshed = await settingsQ.refetch();
        if (refreshed.data) {
          const next = asRecord(refreshed.data);
          setForm(next);
          setBaseline(pickEditable(next));
        }
      }
      setSaveAck(true);
    },
  });

  const set = (key: string, value: unknown) => {
    setSaveAck(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const sparkLoaded = bool(form.spark_mod_loaded);
  const sparkEnabled = bool(form.spark_enabled);
  const modrinthOn = bool(form.modrinth_lookup);
  const showSave = CONF_PANELS.has(panel) && canWrite;

  if (settingsQ.isLoading) {
    return (
      <PageEnter className="grid gap-4">
        <div className="h-10 w-96 animate-pulse rounded-xl bg-wt-bg2" />
        <div className="h-96 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </PageEnter>
    );
  }
  if (settingsQ.isError) {
    return <ErrorState title="Couldn't load settings">{(settingsQ.error as Error)?.message}</ErrorState>;
  }

  return (
    <PageEnter className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1">
          {PANELS.filter((p) => panelVisible(p.id, canWrite, isOwner)).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ tab: 'settings', panel: p.id })}
              className={`inline-flex items-center gap-1.5 rounded-[var(--radius-wt-sm)] border px-3 py-1.5 text-sm font-medium transition ${
                panel === p.id
                  ? 'border-transparent bg-wt-accent text-[var(--wt-accent-ink)]'
                  : 'border-wt-line bg-wt-bg2/70 text-wt-text-mid hover:border-wt-accent/40 hover:bg-wt-bg1 hover:text-wt-text'
              }`}
            >
              <p.icon size={13} />
              {p.label}
            </button>
          ))}
        </div>
        {showSave ? (
          <div className="flex items-center gap-2">
            {saveMutation.isError ? (
              <StatusPill tone="danger">
                {(saveMutation.error as Error)?.message || 'Save failed'}
              </StatusPill>
            ) : null}
            {saveAck && !dirty ? (
              <StatusPill tone="ok">
                <CheckCircle2 size={12} className="mr-1 inline" /> Saved
              </StatusPill>
            ) : null}
            <Button
              kind="primary"
              disabled={!canWrite || saveMutation.isPending || !dirty}
              title={canWrite ? undefined : VIEW_ONLY_TITLE}
              onClick={() => saveMutation.mutate(form)}
            >
              <Save size={14} className="mr-1.5" /> Save changes
            </Button>
          </div>
        ) : null}
      </div>

      {panel === 'general' ? (
        <div className="space-y-6">
          <Section title="Server identity" hint="Detected for this install — not edited here.">
            <div className="grid gap-3 md:grid-cols-2">
              <ReadOnlyField
                label="Hostname"
                value={str(form.hostname)}
                hint="Resolved from the server environment"
              />
              <ReadOnlyField
                label="Hosting panel"
                value={str(form.panel_display_name) || str(form.panel, 'none')}
                hint="Auto-detected panel / host type"
              />
              <ReadOnlyField
                label="Dashboard port"
                value={String(num(form.dashboard_port) || '—')}
                hint="Change in NeoForge mod config (watchtower-common.toml), then restart"
              />
            </div>
          </Section>
          <Section
            title="Appearance"
            hint="Theme and accent sync to your signed-in account. Status colours (ok / warn / danger) stay the same."
          >
            <AppearanceControls idPrefix="settings-appearance" />
          </Section>
          <Section title="Dashboard preferences" hint="Applies after Save — next page load for banners. Timezone applies immediately in this browser.">
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField
                label="Check for updates"
                hint="Show when a newer Watchtower release is available"
                value={bool(form.update_check)}
                onChange={(v) => set('update_check', v)}
              />
              <ToggleField
                label="Metrics context banner"
                hint="Show the short explainer above Live / chart pages"
                value={bool(form.metrics_context_banner)}
                onChange={(v) => set('metrics_context_banner', v)}
              />
            </div>
            <TimezonePreferenceField />
          </Section>
        </div>
      ) : null}

      {panel === 'monitoring' ? (
        <div className="space-y-6">
          <Section title="Lag thresholds" hint="When TPS or MSPT crosses these, Issues and Overview treat the window as unhealthy.">
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField
                label="TPS warning"
                hint="Warn when ticks per second stay below this (typical 19.5)"
                value={num(form.tps_warn)}
                onChange={(v) => set('tps_warn', v)}
              />
              <NumberField
                label="MSPT warning"
                unit="ms"
                hint="Warn when milliseconds-per-tick stay above this (typical 50)"
                value={num(form.mspt_warn)}
                onChange={(v) => set('mspt_warn', v)}
              />
            </div>
          </Section>
          <Section title="Performance baseline" hint="Freeze a known-good week and get nudged when the last 7 days are clearly slower.">
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField
                label="Auto-capture baseline when healthy"
                hint="Once, when the server looks healthy — only Set new baseline on Insights refreshes it"
                value={bool(form.baseline_auto_capture)}
                onChange={(v) => set('baseline_auto_capture', v)}
              />
              <NumberField
                label="Regression threshold"
                unit="%"
                hint="Flag when the last 7 days are this much worse than the baseline (typical 10)"
                value={num(form.baseline_regression_threshold_pct)}
                onChange={(v) => set('baseline_regression_threshold_pct', v)}
              />
            </div>
          </Section>
          <Section
            title="Spark on lag"
            hint="Optional: on critical sustained lag, run a short Spark profile and attach it to the lag Issue. Profiles stay on disk."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-wt-line bg-wt-bg2/40 px-4 py-3">
                <div className="text-sm font-medium">Spark mod</div>
                <div className="mt-1.5">
                  <StatusPill tone={sparkLoaded ? 'ok' : 'warn'}>
                    {sparkLoaded ? 'Installed' : 'Not installed'}
                  </StatusPill>
                </div>
                <p className="mt-1.5 text-xs text-wt-text-low">
                  Detected from the running server — install Spark to enable auto-capture
                </p>
              </div>
              <ToggleField
                label="Spark enabled"
                hint="Allow Watchtower to use Spark (profiles, auto-capture). Also under Integrations."
                value={sparkEnabled}
                onChange={(v) => set('spark_enabled', v)}
              />
              <ToggleField
                label="Auto-capture Spark on critical lag"
                hint={
                  !sparkLoaded
                    ? 'Install Spark on this server to enable'
                    : !sparkEnabled
                      ? 'Turn on Spark enabled first'
                      : 'Critical lag only (not small blips). Leave off while profiling by hand.'
                }
                value={bool(form.spark_auto_capture_on_lag)}
                onChange={(v) => set('spark_auto_capture_on_lag', v)}
                disabled={!sparkLoaded || !sparkEnabled}
              />
              <NumberField
                label="Capture window"
                unit="sec"
                hint="How long each auto-capture runs (about 45s typical)"
                value={num(form.spark_auto_capture_window_sec)}
                onChange={(v) => set('spark_auto_capture_window_sec', v)}
                disabled={!sparkLoaded || !sparkEnabled}
              />
              <NumberField
                label="Cooldown"
                unit="sec"
                hint="Minimum wait between auto-captures (900 ≈ 15 minutes)"
                value={num(form.spark_auto_capture_cooldown_sec)}
                onChange={(v) => set('spark_auto_capture_cooldown_sec', v)}
                disabled={!sparkLoaded || !sparkEnabled}
              />
            </div>
          </Section>
          <Section title="Scan cadence" hint="How often background Watching / Scanning wakes up. Applies on the next poll cycle.">
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField
                label="Ops poll interval"
                unit="sec"
                hint="How often ops scans jars, crashes, backups, and Issues (typical 60)"
                value={num(form.ops_poll_sec)}
                onChange={(v) => set('ops_poll_sec', v)}
              />
              <NumberField
                label="Log scan interval"
                unit="sec"
                hint="How often latest.log is tailed for activity and peeks (typical 60)"
                value={num(form.ops_log_scan_sec)}
                onChange={(v) => set('ops_log_scan_sec', v)}
              />
              <ReadOnlyField
                label="Live sample interval"
                value={`${num(form.live_sample_interval_seconds) || 1} sec`}
                hint="NeoForge mod config (liveSampleIntervalSeconds) — restart after changing"
              />
            </div>
          </Section>
        </div>
      ) : null}

      {panel === 'backups' ? (
        <Section
          title="Backups"
          hint="Local folders are supported. Panel / cloud tracking is alpha and may not work on every host — folder blocks have their own Save; freshness uses Save changes above."
        >
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField
                label="Stale after"
                unit="hours"
                hint="Backups older than this count as Stale on the Backups page and raise a BACKUP_STALE Issue (default 24)"
                value={num(form.backup_stale_hours) || 24}
                onChange={(v) => set('backup_stale_hours', Math.max(1, Math.min(720, v)))}
              />
            </div>
            <LocalFolderSetup
              settingsData={form}
              onSaved={(dirs) => {
                setForm((f) => ({
                  ...f,
                  backup_dirs: dirs.join(', '),
                  backup_dir: dirs[0] ?? '',
                }));
                void settingsQ.refetch();
              }}
            />
            <div className="border-t border-wt-line pt-6">
              <ExternalTrackingSetup
                settingsData={form}
                onSaved={(patch) => {
                  if (patch && Object.keys(patch).length) {
                    setForm((f) => ({ ...f, ...patch }));
                  }
                  void settingsQ.refetch();
                }}
              />
            </div>
          </div>
        </Section>
      ) : null}

      {panel === 'alerts' ? (
        <div className="space-y-6">
          <Section title="Disk alerts" hint="When disk use, runway, or write latency looks bad, Issues and Overview warn you.">
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField
                label="Disk warning"
                unit="%"
                hint="Warn when disk used percent is at or above this (typical 85)"
                value={num(form.disk_warn_pct)}
                onChange={(v) => set('disk_warn_pct', v)}
              />
              <NumberField
                label="Disk fill warning"
                unit="days"
                hint="Raise an Issue when estimated days-until-full is at or below this"
                value={num(form.disk_fill_warn_days)}
                onChange={(v) => set('disk_fill_warn_days', v)}
              />
              <NumberField
                label="Disk write latency warning"
                unit="ms"
                hint="Warn when disk write await stays above this (typical 50). Also used for pregen / chunk-save pressure."
                value={num(form.disk_io_latency_warn_ms)}
                onChange={(v) => set('disk_io_latency_warn_ms', v)}
              />
            </div>
          </Section>
          <Section
            title="Chunk write / pregen"
            hint="When write latency stays high or chunks grow too fast during pregen, Insights → World and Issues warn you. WatchTower cannot read JVM save-queue depth — latency is the signal."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField
                label="Chunk write pressure"
                hint="Classify save backlog, pregen outrunning disk, and heavy chunk growth"
                value={bool(form.chunk_write_pressure_enabled, true)}
                onChange={(v) => set('chunk_write_pressure_enabled', v)}
              />
              <NumberField
                label="Heavy growth threshold"
                unit="chunks"
                hint="Warn when loaded chunks jump by this many between scans while players are online (typical 48)"
                value={num(form.chunk_write_growth_chunks, 48)}
                onChange={(v) => set('chunk_write_growth_chunks', v)}
              />
              <NumberField
                label="Sustained scans"
                hint="How many ops scans in a row before raising an Issue (typical 3)"
                value={num(form.chunk_write_sustained_scans, 3)}
                onChange={(v) => set('chunk_write_sustained_scans', v)}
              />
            </div>
          </Section>
          <Section
            title="Report retention"
            hint="Old facts/brief files are pruned using both limits — whichever is tighter wins."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField
                label="Keep reports for"
                unit="days"
                hint="Delete report artifacts older than this many days"
                value={num(form.report_retention_days)}
                onChange={(v) => set('report_retention_days', v)}
              />
              <NumberField
                label="Keep at most"
                hint="Maximum number of report artifacts to keep"
                value={num(form.report_retention_count)}
                onChange={(v) => set('report_retention_count', v)}
              />
            </div>
          </Section>
        </div>
      ) : null}

      {panel === 'security' ? (
        <Section title="Security" hint="Everyone manages their own password and 2FA here. Changes save immediately — no global Save.">
          <SecurityPanel />
        </Section>
      ) : null}

      {panel === 'integrations' ? (
        <div className="space-y-6">
          <Section
            title="Modrinth"
            hint="Optional jar identity and update checks. Watchtower never downloads jars — scans only send SHA-512 hashes."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField
                label="Modrinth lookups"
                hint="Allow dedicated Modrinth scans from Mods → Modrinth"
                value={modrinthOn}
                onChange={(v) => {
                  set('modrinth_lookup', v);
                  if (!v) set('modrinth_auto_scan_on_mod_changes', false);
                }}
              />
              <ToggleField
                label="Auto-scan when mods change"
                hint={
                  modrinthOn
                    ? 'Start a Modrinth scan when jars are added, removed, or updated'
                    : 'Turn on Modrinth lookups first'
                }
                value={bool(form.modrinth_auto_scan_on_mod_changes)}
                onChange={(v) => set('modrinth_auto_scan_on_mod_changes', v)}
                disabled={!modrinthOn}
              />
            </div>
          </Section>
          <Section title="Spark" hint="Profiler integration. Auto-capture timing lives under Monitoring → Spark on lag.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-wt-line bg-wt-bg2/40 px-4 py-3">
                <div className="text-sm font-medium">Spark mod</div>
                <div className="mt-1.5">
                  <StatusPill tone={sparkLoaded ? 'ok' : 'warn'}>
                    {sparkLoaded ? 'Installed' : 'Not installed'}
                  </StatusPill>
                </div>
              </div>
              <ToggleField
                label="Spark enabled"
                hint="Allow Watchtower to list profiles, import links, and auto-capture"
                value={sparkEnabled}
                onChange={(v) => set('spark_enabled', v)}
              />
            </div>
          </Section>
        </div>
      ) : null}

      {panel === 'accounts' ? <AccountsPanel /> : null}

      {panel === 'audit' ? <AuditLogPanel /> : null}

      {panel === 'about' ? (
        <Section title="About this install" hint="Quick facts for this Watchtower dashboard.">
          <div className="rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 divide-y divide-wt-line">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">
                Hosting panel
              </div>
              <div className="text-sm text-right">{str(form.panel_display_name) || str(form.panel, 'none')}</div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Hostname</div>
              <div className="text-sm text-right">{str(form.hostname) || '—'}</div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">
                Dashboard port
              </div>
              <div className="text-sm text-right">{num(form.dashboard_port) || '—'}</div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Spark</div>
              <StatusPill tone={sparkLoaded ? 'ok' : 'neutral'}>
                {sparkLoaded ? 'Mod loaded' : 'Mod not loaded'}
              </StatusPill>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-wt-text-mid">
                {isFixturePreview()
                  ? 'Fixture preview mode — saves stay in the browser session until you reload fixtures.'
                  : 'Need to walk through first-run setup again? Relaunch the wizard below.'}
              </p>
              <Button
                kind="primary"
                className="mt-4"
                onClick={() => {
                  relaunchSetupWizard();
                  navigate({ tab: 'overview', setup: '1' });
                  window.location.reload();
                }}
              >
                Relaunch setup wizard
              </Button>
            </div>
          </div>
        </Section>
      ) : null}
    </PageEnter>
  );
}

function SecurityPanel() {
  const live = !isFixturePreview();
  const session = useSessionStore((s) => s.session);
  const totpEnabled = !!(session?.totp_enabled || session?.totpEnabled);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [unMsg, setUnMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [totpStep, setTotpStep] = useState<'idle' | 'qr' | 'codes'>('idle');
  const [qrData, setQrData] = useState<Record<string, unknown> | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [totpError, setTotpError] = useState('');
  const [disablePw, setDisablePw] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [localTotpOn, setLocalTotpOn] = useState(totpEnabled);
  const qrSrc = totpQrSrc(qrData);

  useEffect(() => {
    setLocalTotpOn(totpEnabled);
  }, [totpEnabled]);

  if (!live) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 p-4">
        <Shield size={18} className="mt-0.5 shrink-0 text-wt-info" />
        <p className="text-sm text-wt-text-mid">
          Security settings require a live Watchtower server. Use{' '}
          <code className="rounded bg-wt-bg2 px-1">npm run preview:live</code> with{' '}
          <code className="rounded bg-wt-bg2 px-1">WATCHTOWER_ORIGIN</code>, or open the dashboard
          embedded from the mod.
        </p>
      </div>
    );
  }

  async function handleChangePw() {
    setSaving(true);
    setPwMsg(null);
    try {
      await api.changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setPwMsg({ ok: true, text: 'Password updated.' });
    } catch (err) {
      setPwMsg({ text: err instanceof Error ? err.message : 'Password change failed' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeUsername() {
    setSaving(true);
    setUnMsg(null);
    try {
      await api.changeUsername(newUsername);
      setUnMsg({ ok: true, text: 'Username updated.' });
    } catch (err) {
      setUnMsg({ text: err instanceof Error ? err.message : 'Username change failed' });
    } finally {
      setSaving(false);
    }
  }

  async function startTotp() {
    setTotpError('');
    setSaving(true);
    try {
      const res = await api.totpSetup();
      setQrData(res);
      setTotpStep('qr');
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSaving(false);
    }
  }

  async function confirmTotp() {
    setTotpError('');
    setSaving(true);
    try {
      const res = await api.totpConfirm(totpCode);
      setRecoveryCodes(asArray<string>(res.recovery_codes));
      setTotpStep('codes');
      setLocalTotpOn(true);
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setSaving(false);
    }
  }

  async function disableTotp() {
    setTotpError('');
    setSaving(true);
    try {
      await api.totpDisable(disablePw, disableCode);
      setDisablePw('');
      setDisableCode('');
      setTotpStep('idle');
      setLocalTotpOn(false);
      setPwMsg({ ok: true, text: 'Two-factor authentication disabled.' });
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : 'Disable failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="space-y-3 rounded-xl border border-wt-line bg-wt-bg2/40 p-4">
        <h3 className="text-sm font-semibold">Change password</h3>
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPw}
          onChange={setCurrentPw}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPw}
          onChange={setNewPw}
        />
        {pwMsg ? (
          <p className={`text-sm ${pwMsg.ok ? 'text-wt-ok' : 'text-wt-danger'}`}>{pwMsg.text}</p>
        ) : null}
        <Button
          kind="primary"
          disabled={saving || !currentPw || !newPw}
          onClick={() => void handleChangePw()}
        >
          Update password
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-wt-line bg-wt-bg2/40 p-4">
        <h3 className="text-sm font-semibold">Change username</h3>
        <TextField label="New username" value={newUsername} onChange={setNewUsername} />
        {unMsg ? (
          <p className={`text-sm ${unMsg.ok ? 'text-wt-ok' : 'text-wt-danger'}`}>{unMsg.text}</p>
        ) : null}
        <Button
          kind="default"
          disabled={saving || !newUsername.trim()}
          onClick={() => void handleChangeUsername()}
        >
          Update username
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-wt-line bg-wt-bg2/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Two-factor authentication</h3>
          <StatusPill tone={localTotpOn ? 'ok' : 'neutral'}>
            {localTotpOn ? 'Enabled' : 'Off'}
          </StatusPill>
        </div>
        {totpStep === 'idle' ? (
          <>
            {!localTotpOn ? (
              <Button kind="default" disabled={saving} onClick={() => void startTotp()}>
                Set up two-factor authentication
              </Button>
            ) : (
              <p className="text-sm text-wt-text-mid">
                2FA is on. Use an authenticator app when signing in.
              </p>
            )}
            {localTotpOn ? (
              <div className="grid gap-2 border-t border-wt-line pt-3">
                <p className="text-xs text-wt-text-low">Disable 2FA (requires password + code)</p>
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={disablePw}
                  onChange={setDisablePw}
                />
                <TextField
                  label="Authenticator or recovery code"
                  value={disableCode}
                  onChange={setDisableCode}
                />
                <Button
                  kind="ghost"
                  disabled={saving || !disablePw || !disableCode}
                  onClick={() => void disableTotp()}
                >
                  Disable 2FA
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
        {totpStep === 'qr' ? (
          <div className="space-y-3">
            {qrSrc ? (
              <img
                className="rounded-lg border border-wt-line"
                src={qrSrc}
                alt="TOTP QR code"
                width={180}
                height={180}
              />
            ) : null}
            {str(qrData?.secret) ? (
              <p className="text-xs text-wt-text-low">
                Manual key: <code>{str(qrData?.secret)}</code>
              </p>
            ) : null}
            <TextField label="Authenticator code" value={totpCode} onChange={setTotpCode} />
            <Button
              kind="primary"
              disabled={saving || totpCode.length < 6}
              onClick={() => void confirmTotp()}
            >
              Verify and enable
            </Button>
          </div>
        ) : null}
        {totpStep === 'codes' ? (
          <div className="space-y-3">
            <p className="text-sm text-wt-text-mid">2FA enabled. Save these recovery codes:</p>
            <ul className="space-y-1 font-mono text-xs">
              {recoveryCodes.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
            <Button kind="primary" onClick={() => setTotpStep('idle')}>
              Done
            </Button>
          </div>
        ) : null}
        {totpError ? <p className="text-sm text-wt-danger">{totpError}</p> : null}
      </div>

      <div className="border-t border-wt-line pt-4">
        <SelfMinecraftLink />
      </div>
    </div>
  );
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
