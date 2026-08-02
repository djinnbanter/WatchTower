import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { api } from '@/api/client';
import { navigate } from '@/app/router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Info,
  Network,
  Package,
  Shield,
  Terminal,
  Wrench,
  X,
} from '@/ui/icons';
import {
  BarMeter,
  ChartFrame,
  CompareBars,
  PieChart,
  WtAreaChart,
  WtCpuGauge,
  WtGauge,
  WtHeapGauge,
} from '@/ui/charts';
import { FadeIn, GlareIcon, useCountUp, useDeferredIntro } from '@/ui/motion';
import { Button, EmptyState, MetricReadout, Section, StatusPill } from '@/ui/patterns';
import { fmtBytes, fmtDate } from '@/lib/utils';
import AnimatedList from '@/components/animated-list/AnimatedList';
import BorderGlow from '@/components/border-glow/BorderGlow';
import { CallTree } from './call-tree';
import { adviseServerSettings } from './server-settings';
import {
  array,
  buildOperatorReportMarkdown,
  compositionPieSegments,
  concentrationBarRows,
  entityTypeBarColor,
  entityTypeLabel,
  findings,
  methods,
  numeric,
  profileCompatibility,
  profileDuration,
  record,
  sourcesAtWindow,
  sourceWindowIds,
  sources,
  text,
  timeline,
  timelineToBklitRows,
  topNonPlatformSource,
  truthy,
  unwrapProfile,
  worldDimensionLabel,
  type SparkFinding,
  type SparkSummary,
  type UnknownRecord,
} from './model';

const CAPTURE_COMMAND = '/spark profiler start --timeout 60';
type SectionIcon = ComponentType<{ size?: number; className?: string }>;
const ActivityIcon = Activity as SectionIcon;
const FileTextIcon = FileText as SectionIcon;
const NetworkIcon = Network as SectionIcon;
const ClipboardListIcon = ClipboardList as SectionIcon;
const TerminalIcon = Terminal as SectionIcon;

function toneFor(value: string): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  if (value === 'critical' || value === 'danger' || value === 'error') return 'danger';
  if (value === 'warn' || value === 'warning' || value === 'degraded') return 'warn';
  if (value === 'ok' || value === 'healthy' || value === 'good') return 'ok';
  return value === 'info' ? 'info' : 'neutral';
}

function confidenceLabel(value: string): string {
  if (value === 'observed') return 'Measured';
  if (value === 'correlated') return 'Likely related';
  if (value === 'contextual') return 'Worth checking';
  return value;
}

function severityLabel(value: string): string {
  if (value === 'critical' || value === 'danger' || value === 'error') return 'Critical';
  if (value === 'warn' || value === 'warning' || value === 'degraded') return 'Warn';
  if (value === 'info') return 'Info';
  if (value === 'ok' || value === 'healthy' || value === 'good') return 'Ok';
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Note';
}

/** Hide schema-ish paths like source_rollups.own_pct from operator UI. */
function isInternalEvidencePath(path: string): boolean {
  const p = path.trim();
  if (!p) return true;
  if (/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(p)) return true;
  if (p.includes('_rollups') || p.startsWith('context.') || p.startsWith('analysis.')) return true;
  return false;
}

function isNumericEvidenceValue(value: string): boolean {
  return /^-?[\d.,]+$/.test(value.trim());
}

function CountMetric({
  label,
  value,
  unit,
  tone = 'default',
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
}) {
  const n = useCountUp(value);
  return <MetricReadout label={label} value={Number(n.toFixed(1))} unit={unit} tone={tone} />;
}

function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(CAPTURE_COMMAND);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="sp-command">
      <code>{CAPTURE_COMMAND}</code>
      <Button kind="ghost" onClick={() => void copy()} aria-label="Copy Spark capture command">
        <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

function jumpToSource(profilePath: string, sourceId: string) {
  navigate({ tab: 'spark', profile: profilePath, view: 'calls', source: sourceId });
}

function sourceIdFromFinding(findingId: string): string {
  const match = /^spark\.source\.([^.]+)/.exec(findingId);
  return match?.[1] ?? '';
}

function isAttentionSeverity(severity: string): boolean {
  return severity === 'critical'
    || severity === 'danger'
    || severity === 'error'
    || severity === 'warn'
    || severity === 'warning';
}

