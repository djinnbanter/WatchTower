import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Info,
  Lock,
  Save,
  ServerCog,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from '@/ui/icons';
import { api } from '@/api/client';
import { navigate, type RouteState } from '@/app/router';
import { isFixturePreview } from '@/app/runtime';
import { LocalFolderSetup } from '@/features/backups/local-folder-setup';
import { ExternalTrackingSetup } from '@/features/backups/external-tracking-setup';
import { relaunchSetupWizard } from '@/features/wizard/persist';
import { PageEnter, SpotlightCard, Stagger } from '@/ui/motion';
import { Button, ErrorState, Section, StatusPill } from '@/ui/patterns';
import { asRecord, bool, num, str, totpQrSrc } from '@/lib/utils';

const PANELS = [
  { id: 'general', label: 'General', icon: ServerCog },
  { id: 'monitoring', label: 'Monitoring', icon: SlidersHorizontal },
  { id: 'backups', label: 'Backups', icon: Wrench },
  { id: 'rules', label: 'Rules', icon: Info },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'advanced', label: 'Advanced', icon: Sparkles },
  { id: 'about', label: 'About', icon: Lock },
] as const;

type FormState = Record<string, unknown>;

/** Live POST /api/settings only accepts camelCase write keys. */
function toSettingsWritePayload(form: FormState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: Record<string, string> = {
    lookback_hours: 'lookbackHours',
    incremental: 'incremental',
    tps_warn: 'tpsWarn',
    mspt_warn: 'msptWarn',
    modrinth_lookup: 'modrinthLookup',
    modrinth_auto_scan_on_mod_changes: 'modrinthAutoScanOnModChanges',
    spark_auto_capture_on_lag: 'sparkAutoCaptureOnLag',
    baseline_auto_capture: 'baselineAutoCapture',
    baseline_regression_threshold_pct: 'baselineRegressionThresholdPct',
  };
  for (const [snake, camel] of Object.entries(map)) {
    if (form[snake] !== undefined) out[camel] = form[snake];
    if (form[camel] !== undefined) out[camel] = form[camel];
  }
  return out;
}

