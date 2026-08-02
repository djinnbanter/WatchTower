import { useState } from 'react';
import { navigate } from '@/app/router';
import { FadeIn, HeroWatermark } from '@/ui/motion';
import { Button, EmptyState, Section, StatusPill } from '@/ui/patterns';
import { Activity, Copy, HardDrive, Settings2 } from '@/ui/icons';
import { asArray, asRecord, get, num, str } from '@/lib/utils';
import { formatGb } from '@/domain/formats';
import { PanelShell, coveragePct } from '../shared';

const OMIT_HEAP_FLAGS_KEY = 'wt.insights.omitHeapFlags';

function loadOmitHeapFlags(): boolean {
  try {
    return localStorage.getItem(OMIT_HEAP_FLAGS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Strip -Xms / -Xmx tokens (panel often owns heap size). */
function stripHeapFlags(flags: string): string {
  return flags
    .split(/\s+/)
    .filter((tok) => tok && !/^-Xm[sx]/i.test(tok))
    .join(' ')
    .trim();
}

function applyHeapFlagPreference(flags: string, omitHeap: boolean): string {
  if (!flags || !omitHeap) return flags;
  return stripHeapFlags(flags);
}

function ramSizingBadge(
  verdict: string,
  envelope?: string,
): { label: string; tone: 'ok' | 'warn' | 'info' | 'neutral' | 'danger' } {
  if (verdict === 'envelope_tight') {
    return {
      label: 'Tight host',
      tone: envelope === 'critical' ? 'danger' : 'warn',
    };
  }
  switch (verdict) {
    case 'over_provisioned':
      return { label: 'Over-provisioned', tone: 'info' };
    case 'under_provisioned':
      return { label: 'Under-provisioned', tone: 'warn' };
    case 'insufficient_data':
      return { label: 'Not enough data', tone: 'neutral' };
    case 'right_sized':
      return { label: 'Right-sized', tone: 'ok' };
    default:
      return { label: 'Unknown', tone: 'neutral' };
  }
}

function ramSourceLabel(source: string): string {
  if (!source) return 'host';
  if (source.startsWith('cgroup')) return 'cgroup';
  if (source === 'proc') return 'host';
  return source;
}

function recommendActionLabel(action: string) {
  switch (action) {
    case 'fix_java_first':
      return 'Install correct Java first';
    case 'adopt_baseline':
      return 'Worth adopting recommended flags';
    case 'complete_baseline':
      return 'Worth adding missing flags';
    case 'apply_large_overrides':
      return 'Apply large-heap overrides';
    case 'keep':
      return 'Already on recommended setup';
    case 'keep_advanced':
      return 'Keep advanced setup';
    case 'optional_zgc':
      return 'Optional: try ZGC';
    default:
      return action ? action.replace(/_/g, ' ') : '';
  }
}

function recommendActionTone(action: string): 'ok' | 'warn' | 'info' | 'neutral' | 'danger' {
  switch (action) {
    case 'keep':
      return 'ok';
    case 'keep_advanced':
      return 'info';
    case 'fix_java_first':
      return 'danger';
    case 'adopt_baseline':
    case 'complete_baseline':
    case 'apply_large_overrides':
    case 'optional_zgc':
      return 'warn';
    default:
      return 'neutral';
  }
}

function verdictLabel(verdict: string) {
  switch (verdict) {
    case 'healthy':
      return 'Healthy';
    case 'heap_bound':
      return 'Heap-bound';
    case 'gc_bound':
      return 'GC-bound';
    case 'single_thread_bound':
      return 'Single-thread bound';
    default:
      return verdict || 'Unknown';
  }
}

function flagsSourceLabel(source: string) {
  if (source === 'jvm_args_file') return 'From jvm args file';
  if (source === 'runtime_mxbean') return 'From live JVM process';
  return source || 'Source unknown';
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

function RamSizingCard({
  ram,
  pasteXmxGb,
}: {
  ram: Record<string, unknown>;
  pasteXmxGb: number | null;
}) {
  if (!Object.keys(ram).length) return null;
  const envelope = str(ram.envelope);
  const badge = ramSizingBadge(str(ram.verdict), envelope);
  const blocked = !!ram.ram_upgrade_blocked;
  const peak = ram.heap_used_gb_peak;
  const xmx = ram.xmx_gb;
  const host = ram.host_mem_gb;
  const outside = ram.outside_headroom_gb;
  const suggestMin = ram.suggested_xmx_gb_min;
  const suggestMax = ram.suggested_xmx_gb_max;
  const suggestLabel =
    suggestMin != null
      ? suggestMax != null && suggestMax !== suggestMin
        ? `toward ${suggestMin}–${suggestMax}G`
        : `toward ~${suggestMin}G`
      : null;
  const pasteNote =
    pasteXmxGb != null && xmx != null && Math.abs(pasteXmxGb - num(xmx)) >= 0.5
      ? `Full recommended flags below use -Xmx${Math.round(pasteXmxGb)}G to match this window’s sizing advice.`
      : null;

  return (
    <div className="wt-hero-shell relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 p-5">
      <HeroWatermark icon={HardDrive} tone="accent" size="card" />
      <div className="relative z-[1] mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">RAM sizing</h3>
        </div>
        <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
      </div>
      <p className="relative z-[1] text-sm text-wt-text-mid">{str(ram.advice, '—')}</p>
      <p className="relative z-[1] mt-1 text-xs text-wt-text-low">
        {host != null
          ? 'Host/container memory vs heap, then Insights window heap history.'
          : 'Metrics below are for this Insights window.'}
      </p>
      {host != null ? (
        <div className="relative z-[1] mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-wt-text-low">
          <span>
            Host{' '}
            <strong className="text-wt-text">{formatGb(num(host))}</strong> (
            {ramSourceLabel(str(ram.ram_source))})
          </span>
          {xmx != null ? (
            <span>
              Heap (-Xmx) <strong className="text-wt-text">{formatGb(num(xmx))}</strong>
            </span>
          ) : null}
          <span>
            Outside heap <strong className="text-wt-text">{envelope || '—'}</strong>
            {outside != null ? ` (${formatGb(num(outside))})` : ''}
          </span>
        </div>
      ) : null}
      <div className="relative z-[1] mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-wt-text-low">
        {host == null && xmx != null ? (
          <span>
            Allocated <strong className="text-wt-text">{formatGb(num(xmx))}</strong>
          </span>
        ) : null}
        {peak != null ? (
          <span>
            Peak <strong className="text-wt-text">{formatGb(num(peak))}</strong>
          </span>
        ) : null}
        {ram.heap_pressure_pct_p95 != null ? (
          <span>
            Pressure p95{' '}
            <strong className="text-wt-text">{num(ram.heap_pressure_pct_p95).toFixed(0)}%</strong>
          </span>
        ) : null}
        {ram.headroom_gb != null ? (
          <span>
            Heap headroom <strong className="text-wt-text">{formatGb(num(ram.headroom_gb))}</strong>
          </span>
        ) : null}
        {suggestLabel ? (
          <span>
            Suggest <strong className="text-wt-text">{suggestLabel}</strong>
          </span>
        ) : null}
      </div>
      {pasteNote ? <p className="relative z-[1] mt-3 text-xs text-wt-text-mid">{pasteNote}</p> : null}
      {blocked && str(ram.gc_verdict) === 'single_thread_bound' ? (
        <div className="relative z-[1] mt-3">
          <Button kind="default" onClick={() => navigate({ tab: 'live', view: null, panel: null })}>
            Open Live
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ConfigsPanel({
  dash,
  ops,
  facts,
  live,
}: {
  dash: Record<string, unknown>;
  ops: Record<string, unknown>;
  facts: Record<string, unknown>;
  live: Record<string, unknown>;
}) {
  const optional = asRecord(facts.optional);
  const jvmFacts = asRecord(optional.jvm_health);
  const jvmLive = asRecord(get(live, 'latest', 'jvm_health_live'));
  const jvm = Object.keys(jvmFacts).length ? jvmFacts : jvmLive;
  const audit = asRecord(optional.config_launch_audit);
  const props = asArray<Record<string, unknown>>(audit.properties);
  const modIssues = asArray<Record<string, unknown>>(get(ops, 'mod_issues', 'entries'));
  const configLikeCount = modIssues.filter((m) =>
    /config|recipe|registry/i.test(str(m.top_category)),
  ).length;
  const ram = asRecord(dash.ram_sizing);

  const alignedPaste = str(dash.jvm_recommended_flags);
  const recommendedRaw = alignedPaste || jvm.recommended_flags;
  const recommendedFull = Array.isArray(recommendedRaw)
    ? recommendedRaw.map((f) => (typeof f === 'string' ? f : str(asRecord(f).flag, str(f)))).join(' ')
    : str(recommendedRaw);

  const missingKeys = asArray(jvm.missing_flags).map(String);
  const missingPaste = asArray(jvm.missing_flags_paste).map(String);
  const needsXmsEqualsXmx = missingKeys.includes('Xms=Xmx');
  const flagsCoverage = asRecord(jvm.flags_coverage);
  const matchedFlags = Math.round(num(flagsCoverage.matched));
  const expectedFlags = Math.round(num(flagsCoverage.expected));
  const coverage =
    expectedFlags > 0 ? (matchedFlags / expectedFlags) * 100 : coveragePct(jvm.flags_coverage);
  const action = str(jvm.recommend_action);
  const zgcFlags = str(jvm.optional_zgc_flags);
  const currentFlags = str(jvm.current_flags);
  const flagsSource = str(jvm.flags_source);
  const pasteXmx =
    dash.jvm_recommended_flags_xmx_gb != null
      ? num(dash.jvm_recommended_flags_xmx_gb)
      : null;

  const liveLatest = asRecord(live.latest);
  const gcPause =
    jvm.gc_pause_pct_of_wall != null
      ? num(jvm.gc_pause_pct_of_wall)
      : liveLatest.gc_pause_pct != null
        ? num(liveLatest.gc_pause_pct)
        : null;

  const [omitHeapFlags, setOmitHeapFlags] = useState(loadOmitHeapFlags);
  const setOmitHeap = (v: boolean) => {
    setOmitHeapFlags(v);
    try {
      localStorage.setItem(OMIT_HEAP_FLAGS_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const shownCurrent = applyHeapFlagPreference(currentFlags, omitHeapFlags);
  const shownRecommended = applyHeapFlagPreference(recommendedFull, omitHeapFlags);
  const shownZgc = applyHeapFlagPreference(zgcFlags, omitHeapFlags);
  const showXmsNote = needsXmsEqualsXmx && !omitHeapFlags;

  return (
    <PanelShell>
      <FadeIn>
        <Section
          title="JVM flags advisor"
          icon={Settings2}
          hint="Current args, what’s missing, and a full Aikar set ready to paste."
        >
          {!Object.keys(jvm).length ? (
            <EmptyState title="No JVM health yet">
              Once Watchtower has live samples or a report, flag advice shows up here.
            </EmptyState>
          ) : (
            <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-jvm-advisor">
              <div className="relative z-10">
              <div className="in-jvm-advisor__top">
                <div className="in-jvm-advisor__status">
                  <StatusPill
                    tone={
                      str(jvm.verdict) === 'healthy'
                        ? 'ok'
                        : str(jvm.verdict).includes('bound')
                          ? 'warn'
                          : 'neutral'
                    }
                  >
                    {verdictLabel(str(jvm.verdict))}
                  </StatusPill>
                  {action ? (
                    <StatusPill tone={recommendActionTone(action)}>
                      {recommendActionLabel(action)}
                    </StatusPill>
                  ) : null}
                </div>
                <p className="in-jvm-advisor__advice">{str(jvm.advice)}</p>
                <div className="in-jvm-advisor__meta">
                  Profile {str(jvm.flags_profile)} · Java {str(jvm.java_major)} · baseline{' '}
                  {str(jvm.baseline_name, '—')}
                </div>
              </div>

              <div className="in-jvm-advisor__stats">
                {expectedFlags > 0 || coverage > 0 ? (
                  <div
                    className={`in-jvm-coverage is-${coverage >= 90 ? 'ok' : coverage >= 50 ? 'accent' : 'warn'}`}
                    role="meter"
                    aria-label="Aikar baseline coverage"
                    aria-valuenow={Math.round(coverage)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className="in-jvm-coverage__fill"
                      style={{ width: `${Math.min(100, Math.max(0, coverage))}%` }}
                    />
                    <span className="in-jvm-coverage__label">Aikar coverage</span>
                    <span className="in-jvm-coverage__value">
                      {expectedFlags > 0
                        ? `${Math.round(coverage)}% · ${matchedFlags}/${expectedFlags}`
                        : `${Math.round(coverage)}%`}
                    </span>
                  </div>
                ) : null}
                <div className="in-jvm-advisor__kpis">
                  <div>
                    <span>Matched</span>
                    <strong>{matchedFlags || Math.round(coverage)}</strong>
                  </div>
                  <div>
                    <span>Expected</span>
                    <strong>{expectedFlags || '—'}</strong>
                  </div>
                  {gcPause != null ? (
                    <div>
                      <span>GC pause</span>
                      <strong className={gcPause >= 8 ? 'is-warn' : undefined}>{gcPause.toFixed(1)}%</strong>
                    </div>
                  ) : null}
                  {jvm.heap_pressure_pct != null ? (
                    <div>
                      <span>Heap</span>
                      <strong className={num(jvm.heap_pressure_pct) >= 85 ? 'is-danger' : undefined}>
                        {num(jvm.heap_pressure_pct).toFixed(0)}%
                      </strong>
                    </div>
                  ) : null}
                </div>
              </div>

              <label className="in-jvm-advisor__omit">
                <span>
                  <strong>Omit -Xms / -Xmx</strong>
                  <em>When the host panel sets heap size</em>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={omitHeapFlags}
                  aria-label="Omit heap memory flags"
                  onClick={() => setOmitHeap(!omitHeapFlags)}
                  className={`in-jvm-advisor__switch${omitHeapFlags ? ' is-on' : ''}`}
                >
                  <span />
                </button>
              </label>

              <div className="in-jvm-advisor__grid">
                <div className="in-jvm-panel">
                  <div className="in-jvm-panel__head">
                    <h4>Current</h4>
                    <span className="in-jvm-panel__meta">{flagsSourceLabel(flagsSource)}</span>
                  </div>
                  {shownCurrent ? (
                    <>
                      <pre className="in-flags-pre in-flags-pre--compact">{shownCurrent}</pre>
                      <Button kind="ghost" className="in-jvm-panel__btn" onClick={() => copyText(shownCurrent)}>
                        <Copy size={13} className="mr-1.5" /> Copy current
                      </Button>
                    </>
                  ) : currentFlags && omitHeapFlags ? (
                    <p className="in-jvm-panel__empty">Only heap flags were present — panel manages memory.</p>
                  ) : (
                    <p className="in-jvm-panel__empty">Current JVM args not available yet.</p>
                  )}
                </div>

                <div className="in-jvm-panel">
                  <div className="in-jvm-panel__head">
                    <h4>Add / fix</h4>
                    <span className="in-jvm-panel__meta">
                      {missingPaste.length
                        ? `${missingPaste.length} missing`
                        : 'Nothing missing'}
                    </span>
                  </div>
                  {missingPaste.length || showXmsNote ? (
                    <>
                      {showXmsNote ? (
                        <p className="in-jvm-panel__note">
                          Set <code className="in-code">-Xms</code> equal to{' '}
                          <code className="in-code">-Xmx</code>.
                        </p>
                      ) : null}
                      {missingPaste.length ? (
                        <>
                          <div className="in-chip-row in-chip-row--scroll">
                            {missingPaste.map((f) => (
                              <span key={f} className="in-chip in-chip--warn" title={f}>
                                {f}
                              </span>
                            ))}
                          </div>
                          <Button
                            kind="ghost"
                            className="in-jvm-panel__btn"
                            onClick={() => copyText(missingPaste.join(' '))}
                          >
                            <Copy size={13} className="mr-1.5" /> Copy missing
                          </Button>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <p className="in-jvm-panel__empty">No Aikar baseline gaps for this heap size.</p>
                  )}
                </div>
              </div>

              <div className="in-jvm-panel in-jvm-panel--full">
                <div className="in-jvm-panel__head">
                  <h4>Full recommended set</h4>
                  <span className="in-jvm-panel__meta">
                    {omitHeapFlags
                      ? 'Aikar / flags.sh · heap omitted'
                      : pasteXmx != null
                        ? `Aikar / flags.sh · -Xmx${Math.round(pasteXmx)}G`
                        : 'Aikar / flags.sh G1'}
                  </span>
                </div>
                {shownRecommended ? (
                  <>
                    <pre className="in-flags-pre in-flags-pre--compact">{shownRecommended}</pre>
                    <div className="in-jvm-panel__actions">
                      <Button kind="default" onClick={() => copyText(shownRecommended)}>
                        <Copy size={13} className="mr-1.5" /> Copy full set
                      </Button>
                      <Button
                        kind="ghost"
                        onClick={() => navigate({ tab: 'live', view: null, panel: null })}
                      >
                        Open Live memory
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="in-jvm-panel__empty">No full flag set yet.</p>
                )}

                {shownZgc ? (
                  <details className="in-jvm-zgc">
                    <summary>Optional ZGC flags</summary>
                    <pre className="in-flags-pre in-flags-pre--compact">{shownZgc}</pre>
                    <Button kind="ghost" className="in-jvm-panel__btn" onClick={() => copyText(shownZgc)}>
                      <Copy size={13} className="mr-1.5" /> Copy ZGC flags
                    </Button>
                  </details>
                ) : null}
              </div>
              </div>
            </div>
          )}
        </Section>
      </FadeIn>

      <FadeIn>
        <RamSizingCard ram={ram} pasteXmxGb={pasteXmx} />
      </FadeIn>

      <FadeIn>
        <Section
          title="server.properties audit"
          icon={Settings2}
          hint={str(audit.path, 'server.properties') + ' — fixed soft bands for modded dedicated servers (not Spark-adaptive).'}
        >
          {props.length ? (
            <div className="in-table-scroll">
              <table className="in-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Current</th>
                    <th>Recommended</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {props.map((p, i) => {
                    const verdict = str(p.verdict);
                    const tone =
                      verdict.includes('ok') || verdict.includes('fine')
                        ? 'ok'
                        : verdict === 'missing' || verdict === 'unknown'
                          ? 'neutral'
                          : 'warn';
                    return (
                      <tr key={str(p.key, String(i))} title={str(p.detail)}>
                        <td>
                          <div className="font-medium text-wt-text">{str(p.title, str(p.key))}</div>
                          <div className="text-xs text-wt-text-low font-mono">{str(p.key)}</div>
                        </td>
                        <td className="font-mono">{p.value != null ? str(p.value) : '—'}</td>
                        <td className="font-mono text-wt-text-mid">
                          {str(p.recommended, '—')}
                        </td>
                        <td>
                          <StatusPill tone={tone}>
                            {verdict.replace(/_/g, ' ') || '—'}
                          </StatusPill>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No audit rows" />
          )}
          <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 in-spark-cta mt-3">
            <div className="in-spark-cta__body">
              <div className="in-spark-cta__icon" aria-hidden="true">
                <Activity size={18} />
              </div>
              <div className="in-spark-cta__copy">
                <div className="in-spark-cta__eyebrow">Spark profile</div>
                <div className="in-spark-cta__title">Want sharper recommendations?</div>
                <p className="in-spark-cta__text">
                  This audit uses fixed bands from on-disk server.properties. Profile during lag and Watchtower can suggest specific values from that capture’s CPU, heap, RAM, and tick load.
                </p>
              </div>
              <Button
                kind="primary"
                className="in-spark-cta__action"
                onClick={() => navigate({ tab: 'spark', view: 'technical', panel: null })}
              >
                Open Spark Technical
              </Button>
            </div>
          </div>
        </Section>
      </FadeIn>

      {configLikeCount > 0 ? (
        <FadeIn>
          <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-sm font-semibold">
                {configLikeCount} config-like mod issue{configLikeCount === 1 ? '' : 's'}
              </div>
              <p className="text-xs text-wt-text-low">
                Filtered from the mod log error scan — inspect on Mods.
              </p>
            </div>
            <Button
              kind="ghost"
              onClick={() => navigate({ tab: 'mods', view: 'log-errors', panel: null })}
            >
              Open Mods
            </Button>
          </div>
        </FadeIn>
      ) : null}
    </PanelShell>
  );
}