export function OverviewView({
  profile,
  profilePath = '',
}: {
  profile: UnknownRecord;
  profilePath?: string;
}) {
  const context = record(profile.context);
  const verdict = record(profile.verdict ?? record(profile.analysis).verdict);
  const rows = findings(profile);
  const evidenceSummary = record(profile.evidence_summary);
  const composition = record(context.entity_composition);
  const pieSegments = compositionPieSegments(context);
  const topSource = topNonPlatformSource(profile);
  const datapackCount = array<UnknownRecord>(context.datapacks).filter((row) => text(row.id) !== '_truncated').length;
  const duration = profileDuration(profile);
  const tps = numeric(context.tps_1m ?? context.tps);
  const mspt = numeric(context.mspt_p95_1m ?? context.mspt_p95 ?? context.mspt);
  const msptMean = numeric(context.mspt_mean_1m);
  const msptMax5 = numeric(context.mspt_max_5m);
  const hasMsptMean = context.mspt_mean_1m != null && context.mspt_mean_1m !== '';
  const hasMsptMax5 = context.mspt_max_5m != null && context.mspt_max_5m !== '';
  const msptDial = hasMsptMean || msptMean > 0 ? msptMean : mspt;
  const grade = text(verdict.grade);
  const verdictTone = toneFor(grade);
  const introReady = useDeferredIntro(true);
  const [copied, setCopied] = useState(false);
  const previewFindings = rows.slice(0, 3);

  const copyReport = async () => {
    await navigator.clipboard.writeText(buildOperatorReportMarkdown(profile, profilePath));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="sp-view-stack">
      <div className={`relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-lead sp-lead--${verdictTone}`}>
        <div className="sp-lead__head">
          <div className="sp-lead__copy">
            <div className="sp-eyebrow">What this profile found</div>
            <div className="sp-lead__title">
              <h3>{text(verdict.headline, rows[0]?.title || 'Profile ready to review')}</h3>
              <StatusPill tone={verdictTone}>{text(verdict.grade, 'analyzed')}</StatusPill>
            </div>
            <p>{text(verdict.summary, 'Read the findings below, then try one change and profile again.')}</p>
          </div>
          <div className="sp-lead__actions">
            <Button kind="primary" onClick={() => void copyReport()}>
              <Copy size={14} /> {copied ? 'Copied' : 'Copy report'}
            </Button>
          </div>
        </div>

        {introReady ? (
          <FadeIn>
            <div className="sp-lead__vitals sp-lead__vitals--metrics" aria-label="Capture vitals">
              <div className="sp-metrics sp-metrics--lead">
                <CountMetric label="TPS" value={tps} tone={tps > 0 && tps < 18 ? 'danger' : tps < 19.5 ? 'warn' : 'ok'} />
                <CountMetric label="Typical tick" value={msptDial} unit="ms" tone={msptDial > 50 ? 'danger' : msptDial > 40 ? 'warn' : 'ok'} />
                <CountMetric label="Slow ticks (p95)" value={mspt} unit="ms" tone={mspt > 50 ? 'danger' : 'ok'} />
                {hasMsptMax5 || msptMax5 > 0 ? (
                  <CountMetric label="Worst tick (5 min)" value={msptMax5} unit="ms" tone={msptMax5 > 500 ? 'danger' : 'warn'} />
                ) : null}
                <CountMetric label="Players" value={numeric(context.players)} />
                <CountMetric label="Duration" value={duration} unit="s" tone={duration < 20 ? 'warn' : 'default'} />
                {datapackCount >= 8 ? (
                  <CountMetric label="Datapacks" value={datapackCount} />
                ) : null}
              </div>
            </div>
          </FadeIn>
        ) : (
          <div className="sp-skeleton sp-skeleton--hero" aria-hidden />
        )}
      </div>

      {Object.keys(evidenceSummary).length ? (
        <div className={`relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-evidence-plate sp-evidence-plate--${verdictTone}`}>
          <div className="sp-evidence-hero">
            <GlareIcon icon={AlertTriangle} tone={verdictTone === 'ok' ? 'ok' : verdictTone === 'danger' ? 'danger' : 'warn'} />
            <div className="sp-evidence-hero__copy">
              <div className="sp-eyebrow">What happened</div>
              <p>{text(evidenceSummary.what_happened)}</p>
            </div>
            <div className="sp-evidence-hero__pill">
              <StatusPill tone={verdictTone}>{text(verdict.grade, 'analyzed')}</StatusPill>
            </div>
          </div>

          <div className="sp-evidence-steps">
            <div className="sp-evidence-step sp-evidence-step--why">
              <div className="sp-evidence-step__top">
                <span className="sp-evidence-step__num" aria-hidden="true">01</span>
                <GlareIcon icon={Activity} tone="warn" />
              </div>
              <div className="sp-eyebrow">Why we flagged this</div>
              <p>{text(evidenceSummary.why_watchtower_says_this)}</p>
            </div>

            <div className="sp-evidence-step sp-evidence-step--next">
              <div className="sp-evidence-step__top">
                <span className="sp-evidence-step__num" aria-hidden="true">02</span>
                <GlareIcon icon={CheckCircle2} tone="ok" />
              </div>
              <div className="sp-eyebrow">Try this next</div>
              <p>{text(evidenceSummary.do_this_next)}</p>
              <Button
                kind="primary"
                className="sp-evidence-step__cta"
                onClick={() => navigate({ tab: 'spark', profile: profilePath, view: 'world', source: null })}
              >
                Open World view <ArrowRight size={14} />
              </Button>
            </div>

            <div className="sp-evidence-step sp-evidence-step--limit">
              <div className="sp-evidence-step__top">
                <span className="sp-evidence-step__num" aria-hidden="true">03</span>
                <GlareIcon icon={Shield} tone="info" />
              </div>
              <div className="sp-eyebrow">What this can’t prove</div>
              <p>{text(evidenceSummary.what_this_cannot_prove)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="sp-brief-grid">
        {pieSegments.length ? (
          <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-brief-card sp-brief-card--entities">
            <div className="sp-brief-card__head">
              <GlareIcon icon={Activity} tone="warn" />
              <div className="sp-brief-card__titles">
                <div className="sp-eyebrow">What’s in the world</div>
                <h3>Loaded entities</h3>
              </div>
            </div>
            <p className="sp-brief-card__hint">
              Counts of each kind currently loaded. Busy worlds often mean lag risk — not proof they made the server lag.
            </p>
            <div className="sp-brief-card__visual">
              <PieChart className="sp-brief-pie" segments={pieSegments} size={168} />
            </div>
            <div className="sp-brief-card__footer">
              <Button kind="ghost" onClick={() => navigate({ tab: 'spark', profile: profilePath, view: 'world', source: null })}>
                Open World view
              </Button>
            </div>
          </div>
        ) : Object.keys(composition).length ? (
          <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-brief-card sp-brief-card--entities">
            <div className="sp-brief-card__head">
              <GlareIcon icon={Activity} tone="warn" />
              <div className="sp-brief-card__titles">
                <div className="sp-eyebrow">What’s in the world</div>
                <h3>Loaded entities</h3>
              </div>
            </div>
            <p className="sp-brief-card__hint">
              Counts of each kind currently loaded. Busy worlds often mean lag risk — not proof they made the server lag.
            </p>
            <div className="sp-brief-card__footer">
              <Button kind="ghost" onClick={() => navigate({ tab: 'spark', profile: profilePath, view: 'world', source: null })}>
                Open World view
              </Button>
            </div>
          </div>
        ) : null}
        {topSource ? (
          <div className={`relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-brief-card sp-brief-card--source${topSource.ownPct >= 25 ? ' is-hot' : ''}`}>
            <div className="sp-brief-card__head">
              <GlareIcon icon={Package} tone={topSource.ownPct >= 25 ? 'warn' : 'accent'} />
              <div className="sp-brief-card__titles">
                <div className="sp-eyebrow">Top mod by time</div>
                <h3 title={topSource.label}>{topSource.label}</h3>
              </div>
            </div>
            <p className="sp-brief-card__hint">
              Where time showed up in the sample — not proof this mod made the server lag.
            </p>
            <div className="sp-brief-card__body">
              <div
                className="sp-brief-card__gauge"
                aria-label={`${topSource.ownPct.toFixed(1)} percent of sample`}
              >
                <WtGauge
                  value={topSource.ownPct}
                  label="of sample"
                  suffix="%"
                  tone={topSource.ownPct >= 25 ? 'warn' : 'accent'}
                  size={208}
                />
              </div>
              <div className="sp-brief-card__copy">
                {topSource.topLabel ? (
                  <div className="sp-brief-card__step">
                    <span>Top step</span>
                    <code title={topSource.topLabel}>{topSource.topLabel}</code>
                  </div>
                ) : (
                  <div className="sp-brief-card__step is-empty">
                    <span>Top step</span>
                    <code>No hot step labeled in this capture</code>
                  </div>
                )}
                <div className="sp-brief-card__meta">
                  <span>Share of sample</span>
                  <strong>{topSource.ownPct.toFixed(1)}%</strong>
                </div>
              </div>
            </div>
            <div className="sp-brief-card__footer">
              <Button kind="primary" onClick={() => jumpToSource(profilePath, topSource.id)}>
                Jump to call paths
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Section
        title="Top findings"
        hint={rows.length > 3 ? `${rows.length} total — open the Findings tab for the full triage list.` : 'Most important signals from this capture.'}
        icon={ClipboardListIcon}
        actions={
          rows.length ? (
            <Button kind="ghost" onClick={() => navigate({ tab: 'spark', profile: profilePath, view: 'findings', finding: null, source: null })}>
              All findings <ArrowRight size={13} />
            </Button>
          ) : null
        }
      >
        {previewFindings.length ? (
          <div className="sp-findings-plate sp-findings-plate--preview">
            <div className="sp-findings-plate__list">
              {previewFindings.map((finding, index) => (
                <button
                  type="button"
                  key={finding.id}
                  className={`sp-finding-row is-${finding.severity}`}
                  onClick={() => navigate({
                    tab: 'spark',
                    profile: profilePath,
                    view: 'findings',
                    finding: finding.id,
                    source: null,
                  })}
                >
                  <span className="sp-finding-row__rank">{index + 1}</span>
                  <span className="sp-finding-row__title">{finding.title}</span>
                  <span className="sp-finding-row__meta">
                    <StatusPill tone={toneFor(finding.severity)}>{finding.severity}</StatusPill>
                    <span className="sp-confidence">{confidenceLabel(finding.confidence)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState title="No findings yet">
            The profile loaded, but this capture didn’t include findings.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}

export function FindingsView({
  profile,
  profilePath = '',
  initialFindingId = '',
}: {
  profile: UnknownRecord;
  profilePath?: string;
  initialFindingId?: string;
}) {
  const rows = findings(profile);
  const recommendations = array<UnknownRecord>(
    profile.recommendations ?? record(profile.analysis).recommendations,
  );
  const attentionRows = rows.filter((row) => isAttentionSeverity(row.severity));
  const contextRows = rows.filter((row) => !isAttentionSeverity(row.severity));
  const defaultFindingId =
    (initialFindingId && rows.some((row) => row.id === initialFindingId) ? initialFindingId : '')
    || attentionRows[0]?.id
    || rows[0]?.id
    || '';

  const [selectedFindingId, setSelectedFindingId] = useState(defaultFindingId);

  useEffect(() => {
    if (initialFindingId && rows.some((row) => row.id === initialFindingId)) {
      setSelectedFindingId(initialFindingId);
      return;
    }
    if (!rows.some((row) => row.id === selectedFindingId)) {
      setSelectedFindingId(defaultFindingId);
    }
  }, [initialFindingId, rows, selectedFindingId, defaultFindingId]);

  const selectedFinding = rows.find((row) => row.id === selectedFindingId) ?? rows[0];

  const selectFinding = (id: string) => {
    setSelectedFindingId(id);
    navigate({ tab: 'spark', profile: profilePath, view: 'findings', finding: id }, true);
  };

  type FindingListEntry =
    | { kind: 'group'; id: string; label: string }
    | { kind: 'finding'; id: string; finding: SparkFinding; rank: number };

  const listEntries: FindingListEntry[] = [
    ...(attentionRows.length
      ? [
          { kind: 'group' as const, id: 'group-start', label: 'Start here' },
          ...attentionRows.map((finding, index) => ({
            kind: 'finding' as const,
            id: finding.id,
            finding,
            rank: index + 1,
          })),
        ]
      : []),
    ...(contextRows.length
      ? [
          { kind: 'group' as const, id: 'group-context', label: 'Also noted' },
          ...contextRows.map((finding, index) => ({
            kind: 'finding' as const,
            id: finding.id,
            finding,
            rank: attentionRows.length + index + 1,
          })),
        ]
      : []),
  ];

  const selectedListIndex = listEntries.findIndex(
    (entry) => entry.kind === 'finding' && entry.id === selectedFinding?.id,
  );

  return (
    <div className="sp-view-stack">
      <Section
        title="Findings"
        hint="Most important first. Hard numbers (TPS, entities) beat guesswork from stack samples."
        icon={ClipboardListIcon}
        actions={rows.length ? <StatusPill tone="neutral">{rows.length}</StatusPill> : null}
      >
        {rows.length ? (
          <div className="sp-findings-desk">
            <div className="sp-findings-desk__body">
              <div className="sp-findings-plate sp-findings-desk__list">
                <AnimatedList
                  className="sp-findings-animated"
                  items={listEntries}
                  getKey={(entry) => entry.id}
                  selectedIndex={selectedListIndex}
                  isSelectable={(entry) => entry.kind === 'finding'}
                  onItemSelect={(entry) => {
                    if (entry.kind === 'finding') selectFinding(entry.finding.id);
                  }}
                  showGradients={false}
                  enableArrowNavigation
                  displayScrollbar
                  renderItem={(entry, _index, selected) => {
                    if (entry.kind === 'group') {
                      return <div className="sp-findings-group__label">{entry.label}</div>;
                    }
                    return (
                      <div className={`sp-finding-row is-${entry.finding.severity}${selected ? ' is-selected' : ''}`}>
                        <span className="sp-finding-row__rank">{entry.rank}</span>
                        <span className="sp-finding-row__title">{entry.finding.title}</span>
                        <span className="sp-finding-row__meta">
                          <StatusPill tone={toneFor(entry.finding.severity)}>
                            {severityLabel(entry.finding.severity)}
                          </StatusPill>
                          <span className="sp-confidence">{confidenceLabel(entry.finding.confidence)}</span>
                        </span>
                      </div>
                    );
                  }}
                />
              </div>

              {selectedFinding ? (
                <div className={`relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-finding-detail sp-findings-desk__detail is-${selectedFinding.severity}`}>
                  <div className="sp-finding-detail__head">
                    <div>
                      <div className="sp-eyebrow">Selected finding</div>
                      <h3>{selectedFinding.title}</h3>
                    </div>
                    <div className="sp-finding-detail__pills">
                      <StatusPill tone={toneFor(selectedFinding.severity)}>
                        {severityLabel(selectedFinding.severity)}
                      </StatusPill>
                      <span className="sp-confidence">{confidenceLabel(selectedFinding.confidence)}</span>
                    </div>
                  </div>
                  <p className="sp-finding-detail__story">{selectedFinding.detail}</p>

                  {selectedFinding.evidence.length ? (
                    <div className="sp-finding-detail__section">
                      <div className="sp-finding-detail__section-label">Evidence</div>
                      <div className="sp-finding-metrics">
                        {selectedFinding.evidence.map((item) => (
                          item.value ? (
                            <div
                              className={`sp-finding-metric${!isNumericEvidenceValue(item.value) || item.value.length > 16 ? ' sp-finding-metric--prose' : ''}`}
                              key={item.raw || `${item.label}:${item.value}`}
                            >
                              <span className="sp-finding-metric__label">{item.label}</span>
                              <span className="sp-finding-metric__value" title={item.value}>
                                {item.value}
                                {item.unit ? <small>{item.unit}</small> : null}
                              </span>
                              {item.path && !isInternalEvidencePath(item.path) ? (
                                <span className="sp-finding-metric__path" title={item.path}>{item.path}</span>
                              ) : null}
                            </div>
                          ) : (
                            <div className="sp-finding-note" key={item.raw || item.label}>
                              {item.raw || item.label}
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedFinding.caveats.length ? (
                    <div className="sp-finding-detail__section">
                      <div className="sp-finding-detail__section-label">Keep in mind</div>
                      <div className="sp-finding-caveats">
                        {selectedFinding.caveats.map((item) => (
                          <div className="sp-finding-caveat" key={item}>
                            <Info size={14} aria-hidden />
                            <p>{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="sp-finding-detail__actions">
                    {sourceIdFromFinding(selectedFinding.id) ? (
                      <Button
                        kind="primary"
                        onClick={() => jumpToSource(profilePath, sourceIdFromFinding(selectedFinding.id))}
                      >
                        Open call paths
                      </Button>
                    ) : null}
                    {selectedFinding.id.startsWith('spark.entity.') ? (
                      <Button
                        kind="ghost"
                        onClick={() => navigate({ tab: 'spark', profile: profilePath, view: 'world', source: null })}
                      >
                        Open World view
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyState title="No findings yet">
            The profile loaded, but this capture didn’t include findings.
          </EmptyState>
        )}
      </Section>

      {recommendations.length ? (
        <Section
          title="What to try next"
          hint="Ranked for this capture. Do #1 first, change one thing, then profile again."
        >
          <div className="sp-next-steps">
            {recommendations.slice(0, 4).map((row, index) => {
              const category = text(row.category, 'next');
              const severityTone = toneFor(text(row.severity));
              const iconTone = severityTone === 'danger' ? 'danger' : severityTone === 'warn' ? 'warn' : category === 'entities' ? 'warn' : category === 'mod' ? 'accent' : 'info';
              const actions = array<unknown>(row.actions ?? row.reversible_actions);
              const why = text(row.why);
              const modId = text(row.mod_id);
              const relatedFinding = text(row.related_finding_id);
              const isPrimary = index === 0;
              const StepIcon =
                category === 'entities' ? Activity
                  : category === 'mod' ? Package
                    : category === 'world' || category === 'chunk' ? Boxes
                      : Wrench;
              return (
                <div className={`relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-next-step${isPrimary ? ' is-primary' : ''} is-${severityTone}`}
                  key={`${text(row.id, text(row.title))}:${index}`}
                >
                  <div className="sp-next-step__inner">
                    <div className="sp-next-step__rank" aria-hidden="true">{index + 1}</div>
                    <div className="sp-next-step__body">
                      <div className="sp-next-step__meta">
                        <GlareIcon icon={StepIcon} tone={iconTone} />
                        <StatusPill tone={severityTone}>{category}</StatusPill>
                        {isPrimary ? <span className="sp-next-step__badge">Start here</span> : null}
                      </div>
                      <h3>{text(row.title)}</h3>
                      <p className="sp-next-step__detail">{text(row.detail)}</p>
                      {why ? (
                        <p className="sp-next-step__why">
                          <span>Why this</span>
                          {why}
                        </p>
                      ) : null}
                      {actions.length ? (
                        <ol className="sp-next-step__actions">
                          {actions.map((action) => (
                            <li key={text(action)}>{text(action)}</li>
                          ))}
                        </ol>
                      ) : null}
                      <div className="sp-next-step__footer">
                        {category === 'entities' || relatedFinding.startsWith('spark.entity.') ? (
                          <Button
                            kind={isPrimary ? 'primary' : 'default'}
                            onClick={() => navigate({ tab: 'spark', profile: profilePath, view: 'world', source: null })}
                          >
                            Open World view
                          </Button>
                        ) : null}
                        {category === 'mod' && modId ? (
                          <Button
                            kind={isPrimary ? 'primary' : 'default'}
                            onClick={() => jumpToSource(profilePath, modId)}
                          >
                            Jump to {modId}
                          </Button>
                        ) : null}
                        {relatedFinding && rows.some((finding) => finding.id === relatedFinding) ? (
                          <Button
                            kind="default"
                            onClick={() => selectFinding(relatedFinding)}
                          >
                            Related finding
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

export function SourcesView({
  profile,
  profilePath = '',
  onImport,
  onUpload,
}: {
  profile: UnknownRecord;
  profilePath?: string;
  onImport: (url: string) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}) {
  const [metric, setMetric] = useState<'own' | 'involvement'>('own');
  const [windowIndex, setWindowIndex] = useState(-1);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const windowIds = sourceWindowIds(profile);
  const rankedSources = (windowIndex >= 0 ? sourcesAtWindow(profile, windowIndex) : sources(profile))
    .slice()
    .sort((a, b) => (metric === 'own' ? b.ownPct - a.ownPct : b.involvementPct - a.involvementPct))
    .slice(0, 15)
    .map((source) => {
      const value = metric === 'own' ? source.ownPct : source.involvementPct;
      const altValue = metric === 'own' ? source.involvementPct : source.ownPct;
      return {
        id: source.id,
        label: source.label,
        detail: source.topLabel || `${source.methodCount} sampled methods`,
        value,
        altValue,
        altLabel: metric === 'own' ? 'on stack' : 'own code',
      };
    });
  const viewerUrl = text(profile.spark_viewer_url ?? record(profile.links).viewer);
  const rawUrl = text(profile.spark_raw_url ?? record(profile.links).raw);

  const importUrl = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      await onImport(url.trim());
      setMessage('Profile imported and selected.');
      setUrl('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      await onUpload(file);
      setMessage('Profile uploaded and selected.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-view-stack">
      <Section
        title="Where time went"
        hint="Which mods used the most sample time — not proof they caused lag."
        icon={NetworkIcon}
      >
        <div className="sp-source-panel">
          <div className="sp-source-toolbar">
            <div className="sp-source-toolbar__modes">
              <div className="sp-segmented" aria-label="How to rank mods">
                <button type="button" className={metric === 'own' ? 'is-active' : ''} onClick={() => setMetric('own')}>
                  Own code
                </button>
                <button
                  type="button"
                  className={metric === 'involvement' ? 'is-active' : ''}
                  onClick={() => setMetric('involvement')}
                >
                  On the stack
                </button>
              </div>
              <p className="sp-source-toolbar__hint">
                {metric === 'own'
                  ? 'Own code = time spent inside that mod (no double-counting).'
                  : 'On the stack = time when that mod appeared anywhere in the call chain (can overlap).'}
              </p>
            </div>
            {windowIds.length > 1 ? (
              <label className="sp-source-window">
                <span>Window</span>
                <select value={windowIndex} onChange={(event) => setWindowIndex(Number(event.target.value))}>
                  <option value={-1}>Full capture</option>
                  {windowIds.map((id, index) => (
                    <option key={`${id}:${index}`} value={index}>
                      Window {index + 1}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-source-rank">
            {rankedSources.length ? (
              rankedSources.map((source, index) => (
                <button
                  type="button"
                  className={`sp-source-rank__row${source.value >= 20 ? ' is-hot' : ''}`}
                  key={source.id}
                  onClick={() => jumpToSource(profilePath, source.id)}
                >
                  <span className="sp-source-rank__n" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="sp-source-rank__main">
                    <div className="sp-source-rank__head">
                      <strong title={source.label}>{source.label}</strong>
                      <code>{source.value.toFixed(2)}%</code>
                    </div>
                    <div className="sp-source-rank__track" aria-hidden="true">
                      <span style={{ width: `${Math.max(2, Math.min(100, source.value))}%` }} />
                    </div>
                    <div className="sp-source-rank__meta">
                      <span title={source.detail}>{source.detail}</span>
                      <code>
                        {source.altValue.toFixed(1)}% {source.altLabel}
                      </code>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState title="No mod breakdown">This profile didn’t include a per-mod time breakdown.</EmptyState>
            )}
          </div>
        </div>
      </Section>

      <Section title="Add a profile" hint="Paste a Spark URL or upload a .sparkprofile file from your server." className="sp-ingest-compact">
        <details className="sp-ingest-details">
          <summary>Import or upload another profile</summary>
          <div className="sp-ingest-row">
            <form className="sp-ingest-inline" onSubmit={(event) => void importUrl(event)}>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://spark.lucko.me/…"
                aria-label="Spark profile URL"
                required
              />
              <Button kind="primary" disabled={busy}>Import</Button>
            </form>
            <label className="sp-file-button">
              Upload file
              <input
                type="file"
                accept=".sparkprofile,application/octet-stream"
                disabled={busy}
                onChange={(event) => void upload(event.target.files?.[0])}
              />
            </label>
          </div>
          {message ? <p className="sp-form-message" role="status">{message}</p> : null}
        </details>
      </Section>

      <Section title="Capture on the server" hint="Run this while the lag is happening, then refresh this page." icon={TerminalIcon}>
        <CopyCommand />
      </Section>

      {(viewerUrl || rawUrl) ? (
        <Section title="Open in Spark" hint="Spark’s own viewer has the full detailed graph if you need more detail.">
          <div className="sp-link-row">
            {viewerUrl ? <a className="sp-link-button" href={viewerUrl} target="_blank" rel="noreferrer">Open Spark viewer <ExternalLink size={13} /></a> : null}
            {rawUrl ? <a className="sp-link-button" href={rawUrl} target="_blank" rel="noreferrer">Open raw profile <ExternalLink size={13} /></a> : null}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function timelineWindowLabel(row: ReturnType<typeof timeline>[number], index: number): string {
  if (row.at) return fmtDate(row.at);
  return `Window ${index + 1}`;
}

export function TimelineView({ profile }: { profile: UnknownRecord }) {
  const rows = timeline(profile);
  const bklitRows = timelineToBklitRows(profile);
  const singleWindow = rows.length <= 1;
  const context = record(profile.context);
  const stripRow = rows[0];
  const hasCpu = rows.some((row) => row.cpu > 0);
  const tpsMin = rows.length ? Math.min(...rows.map((row) => row.tps)) : 0;
  const tpsMax = rows.length ? Math.max(...rows.map((row) => row.tps)) : 0;
  const msptMin = rows.length ? Math.min(...rows.map((row) => row.mspt)) : 0;
  const msptMaxTypical = rows.length ? Math.max(...rows.map((row) => row.mspt)) : 0;

  return (
    <div className="sp-view-stack">
      {stripRow ? (
        <div className="sp-timeline-strip">
          {singleWindow ? (
            <>
              <MetricReadout label="TPS" value={stripRow.tps || numeric(context.tps_1m ?? context.tps)} size="sm" />
              <MetricReadout label="Typical tick" value={stripRow.mspt || numeric(context.mspt_mean_1m ?? context.mspt_p95_1m)} unit="ms" size="sm" />
              <MetricReadout label="Players" value={stripRow.players || numeric(context.players)} size="sm" format={(n) => n.toFixed(0)} />
            </>
          ) : (
            <>
              <MetricReadout label="Windows" value={rows.length} size="sm" format={(n) => n.toFixed(0)} />
              <MetricReadout label="TPS range" value={tpsMin} size="sm" format={() => `${tpsMin.toFixed(1)}–${tpsMax.toFixed(1)}`} />
              <MetricReadout label="Typical tick" value={msptMin} unit="ms" size="sm" format={() => `${msptMin.toFixed(0)}–${msptMaxTypical.toFixed(0)}`} />
            </>
          )}
          {hasCpu ? (
            <MetricReadout
              label="CPU"
              value={singleWindow ? stripRow.cpu : Math.max(...rows.map((row) => row.cpu))}
              unit="%"
              size="sm"
            />
          ) : null}
        </div>
      ) : null}
      <ChartFrame
        title="TPS and typical tick time"
        layer="sample"
        empty={!rows.length}
      >
        <WtAreaChart
          data={bklitRows}
          series={[
            { dataKey: 'tps', color: 'var(--wt-ch-tps)' },
            { dataKey: 'mspt', color: 'var(--wt-ch-mspt)' },
          ]}
          animationDuration={0}
          yDomainTweenDuration={0}
        />
      </ChartFrame>
      {singleWindow ? (
        <div className="sp-note"><Info size={14} /> This profile contains one aggregate window; multiple v2 windows render as a trend.</div>
      ) : null}
      <div className={`relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-timeline-table${hasCpu ? ' sp-timeline-table--cpu' : ''}`}>
        <div className="sp-table-head">
          <span>Window</span>
          <span>TPS</span>
          <span>Typical ms</span>
          <span>Peak ms</span>
          {hasCpu ? <span>CPU</span> : null}
          <span>Players</span>
          <span>Entities</span>
        </div>
        {rows.map((row, index) => (
            <div className="sp-table-row" key={`${row.at}:${index}`}>
              <span>{timelineWindowLabel(row, index)}</span>
              <code>{row.tps.toFixed(1)}</code>
              <code>{row.mspt.toFixed(1)} ms</code>
              <code>{row.msptMax > 0 ? `${row.msptMax.toFixed(1)} ms` : '—'}</code>
              {hasCpu ? <code>{row.cpu > 0 ? `${row.cpu.toFixed(1)}%` : '—'}</code> : null}
              <code>{row.players}</code>
              <code>{row.entities}</code>
            </div>
        ))}
      </div>
    </div>
  );
}

export function CallPathsView({
  profile,
  profilePath = '',
  initialSource = '',
}: {
  profile: UnknownRecord;
  profilePath?: string;
  initialSource?: string;
}) {
  const rows = methods(profile);
  const hasTree = array<unknown>(record(profile.call_tree).threads).length > 0;
  return (
    <Section title="What the server was doing" hint="All = full stack. Flat = hottest methods. Mods = broken down by mod." icon={ActivityIcon}>
      {hasTree || rows.length
        ? <CallTree profile={profile} profilePath={profilePath} initialSource={initialSource} />
        : <EmptyState title="No call paths">This capture didn’t include method stacks.</EmptyState>}
    </Section>
  );
}

function Fact({ label, value, stack = false }: { label: string; value: string | number; stack?: boolean }) {
  const empty = value === '' || value === null || value === undefined;
  return (
    <div className={`sp-fact${stack ? ' is-stack' : ''}`}>
      <span>{label}</span>
      <strong title={empty ? undefined : String(value)}>{empty ? '—' : value}</strong>
    </div>
  );
}

const HOTSPOT_VIRTUALIZE_THRESHOLD = 50;
const HOTSPOT_CARD_ESTIMATE = 220;
/** World cards stay scannable; Spark → Map owns the full spatial set. */
const WORLD_BUSY_CHUNK_CAP = 36;
const HOTSPOT_COL_MIN_PX = 224; /* ~14rem — match .sp-hotspot-grid */

function HotspotCard({
  row,
  onInspect,
}: {
  row: UnknownRecord;
  onInspect: (row: UnknownRecord) => void;
}) {
  const total = numeric(row.total_entities);
  const topCount = numeric(row.top_count);
  const density = total > 0 ? (topCount / total) * 100 : 0;
  const topLabel = entityTypeLabel(text(row.top_type));
  return (
    <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-hotspot-card">
      <StatusPill tone="warn">{worldDimensionLabel(text(row.dimension))}</StatusPill>
      <h3>
        Chunk {numeric(row.chunk_x)}, {numeric(row.chunk_z)}
      </h3>
      <p>
        Blocks ~{numeric(row.block_x_min)}..{numeric(row.block_x_max)}, {numeric(row.block_z_min)}..
        {numeric(row.block_z_max)}
      </p>
      <BarMeter
        label={`${topLabel} density`}
        value={density}
        valueLabel={`${topCount} / ${total}`}
        tone="warn"
      />
      <Fact label="Entities" value={total} />
      <Fact label="Most common" value={`${topLabel} × ${topCount}`} />
      <Fact
        label="Nearest player"
        value={
          row.nearest_player_chunk_distance != null
            ? `${numeric(row.nearest_player_chunk_distance)} chunks away`
            : numeric(row.same_dimension_players) === 0
              ? 'Nobody online in this world — it may still be loaded'
              : 'Unknown'
        }
      />
      <div className="sp-hotspot-card__actions">
        <Button kind="default" onClick={() => onInspect(row)}>
          Inspect chunk
        </Button>
      </div>
    </div>
  );
}

function HotspotGrid({
  hotspots,
  onInspect,
}: {
  hotspots: UnknownRecord[];
  onInspect: (row: UnknownRecord) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [lanes, setLanes] = useState(2);
  const virtualize = hotspots.length > HOTSPOT_VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: virtualize ? hotspots.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => HOTSPOT_CARD_ESTIMATE,
    overscan: 8,
    gap: 12,
    lanes: virtualize ? Math.max(1, lanes) : 1,
  });

  useEffect(() => {
    if (!virtualize) return undefined;
    const el = parentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const sync = () => {
      const next = Math.max(1, Math.floor(el.clientWidth / HOTSPOT_COL_MIN_PX));
      setLanes((prev) => (prev === next ? prev : next));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtualize]);

  if (!hotspots.length) {
    return <EmptyState title="No busy chunks listed">This capture didn’t include chunk entity maps.</EmptyState>;
  }

  if (!virtualize) {
    return (
      <div className="sp-hotspot-grid">
        {hotspots.map((row, index) => (
          <HotspotCard key={`${text(row.dimension)}:${numeric(row.chunk_x)}:${numeric(row.chunk_z)}:${index}`} row={row} onInspect={onInspect} />
        ))}
      </div>
    );
  }

  const colCount = Math.max(1, lanes);
  return (
    <div className="sp-hotspot-grid sp-hotspot-grid--virtual" ref={parentRef}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const row = hotspots[vRow.index];
          if (!row) return null;
          return (
            <div
              key={`${text(row.dimension)}:${numeric(row.chunk_x)}:${numeric(row.chunk_z)}:${vRow.index}`}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: `${(vRow.lane / colCount) * 100}%`,
                width: `calc(${100 / colCount}% - 0.55rem)`,
                paddingRight: 0,
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              <HotspotCard row={row} onInspect={onInspect} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WorldView({ profile }: { profile: UnknownRecord }) {
  const context = record(profile.context);
  const composition = record(context.entity_composition);
  const concentration = record(context.entity_concentration);
  const worlds = array<UnknownRecord>(context.worlds);
  const hotspots = array<UnknownRecord>(context.entity_hotspots);
  const players = array<UnknownRecord>(context.players_chunks);
  const pieSegments = compositionPieSegments(context);
  const concentrationRows = concentrationBarRows(context);
  const busiest = hotspots[0] ? record(hotspots[0]) : null;
  const [selectedHotspot, setSelectedHotspot] = useState<UnknownRecord | null>(null);

  useEffect(() => {
    if (!selectedHotspot) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedHotspot(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedHotspot]);

  return (
    <div className="sp-view-stack">
      <div className="sp-brief-grid">
        <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-brief-card">
          <div className="sp-brief-card__head">
            <GlareIcon icon={Activity} tone="warn" />
            <div>
              <div className="sp-eyebrow">Loaded entities</div>
              <h3>{numeric(context.world_entities)} loaded entities</h3>
            </div>
          </div>
          {pieSegments.length ? (
            <PieChart segments={pieSegments} />
          ) : Object.keys(composition).length ? null : (
            <EmptyState title="No composition data">This capture didn’t include entity breakdown.</EmptyState>
          )}
          {numeric(composition.automation_share_pct) > 0 ? (
            <Fact
              label="XP + items + glue"
              value={`${numeric(composition.automation_share_pct).toFixed(1)}% of loaded entities`}
            />
          ) : null}
          {numeric(composition.marker_share_pct) >= 5 ? (
            <Fact
              label="Markers"
              value={`${numeric(composition.marker_share_pct).toFixed(1)}% (${numeric(composition.markers).toLocaleString()})`}
            />
          ) : null}
          {text(composition.dominant_custom_id) ? (
            <Fact
              label="Top custom entity"
              value={`${text(composition.dominant_custom_id)} · ${numeric(composition.dominant_custom_share_pct).toFixed(1)}%`}
            />
          ) : null}
        </div>
        <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-brief-card sp-brief-card--crowded">
          <div className="sp-brief-card__head">
            <GlareIcon icon={Network} tone="info" />
            <div>
              <div className="sp-eyebrow">Crowded chunks</div>
              <h3>
                {numeric(concentration.chunks_with_entities).toLocaleString()} chunks with entities
              </h3>
            </div>
          </div>
          {concentrationRows.length ? (
            <div className="sp-crowded-bars">
              {concentrationRows.map((row) => (
                <div className={`sp-crowded-bar sp-crowded-bar--${row.tone || 'accent'}`} key={row.label}>
                  <div className="sp-crowded-bar__meta">
                    <span>{row.label}</span>
                    <code>{row.valueLabel ?? `${row.value.toFixed(1)}%`}</code>
                  </div>
                  <div className="sp-crowded-bar__track" aria-hidden="true">
                    <span style={{ width: `${Math.max(2, Math.min(100, row.value))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No concentration data">This capture didn’t include chunk packing stats.</EmptyState>
          )}
          <div className="sp-crowded-foot">
            <Fact label="Players located" value={players.length} />
            {busiest ? (
              <Fact
                label="Busiest chunk"
                value={`${worldDimensionLabel(text(busiest.dimension))} ${numeric(busiest.chunk_x)},${numeric(busiest.chunk_z)} · ${numeric(busiest.total_entities).toLocaleString()}`}
              />
            ) : null}
          </div>
        </div>
      </div>

      <p className="sp-world-footnote">
        Busy areas often mean lag risk — entity counts here don’t prove they made the server lag.
      </p>

      <Section title="Per-world totals" hint="How many entities each world had, plus the most common types.">
        {worlds.length ? (
          <div className="sp-world-grid">
            {[...worlds]
              .sort((a, b) => numeric(b.entities) - numeric(a.entities))
              .map((world) => {
                const id = text(world.id);
                const entities = numeric(world.entities);
                const share = numeric(world.share_pct);
                const tops = array<UnknownRecord>(world.top_entities).slice(0, 6);
                const topCount = tops.reduce((sum, row) => sum + numeric(row.count), 0);
                const leadTypeCount = Math.max(1, ...tops.map((row) => numeric(row.count)));
                return (
                  <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-world-card" key={id}>
                    <div className="sp-world-card__head">
                      <StatusPill tone={share >= 40 ? 'warn' : 'info'}>{worldDimensionLabel(id)}</StatusPill>
                      <span className="sp-world-card__share">
                        {share > 0 ? `${share.toFixed(1)}% of loaded` : 'Share unknown'}
                      </span>
                    </div>
                    <div className="sp-world-card__metric">
                      <strong>{entities.toLocaleString()}</strong>
                      <span>entities</span>
                    </div>
                    <div className="sp-world-card__bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(4, Math.min(100, share || 0))}%` }} />
                    </div>
                    {tops.length ? (
                      <div className="sp-world-card__types">
                        <div className="sp-eyebrow">Most common</div>
                        {tops.map((row, index) => {
                          const count = numeric(row.count);
                          const ofLead = (count / leadTypeCount) * 100;
                          const typeId = text(row.id);
                          return (
                            <div className="sp-world-type" key={`${id}:${typeId}`}>
                              <span className="sp-world-type__rank">{index + 1}</span>
                              <div className="sp-world-type__body">
                                <div className="sp-world-type__line">
                                  <span>{entityTypeLabel(typeId)}</span>
                                  <code>{count.toLocaleString()}</code>
                                </div>
                                <div
                                  className="sp-world-type__bar"
                                  aria-hidden="true"
                                  style={{ ['--sp-type-color' as string]: entityTypeBarColor(typeId) }}
                                >
                                  <span style={{ width: `${Math.max(4, Math.min(100, ofLead))}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {entities > topCount ? (
                          <p className="sp-world-card__note">
                            +{(entities - topCount).toLocaleString()} other entities in this world
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="sp-world-card__note">No top types listed for this world.</p>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <EmptyState title="No world totals">This capture didn’t include per-world entity counts.</EmptyState>
        )}
      </Section>

      <Section
        title="Busy chunks"
        hint={
          hotspots.length > WORLD_BUSY_CHUNK_CAP
            ? `Showing the ${WORLD_BUSY_CHUNK_CAP} busiest of ${hotspots.length}. Block ranges are approximate (chunk × 16). Spark → Map has the full heat map.`
            : 'Block ranges are approximate (chunk × 16). Open a chunk to see every entity type counted there.'
        }
      >
        <HotspotGrid hotspots={hotspots.slice(0, WORLD_BUSY_CHUNK_CAP)} onInspect={setSelectedHotspot} />
      </Section>

      {selectedHotspot ? (
        <ChunkDetailModal hotspot={selectedHotspot} onClose={() => setSelectedHotspot(null)} />
      ) : null}
    </div>
  );
}

export function ChunkDetailModal({
  hotspot,
  onClose,
}: {
  hotspot: UnknownRecord;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const total = numeric(hotspot.total_entities);
  const topType = text(hotspot.top_type);
  const topCount = numeric(hotspot.top_count);
  const counts = array<UnknownRecord>(hotspot.entity_counts)
    .map((row) => ({ id: text(row.id), count: numeric(row.count) }))
    .filter((row) => row.id && row.count > 0)
    .sort((a, b) => b.count - a.count);
  const typedTotal = counts.reduce((sum, row) => sum + row.count, 0);
  const density = total > 0 && topCount > 0 ? (topCount / total) * 100 : 0;
  const nearestChunks = hotspot.nearest_player_chunk_distance != null
    ? numeric(hotspot.nearest_player_chunk_distance)
    : null;
  const chunkX = numeric(hotspot.chunk_x);
  const chunkZ = numeric(hotspot.chunk_z);

  return createPortal(
    <div className="sp-chunk-modal" role="dialog" aria-modal="true" aria-label="Chunk entity details">
      <button type="button" className="sp-chunk-modal__backdrop" aria-label="Close dialog" onClick={onClose} />
      <BorderGlow
        className="sp-chunk-modal__glow"
        borderRadius={6}
        edgeSensitivity={26}
        glowRadius={20}
        coneSpread={18}
        animated
        backgroundColor="var(--wt-bg1)"
        glowColor="38 92 55"
        glowIntensity={0.48}
        colors={['#fbbf24', '#fb923c', '#f472b6']}
        fillOpacity={0.16}
      >
        <div className="sp-chunk-modal__panel">
          <FadeIn>
            <div className="sp-chunk-modal__head">
              <div className="sp-chunk-modal__identity">
                <GlareIcon icon={Activity} tone="warn" />
                <div>
                  <div className="sp-chunk-modal__eyebrow">
                    <StatusPill tone="warn">{worldDimensionLabel(text(hotspot.dimension))}</StatusPill>
                    <span className="sp-eyebrow">Busy chunk</span>
                  </div>
                  <h2>Chunk {chunkX}, {chunkZ}</h2>
                  <p>
                    Blocks ~{numeric(hotspot.block_x_min)}..{numeric(hotspot.block_x_max)},
                    {' '}{numeric(hotspot.block_z_min)}..{numeric(hotspot.block_z_max)}
                  </p>
                </div>
              </div>
              <Button kind="ghost" onClick={onClose} aria-label="Close">
                <X size={16} />
              </Button>
            </div>

            <div className="sp-chunk-modal__stats" aria-label="Chunk summary">
              <div className="sp-chunk-stat">
                <MetricReadout
                  label="Entities"
                  value={total}
                  size="sm"
                  format={(n) => Math.round(n).toLocaleString()}
                  tone={total >= 100 ? 'warn' : 'default'}
                />
              </div>
              <div className="sp-chunk-stat">
                <MetricReadout
                  label="Types listed"
                  value={counts.length}
                  size="sm"
                  format={(n) => Math.round(n).toLocaleString()}
                />
              </div>
              <div className="sp-chunk-stat">
                <MetricReadout
                  label="Top type share"
                  value={density}
                  unit="%"
                  size="sm"
                  format={(n) => n.toFixed(0)}
                  tone={density >= 50 ? 'warn' : 'default'}
                />
              </div>
              <div className="sp-chunk-stat">
                {nearestChunks != null ? (
                  <MetricReadout
                    label="Nearest player"
                    value={nearestChunks}
                    unit="chunks"
                    size="sm"
                    format={(n) => Math.round(n).toLocaleString()}
                    tone={nearestChunks >= 24 ? 'warn' : 'default'}
                  />
                ) : (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">Nearest player</div>
                    <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-wt-text">
                      {numeric(hotspot.same_dimension_players) === 0 ? 'Nobody online' : 'Unknown'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {topType ? (
              <div className="sp-chunk-modal__lead">
                <div className="sp-chunk-modal__lead-head">
                  <GlareIcon icon={Boxes} tone="warn" />
                  <div>
                    <span className="sp-eyebrow">Most common</span>
                    <p>
                      <strong>{entityTypeLabel(topType)}</strong>
                      <code>{topCount.toLocaleString()}</code>
                      <span>{density > 0 ? `${density.toFixed(1)}% of this chunk` : ''}</span>
                    </p>
                    <code className="sp-chunk-modal__raw">{topType}</code>
                  </div>
                </div>
                <BarMeter
                  label="Share of chunk"
                  value={density}
                  valueLabel={`${density.toFixed(1)}%`}
                  tone="warn"
                />
              </div>
            ) : null}

            <div className="sp-chunk-modal__list-wrap">
              <div className="sp-chunk-modal__list-head">
                <span>Entity type</span>
                <span>Count</span>
                <span>Share</span>
              </div>
              {counts.length ? (
                <AnimatedList
                  className="sp-chunk-modal__list"
                  items={counts}
                  getKey={(row) => row.id}
                  enableArrowNavigation={false}
                  showGradients={counts.length > 6}
                  displayScrollbar={counts.length > 8}
                  renderItem={(row) => {
                    const share = total > 0 ? (row.count / total) * 100 : 0;
                    return (
                      <div className="sp-chunk-modal__row">
                        <div className="sp-chunk-modal__type">
                          <strong>{entityTypeLabel(row.id)}</strong>
                          <code>{row.id}</code>
                          <div className="sp-chunk-modal__bar" aria-hidden="true">
                            <span style={{ width: `${Math.max(2, Math.min(100, share))}%` }} />
                          </div>
                        </div>
                        <code>{row.count.toLocaleString()}</code>
                        <span>{share.toFixed(1)}%</span>
                      </div>
                    );
                  }}
                />
              ) : (
                <EmptyState title="No type breakdown">
                  This chunk hotspot didn’t include a full entity count list.
                </EmptyState>
              )}
            </div>

            {counts.length && typedTotal < total ? (
              <p className="sp-chunk-modal__note">
                Listed types add up to {typedTotal.toLocaleString()} of {total.toLocaleString()} entities.
              </p>
            ) : (
              <p className="sp-chunk-modal__note">
                Counts come from Spark’s chunk entity map for this capture — not proof this chunk caused lag.
              </p>
            )}
          </FadeIn>
        </div>
      </BorderGlow>
    </div>,
    document.body,
  );
}

export function TechnicalView({ profile }: { profile: UnknownRecord }) {
  const context = record(profile.context);
  const system = record(profile.system);
  const memory = record(system.memory);
  const cpu = record(system.cpu);
  const gc = record(system.gc);
  const network = record(system.network);
  const heap = record(context.jvm_heap);
  const ping = record(context.ping_15m);
  const platform = record(profile.platform);
  const capture = record(profile.capture);
  const settings = record(capture.profiler_settings);
  const selected = record(capture.selected_server_properties);
  const datapacksFromContext = array<UnknownRecord>(context.datapacks);
  const datapacks = datapacksFromContext.length
    ? datapacksFromContext
    : array<UnknownRecord>(capture.datapacks);
  const windowData = record(profile.window);
  const callTree = record(profile.call_tree);
  const heapSummary = record(profile.heap_summary);
  const heapEntries = array<UnknownRecord>(heapSummary.top_entries);
  const threads = array<unknown>(profile.threads_analyzed);
  const introReady = useDeferredIntro(true);
  const cpuPercent = text(cpu.usage_unit) === 'percent'
    ? numeric(cpu.process_1m)
    : numeric(cpu.process_1m) * 100;
  const usedMb = numeric(heap.used_mb);
  const maxMb = numeric(heap.max_mb);
  const ramUsed = numeric(memory.physical_used_gb);
  const ramTotal = numeric(memory.physical_total_gb);
  const swapUsed = numeric(memory.swap_used_gb);
  const swapTotal = numeric(memory.swap_total_gb);
  const swapPct = swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0;
  const ramPct = ramTotal > 0 ? (ramUsed / ramTotal) * 100 : 0;
  const gcCount = numeric(gc.total_collections);
  const pingMean = numeric(ping.mean);
  const dialSize = 128;
  const settingEntries = adviseServerSettings(selected, profile);
  const threadList = threads.map((value) => text(value)).filter(Boolean).join(', ') || '—';
  const datapackCount = datapacks.filter((row) => text(row.id) !== '_truncated').length;
  const datapacksTruncated = datapacks.some((row) => text(row.id) === '_truncated');
  const hostExtras = [
    text(cpu.model) ? { label: 'CPU model', value: text(cpu.model), stack: true } : null,
    numeric(network.tx_mb_per_sec_mean) > 0
      ? { label: 'TX mean', value: `${numeric(network.tx_mb_per_sec_mean).toFixed(2)} MB/s`, stack: false }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; stack: boolean }>;

  return (
    <div className="sp-view-stack sp-tech">
      <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-lead sp-tech-host">
        <div className="sp-lead__head">
          <div className="sp-lead__copy">
            <div className="sp-eyebrow">Host snapshot</div>
            <h3>CPU, heap, and memory during this capture</h3>
            <p>These numbers describe the machine while Spark was sampling — useful context, not a full capacity report.</p>
          </div>
        </div>
        {introReady ? (
          <FadeIn>
            <div className="sp-tech-vitals" aria-label="Host vitals">
              <div className="sp-tech-gauges">
                <div className="sp-tech-gauge">
                  <WtCpuGauge value={cpuPercent} size={dialSize} />
                </div>
                <div className="sp-tech-gauge">
                  <WtHeapGauge usedMb={usedMb} maxMb={maxMb} size={dialSize} />
                </div>
                <div
                  className="sp-tech-gauge"
                  title={`${ramUsed.toFixed(2)} / ${ramTotal.toFixed(2)} GiB`}
                >
                  <WtGauge
                    value={ramPct}
                    label="RAM"
                    suffix="%"
                    centerValue={Number(ramPct.toFixed(0))}
                    tone={ramPct >= 90 ? 'danger' : ramPct >= 75 ? 'warn' : 'accent'}
                    size={dialSize}
                  />
                </div>
                <div
                  className="sp-tech-gauge"
                  title={`${swapUsed.toFixed(2)} / ${swapTotal.toFixed(2)} GiB`}
                >
                  <WtGauge
                    value={swapPct}
                    label="Swap"
                    suffix="%"
                    centerValue={Number(swapPct.toFixed(0))}
                    tone={swapPct >= 50 ? 'danger' : swapPct >= 20 ? 'warn' : 'ok'}
                    size={dialSize}
                  />
                </div>
                {gcCount > 0 ? (
                  <div
                    className="sp-tech-gauge"
                    title={`${gcCount.toLocaleString()} collections during capture`}
                  >
                    <WtGauge
                      value={Math.min(gcCount, 2000)}
                      max={2000}
                      label="GC"
                      suffix=""
                      centerValue={gcCount}
                      tone={gcCount >= 1000 ? 'warn' : 'accent'}
                      size={dialSize}
                    />
                  </div>
                ) : null}
                {pingMean > 0 ? (
                  <div className="sp-tech-gauge">
                    <WtGauge
                      value={Math.min(pingMean, 250)}
                      max={250}
                      label="Ping"
                      suffix="ms"
                      centerValue={Number(pingMean.toFixed(0))}
                      tone={pingMean >= 150 ? 'danger' : pingMean >= 80 ? 'warn' : 'ok'}
                      size={dialSize}
                    />
                  </div>
                ) : null}
              </div>
              <p className="sp-tech-vitals__note">
                Heap is JVM memory · RAM/Swap are host physical memory
                {ramTotal > 0 ? ` · RAM ${ramUsed.toFixed(1)}/${ramTotal.toFixed(1)} GiB` : ''}
                {swapTotal > 0 ? ` · Swap ${swapUsed.toFixed(1)}/${swapTotal.toFixed(1)} GiB` : ''}
              </p>
            </div>
          </FadeIn>
        ) : (
          <div className="sp-skeleton sp-skeleton--hero" aria-hidden />
        )}
      </div>

      <div className="sp-tech-mid">
        <Section title="Selected server settings" hint="Adaptive advice from this capture’s CPU, heap, RAM, and player load. Try changing one setting at a time.">
          {settingEntries.length ? (
            <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-tech-settings-table">
              <div className="sp-table-head">
                <span>Setting</span>
                <span>Current</span>
                <span>Recommended</span>
                <span>Usual band</span>
                <span>Advice</span>
              </div>
              {settingEntries.map((row) => (
                <div className={`sp-table-row is-${row.tone}`} key={row.key} title={row.hint}>
                  <div className="sp-tech-setting-name">
                    <strong>{row.title}</strong>
                    <code>{row.key}</code>
                  </div>
                  <code>{row.current || '—'}</code>
                  <code className={row.tone === 'warn' ? 'is-diff' : undefined}>{row.recommended}</code>
                  <span>{row.band || '—'}</span>
                  <span className="sp-tech-setting-advice">{row.hint}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="sp-tech-quiet">No server.properties settings were captured in this profile.</p>
          )}
        </Section>

        <Section title="How this profile was taken" hint="Useful if you need to reproduce or compare this capture." icon={FileTextIcon}>
          <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-tech-meta">
            <div className="sp-tech-meta__path">
              <span>Source path</span>
              <code title={text(profile.source_path)}>{text(profile.source_path) || '—'}</code>
            </div>
            <div className="sp-tech-meta__grid">
              <div className="sp-tech-meta__group">
                <div className="sp-tech-meta__title">Capture</div>
                <Fact label="Captured" value={profile.captured_at ? fmtDate(text(profile.captured_at)) : '—'} />
                <Fact label="Creator" value={`${text(capture.creator, 'unknown')} (${text(capture.creator_type, 'unknown')})`} />
                <Fact label="Mode" value={text(profile.mode ?? platform.mode)} />
                <Fact label="File size" value={profile.size_bytes ? fmtBytes(numeric(profile.size_bytes)) : 'Not reported'} />
              </div>
              <div className="sp-tech-meta__group">
                <div className="sp-tech-meta__title">Platform</div>
                <Fact label="Minecraft" value={text(platform.minecraft)} />
                <Fact label="Loader" value={`${text(platform.loader)} ${text(platform.loader_version)}`.trim()} />
              </div>
              <div className="sp-tech-meta__group">
                <div className="sp-tech-meta__title">Profiler</div>
                <Fact label="Engine" value={text(settings.engine ?? profile.engine)} />
                <Fact label="Aggregator" value={text(settings.aggregator)} />
                <Fact label="Thread filter" value={text(settings.thread_filter)} />
                <Fact label="Interval" value={`${numeric(settings.interval_us ?? windowData.sample_interval_us)} µs`} />
                <Fact label="Analyzed threads" value={threadList} stack />
                <Fact label="Tree value unit" value={text(callTree.value_unit, text(profile.mode) === 'allocation' ? 'bytes' : 'ms')} />
                <Fact label="Analysis schema" value={`v${numeric(profile.analysis_version, 1)}`} />
              </div>
              {hostExtras.length ? (
                <div className="sp-tech-meta__group">
                  <div className="sp-tech-meta__title">Host</div>
                  {hostExtras.map((row) => (
                    <Fact key={row.label} label={row.label} value={row.value} stack={row.stack} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </Section>
      </div>

      <Section
        title="Heap dump (optional)"
        hint="Only shown when a matching .sparkheap file was taken within about 15 minutes."
        className="sp-section-quiet"
      >
        {heapEntries.length ? (
          <div className="sp-tech-props sp-tech-props--heap">
            {heapEntries.slice(0, 12).map((row, index) => (
              <div className="sp-tech-prop" key={`${text(row.type)}:${index}`}>
                <span>{text(row.type)}</span>
                <code>
                  {numeric(row.size_mb).toFixed(1)} MB · {numeric(row.instances)} instances · {text(row.mod_id, 'unknown')}
                </code>
              </div>
            ))}
          </div>
        ) : (
          <p className="sp-tech-notice">
            No nearby heap dump. A normal CPU profile is not treated as memory proof by itself.
          </p>
        )}
      </Section>

      {datapacks.length ? (
        <Section
          title="Datapacks"
          hint="Loaded packs Spark reported for this capture (capped list)."
          className="sp-section-quiet"
        >
          <div className="sp-tech-props">
            <div className="sp-tech-prop">
              <span>Count</span>
              <code>{`${datapackCount}${datapacksTruncated ? '+' : ''}`}</code>
            </div>
            {datapacks.slice(0, 16).map((row) => (
              <div className="sp-tech-prop" key={text(row.id)}>
                <span>{text(row.name, text(row.id))}</span>
                <code>{`${text(row.id)}${text(row.source) ? ` · ${text(row.source)}` : ''}`}</code>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

function comparisonMetric(profile: UnknownRecord, id: string): number {
  const context = record(profile.context);
  if (id === 'tps') return numeric(context.tps_1m ?? context.tps);
  if (id === 'mspt') return numeric(context.mspt_p95_1m ?? context.mspt_p95);
  if (id === 'players') return numeric(context.players);
  if (id === 'entities') return numeric(context.world_entities ?? context.entities);
  return profileDuration(profile);
}

export function CompareView({
  profile,
  currentPath,
  profiles,
}: {
  profile: UnknownRecord;
  currentPath: string;
  profiles: SparkSummary[];
}) {
  const alternatives = profiles.filter((item) => item.sourcePath !== currentPath && item.status === 'ready');
  const [otherPath, setOtherPath] = useState(alternatives[0]?.sourcePath ?? '');
  useEffect(() => {
    if (alternatives.some((item) => item.sourcePath === otherPath)) return;
    setOtherPath(alternatives[0]?.sourcePath ?? '');
  }, [alternatives, otherPath]);
  const otherQ = useQuery({
    queryKey: ['spark-profile', otherPath],
    queryFn: () => api.sparkProfile(otherPath),
    enabled: Boolean(otherPath),
  });
  const compareQ = useQuery({
    queryKey: ['spark-compare', otherPath, currentPath],
    queryFn: () => api.compareSparkProfiles(otherPath, currentPath),
    enabled: Boolean(otherPath),
  });
  const other = unwrapProfile(otherQ.data);
  const comparison = record(compareQ.data);
  const serverWarnings = array<unknown>(comparison.warnings).map((value) => text(value)).filter(Boolean);
  const localCompatibility = otherPath ? profileCompatibility(profile, other) : [];
  const compatibility = serverWarnings.length ? serverWarnings : localCompatibility;
  const compatible = comparison.compatible !== false && !localCompatibility.some((warning) =>
    warning.startsWith('Capture mode') || warning.startsWith('Thread scope'),
  );
  const metricRows = [
    { id: 'tps', label: 'TPS', lowerBetter: false },
    { id: 'mspt', label: 'Slow ticks (p95)', lowerBetter: true },
    { id: 'players', label: 'Players', lowerBetter: false },
    { id: 'entities', label: 'Entities', lowerBetter: true },
    { id: 'duration', label: 'Duration', lowerBetter: false },
  ];
  const leftSources = sources(profile).slice(0, 8);
  const rightSources = sources(other);

  return (
    <div className="sp-view-stack">
      <Section title="Compare two captures" hint="We check that both profiles used a similar capture mode before you trust the differences.">
        <label className="sp-compare-picker">
          Compare this profile with
          <select value={otherPath} onChange={(event) => setOtherPath(event.target.value)}>
            {alternatives.map((item) => <option key={item.sourcePath} value={item.sourcePath}>{item.sourceFile}</option>)}
          </select>
        </label>
      </Section>
      {!alternatives.length ? <EmptyState title="No other profile yet">Add another successful capture first.</EmptyState> : null}
      {otherQ.isLoading ? <div className="sp-skeleton" /> : null}
      {otherQ.isError ? <EmptyState title="Couldn’t load comparison">{(otherQ.error as Error).message}</EmptyState> : null}
      {otherPath && otherQ.data ? (
        <>
          <div className={`relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-alert-card${!compatible || compatibility.length ? ' is-warning' : ' is-ok'}`}>
            {!compatible || compatibility.length ? <Info size={14} /> : <CheckCircle2 size={14} />}
            <p>
              {!compatible
                ? `Not comparable: ${compatibility.join(' · ')}`
                : compatibility.length
                  ? `Compatible with caveats: ${compatibility.join(' · ')}`
                  : 'These captures look comparable'}
            </p>
          </div>
          <div className="sp-compare-metric-grid">
            {metricRows.map((metric) => {
              const left = comparisonMetric(profile, metric.id);
              const right = comparisonMetric(other, metric.id);
              const delta = left - right;
              const deltaClass = delta === 0
                ? 'sp-compare-metric__delta'
                : (delta < 0) === metric.lowerBetter
                  ? 'sp-compare-metric__delta is-better'
                  : 'sp-compare-metric__delta is-worse';
              return (
                <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-compare-metric" key={metric.id}>
                  <div className="sp-eyebrow">{metric.label}</div>
                  <div className="sp-compare-metric__pair">
                    <MetricReadout label="Current" value={left} size="sm" />
                    <MetricReadout label="Other" value={right} size="sm" />
                  </div>
                  <code className={deltaClass}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}</code>
                </div>
              );
            })}
          </div>
          <Section title="How mods changed" hint="Each mod’s own-code % vs the other profile.">
            <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-compare-mods">
              <CompareBars
                rows={leftSources.map((source) => ({
                  label: source.label,
                  current: source.ownPct,
                  previous: rightSources.find((item) => item.id === source.id)?.ownPct ?? 0,
                }))}
              />
            </div>
          </Section>
          {array<UnknownRecord>(comparison.config_deltas).length ? (
            <Section title="Settings that changed" hint="server.properties values that differ between the two profiles.">
              <div className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)] overflow-hidden sp-facts-card">
                {array<UnknownRecord>(comparison.config_deltas).map((row) => (
                  <Fact
                    key={text(row.key)}
                    label={text(row.key)}
                    value={`${text(row.baseline, '—')} → ${text(row.target, '—')}`}
                  />
                ))}
              </div>
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function profileState(profile: UnknownRecord, summary: SparkSummary | undefined) {
  const duration = profileDuration(profile);
  const settings = record(record(profile.capture).profiler_settings);
  return {
    stale: summary ? !summary.fresh : !truthy(profile.fresh, true),
    short: duration > 0 && duration < 20,
    tickFiltered: numeric(settings.tick_length_threshold) > 0,
    truncated: truthy(record(profile.call_tree).truncated),
    duration,
  };
}