function ToggleField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-wt-line bg-wt-bg2/50 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="text-xs text-wt-text-low">{hint}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition ${value ? 'bg-wt-accent' : 'bg-wt-bg3'}`}
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

function NumberField({
  label,
  hint,
  value,
  unit,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-wt-line bg-wt-bg2/50 px-4 py-3">
      <div className="text-sm font-medium">{label}</div>
      {hint ? <div className="mb-1.5 text-xs text-wt-text-low">{hint}</div> : null}
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 rounded-lg border border-wt-line bg-wt-bg1 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-wt-accent"
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
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded-xl border border-wt-line bg-wt-bg2/50 px-4 py-3">
      <div className="text-sm font-medium">{label}</div>
      {hint ? <div className="mb-1.5 text-xs text-wt-text-low">{hint}</div> : null}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-wt-line bg-wt-bg1 px-2.5 py-1.5 text-sm outline-none focus:border-wt-accent"
      />
    </label>
  );
}

export function PageView({ route }: { route: RouteState }) {
  const panel = (route.panel as (typeof PANELS)[number]['id']) || 'general';
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const [form, setForm] = useState<FormState>({});

  useEffect(() => {
    if (settingsQ.data) setForm(asRecord(settingsQ.data));
  }, [settingsQ.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: FormState) => api.saveSettings(toSettingsWritePayload(payload)),
  });

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

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
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-wt-line bg-wt-bg2/60 p-1">
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ tab: 'settings', panel: p.id })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                panel === p.id ? 'bg-wt-accent text-white shadow' : 'text-wt-text-mid hover:bg-wt-bg3 hover:text-wt-text'
              }`}
            >
              <p.icon size={13} />
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {saveMutation.isSuccess ? (
            <StatusPill tone="ok">
              <CheckCircle2 size={12} className="mr-1 inline" /> Saved
            </StatusPill>
          ) : null}
          <Button kind="primary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
            <Save size={14} className="mr-1.5" /> Save changes
          </Button>
        </div>
      </div>

      {panel === 'general' ? (
        <Section title="General" hint="Identity and reporting basics.">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Hostname" value={str(form.hostname)} onChange={(v) => set('hostname', v)} />
            <NumberField label="Dashboard port" value={num(form.dashboard_port)} onChange={(v) => set('dashboard_port', v)} />
            <NumberField label="Lookback window" unit="hours" value={num(form.lookback_hours)} onChange={(v) => set('lookback_hours', v)} />
            <ToggleField label="Incremental reports" hint="Only recompute what changed since last run" value={bool(form.incremental)} onChange={(v) => set('incremental', v)} />
            <ToggleField label="Check for updates" value={bool(form.update_check)} onChange={(v) => set('update_check', v)} />
            <ToggleField label="Metrics context banner" hint="Show the explainer banner above charts" value={bool(form.metrics_context_banner)} onChange={(v) => set('metrics_context_banner', v)} />
          </div>
        </Section>
      ) : null}

      {panel === 'monitoring' ? (
        <Section title="Monitoring thresholds" hint="Values that drive warnings across the dashboard.">
          <div className="grid gap-3 md:grid-cols-2">
            <NumberField label="TPS warning threshold" value={num(form.tps_warn)} onChange={(v) => set('tps_warn', v)} />
            <NumberField label="MSPT warning threshold" unit="ms" value={num(form.mspt_warn)} onChange={(v) => set('mspt_warn', v)} />
            <NumberField label="Live sample interval" unit="sec" value={num(form.live_sample_interval_seconds)} onChange={(v) => set('live_sample_interval_seconds', v)} />
            <NumberField label="Ops poll interval" unit="sec" value={num(form.ops_poll_sec)} onChange={(v) => set('ops_poll_sec', v)} />
            <NumberField label="Log scan interval" unit="sec" value={num(form.ops_log_scan_sec)} onChange={(v) => set('ops_log_scan_sec', v)} />
            <NumberField label="Baseline regression threshold" unit="%" value={num(form.baseline_regression_threshold_pct)} onChange={(v) => set('baseline_regression_threshold_pct', v)} />
            <ToggleField label="Auto-capture baseline" value={bool(form.baseline_auto_capture)} onChange={(v) => set('baseline_auto_capture', v)} />
          </div>
        </Section>
      ) : null}

      {panel === 'backups' ? (
        <Section title="Backups" hint="Folder paths use /api/backups/dirs; tracking uses /api/backups/external.">
          <div className="space-y-6">
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

      {panel === 'rules' ? (
        <Section title="Rules & retention" hint="Disk and report-retention guardrails.">
          <div className="grid gap-3 md:grid-cols-2">
            <NumberField label="Disk warning threshold" unit="%" value={num(form.disk_warn_pct)} onChange={(v) => set('disk_warn_pct', v)} />
            <NumberField label="Disk fill warning" unit="days" value={num(form.disk_fill_warn_days)} onChange={(v) => set('disk_fill_warn_days', v)} />
            <NumberField label="Disk I/O latency warning" unit="ms" value={num(form.disk_io_latency_warn_ms)} onChange={(v) => set('disk_io_latency_warn_ms', v)} />
            <NumberField label="Report retention" unit="days" value={num(form.report_retention_days)} onChange={(v) => set('report_retention_days', v)} />
            <NumberField label="Report retention count" value={num(form.report_retention_count)} onChange={(v) => set('report_retention_count', v)} />
          </div>
        </Section>
      ) : null}

      {panel === 'security' ? (
        <Section title="Security" hint="Passwords, username, and two-factor authentication.">
          <SecurityPanel />
        </Section>
      ) : null}

      {panel === 'advanced' ? (
        <Section title="Advanced integrations" hint="Modrinth lookups and spark profiling.">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleField label="Modrinth lookups" value={bool(form.modrinth_lookup)} onChange={(v) => set('modrinth_lookup', v)} />
            <ToggleField label="Auto-scan on mod changes" value={bool(form.modrinth_auto_scan_on_mod_changes)} onChange={(v) => set('modrinth_auto_scan_on_mod_changes', v)} />
            <ToggleField label="Spark enabled" value={bool(form.spark_enabled)} onChange={(v) => set('spark_enabled', v)} />
            <ToggleField label="Spark mod loaded" value={bool(form.spark_mod_loaded)} onChange={(v) => set('spark_mod_loaded', v)} />
            <ToggleField label="Auto-capture on lag" value={bool(form.spark_auto_capture_on_lag)} onChange={(v) => set('spark_auto_capture_on_lag', v)} />
            <NumberField label="Auto-capture window" unit="sec" value={num(form.spark_auto_capture_window_sec)} onChange={(v) => set('spark_auto_capture_window_sec', v)} />
            <NumberField label="Auto-capture cooldown" unit="sec" value={num(form.spark_auto_capture_cooldown_sec)} onChange={(v) => set('spark_auto_capture_cooldown_sec', v)} />
          </div>
        </Section>
      ) : null}

      {panel === 'about' ? (
        <Section title="About" hint="Build metadata.">
          <Stagger className="grid gap-4 md:grid-cols-2">
            <SpotlightCard className="p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Panel</div>
              <div className="mt-1 text-sm">{str(form.panel, 'none')}</div>
            </SpotlightCard>
            <SpotlightCard className="p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-wt-text-low">Hostname</div>
              <div className="mt-1 text-sm">{str(form.hostname)}</div>
            </SpotlightCard>
            <SpotlightCard className="p-5 md:col-span-2">
              <p className="text-sm text-wt-text-mid">
                WatchTower React dashboard. Fixture preview skips live auth; embedded and{' '}
                <code className="rounded bg-wt-bg2 px-1">preview:live</code> use the real server.
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
            </SpotlightCard>
          </Stagger>
        </Section>
      ) : null}
    </PageEnter>
  );
}

function SecurityPanel() {
  const live = !isFixturePreview();
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
  const qrSrc = totpQrSrc(qrData);

  if (!live) {
    return (
      <SpotlightCard className="flex items-start gap-3 p-4">
        <Shield size={18} className="mt-0.5 shrink-0 text-wt-info" />
        <p className="text-sm text-wt-text-mid">
          Security settings require a live Watchtower server. Use{' '}
          <code className="rounded bg-wt-bg2 px-1">npm run preview:live</code> with{' '}
          <code className="rounded bg-wt-bg2 px-1">WATCHTOWER_ORIGIN</code>, or open the dashboard
          embedded from the mod.
        </p>
      </SpotlightCard>
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
        <TextField label="Current password" value={currentPw} onChange={setCurrentPw} />
        <TextField label="New password" value={newPw} onChange={setNewPw} />
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
        <h3 className="text-sm font-semibold">Two-factor authentication</h3>
        {totpStep === 'idle' ? (
          <>
            <Button kind="default" disabled={saving} onClick={() => void startTotp()}>
              Set up two-factor authentication
            </Button>
            <div className="grid gap-2 border-t border-wt-line pt-3">
              <p className="text-xs text-wt-text-low">Disable 2FA (requires password + code)</p>
              <TextField label="Password" value={disablePw} onChange={setDisablePw} />
              <TextField label="Authenticator or recovery code" value={disableCode} onChange={setDisableCode} />
              <Button
                kind="ghost"
                disabled={saving || !disablePw || !disableCode}
                onClick={() => void disableTotp()}
              >
                Disable 2FA
              </Button>
            </div>
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
    </div>
  );
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
