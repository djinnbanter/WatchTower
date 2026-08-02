import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CheckCircle2, ChevronRight, Copy, Layers, X } from '@/ui/icons';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { navigate } from '@/app/router';
import { Sparkline } from '@/ui/charts';
import { Stagger } from '@/ui/motion';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { asArray, asRecord, fmtDate, num, str } from '@/lib/utils';
import {
  DETAIL_PANELS,
  KIND_FILTERS,
  dayKeyForGroup,
  formatAge,
  formatInboxDayLabel,
  groupEnrichedByDay,
  groupSeverityTone,
  groupTitle,
  kindChip,
  leadMember,
  todayDayKey,
  truncate,
  type DetailPanel,
  type EnrichedCrash,
  type KindFilter,
} from './helpers';
import { bareFile } from './groups';
import { buildFixPlan, formatConfidenceLabel } from './fix-plan';

const VIRTUALIZE_THRESHOLD = 50;
const CRASH_ROW_ESTIMATE = 78;

function confidenceTone(label: string | null): 'ok' | 'warn' | 'neutral' {
  if (label === 'High') return 'ok';
  if (label === 'Medium') return 'warn';
  return 'neutral';
}

function CrashGroupRow({
  row,
  activeFp,
  onSelect,
  onSelectFile,
}: {
  row: EnrichedCrash;
  activeFp: string | null;
  onSelect: (fp: string) => void;
  onSelectFile: (file: string | null) => void;
}) {
  const rowChip = kindChip(row.group, row.summary);
  const title = groupTitle(row.group, row.summary);
  const cause = truncate(
    str(row.summary.plain_english) || str(row.summary.display_label),
    110,
  );
  const rowConf = formatConfidenceLabel(row.summary.confidence);
  const selected = row.group.fingerprint === activeFp;
  const sev = groupSeverityTone(row.group, row.summary);
  return (
    <button
      type="button"
      className={`cr-row${selected ? ' is-selected' : ''}${row.group.unreviewed <= 0 ? ' is-acked' : ''}`}
      data-sev={sev}
      onClick={() => {
        onSelect(row.group.fingerprint);
        onSelectFile(leadMember(row.group)?.file ?? null);
      }}
    >
      <Layers size={15} className="cr-row__icon" />
      <div className="min-w-0 flex-1">
        <div className="cr-row__title">{title}</div>
        {cause ? <p className="cr-row__cause">{cause}</p> : null}
        <div className="cr-row__meta">
          <StatusPill
            tone={
              rowChip.tone === 'danger'
                ? 'danger'
                : rowChip.tone === 'warn'
                  ? 'warn'
                  : 'neutral'
            }
          >
            {rowChip.label}
          </StatusPill>
          {rowConf ? <StatusPill tone={confidenceTone(rowConf)}>{rowConf}</StatusPill> : null}
          <span>{row.group.count}×</span>
          <span>{formatAge(row.group.last_at)}</span>
        </div>
      </div>
      <ChevronRight size={16} className="cr-row__chevron" />
    </button>
  );
}

function CrashDayItems({
  items,
  activeFp,
  onSelect,
  onSelectFile,
}: {
  items: EnrichedCrash[];
  activeFp: string | null;
  onSelect: (fp: string) => void;
  onSelectFile: (file: string | null) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualize = items.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: virtualize ? items.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CRASH_ROW_ESTIMATE,
    overscan: 10,
  });

  if (!virtualize) {
    return (
      <div className="cr-day__items">
        {items.map((row) => (
          <CrashGroupRow
            key={row.group.fingerprint}
            row={row}
            activeFp={activeFp}
            onSelect={onSelect}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="cr-day__items cr-day__items--virtual" ref={parentRef}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const row = items[vRow.index];
          if (!row) return null;
          return (
            <div
              key={row.group.fingerprint}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              <CrashGroupRow
                row={row}
                activeFp={activeFp}
                onSelect={onSelect}
                onSelectFile={onSelectFile}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function openExternal(url: string | null | undefined) {
  if (!url) return;
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    /* ignore */
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

function TechSection({
  title,
  hint,
  rows,
}: {
  title: string;
  hint?: string;
  rows: { label: string; value: ReactNode }[];
}) {
  if (!rows.length) return null;
  return (
    <section className="cr-section">
      <div className="cr-section__head">
        <h4>{title}</h4>
        {hint ? <p>{hint}</p> : null}
      </div>
      <dl className="cr-tech">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CrashLogPanel({ file }: { file: string }) {
  const [open, setOpen] = useState(false);
  const reportQ = useQuery({
    queryKey: ['crash-report', file],
    queryFn: () => api.crashReport(file),
    enabled: open && !!file,
  });
  const reportBody =
    typeof reportQ.data === 'string'
      ? reportQ.data
      : str(asRecord(reportQ.data).content, '');
  const truncated = reportBody.length > 12_000;
  const shown = reportBody.slice(0, 12_000);

  return (
    <div className="cr-log">
      <div className="cr-log__actions">
        <Button onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide crash file' : 'View log'}
        </Button>
        {open && shown ? (
          <Button onClick={() => void copyText(shown)}>
            <Copy size={14} className="mr-1.5" />
            Copy
          </Button>
        ) : null}
      </div>
      {open ? (
        reportQ.isLoading ? (
          <p className="cr-ctx-loading">Loading crash file…</p>
        ) : shown ? (
          <>
            <pre className="cr-report">{shown}</pre>
            {truncated ? (
              <p className="cr-log__trunc">Showing first 12k characters.</p>
            ) : null}
          </>
        ) : (
          <EmptyState title="No crash file">Preview text is not available for this file.</EmptyState>
        )
      ) : null}
    </div>
  );
}

function EvidencePanel({
  row,
  file,
  onSelectFile,
  onAckFile,
  marking,
  mode,
}: {
  row: EnrichedCrash;
  file: string;
  onSelectFile: (file: string) => void;
  onAckFile: (file: string, reviewed: boolean) => void;
  marking: boolean;
  mode: 'review' | 'reviewed';
}) {
  const canWrite = useCanWrite();
  const ctxQ = useQuery({
    queryKey: ['crash-context', file],
    queryFn: () => api.crashContext(file),
    enabled: !!file,
  });
  const lead = leadMember(row.group);
  const incidents = row.group.incident_ids ?? [];

  const pre = asRecord(asRecord(ctxQ.data).pre_crash);
  const series = asRecord(pre.series);
  const samples = asArray<Record<string, unknown> | number>(
    pre.tps_samples ?? series.tps ?? asRecord(pre.tps).points,
  );
  const events = asArray<Record<string, unknown>>(pre.events).slice(0, 8);
  const tpsValues = samples
    .map((s) => (typeof s === 'number' ? s : num((s as Record<string, unknown>).v)))
    .filter((v) => v != null && !Number.isNaN(v));
  const tpsMin = tpsValues.length ? Math.min(...tpsValues) : null;
  const tpsMax = tpsValues.length ? Math.max(...tpsValues) : null;
  const windowMinutes = num(pre.window_minutes) || null;
  const hasCtx = !!pre && Object.keys(pre).length > 0;
  const hasData = tpsValues.length > 0 || events.length > 0;

  return (
    <div className="cr-evidence">
      <div className="cr-members">
        <div className="cr-members__label">Files in group</div>
        <ul>
          {row.group.members.map((m) => {
            const isLead = lead?.file === m.file;
            const active = m.file === file;
            return (
              <li key={m.file} className={`cr-member${active ? ' is-active' : ''}${m.acknowledged ? ' is-acked' : ''}`}>
                <button type="button" className="cr-member__pick" onClick={() => onSelectFile(m.file)}>
                  <span className="cr-member__file font-mono">{bareFile(m.file)}</span>
                  <span className="cr-member__meta">
                    {isLead ? <StatusPill tone="info">Lead</StatusPill> : null}
                    {m.acknowledged ? <StatusPill tone="ok">Reviewed</StatusPill> : (
                      <StatusPill tone="warn">Open</StatusPill>
                    )}
                    <span>{formatAge(m.time)}</span>
                  </span>
                </button>
                {mode === 'review' && !m.acknowledged ? (
                  <Button
                    disabled={!canWrite || marking}
                    title={canWrite ? undefined : VIEW_ONLY_TITLE}
                    onClick={() => onAckFile(m.file, true)}
                  >
                    Ack
                  </Button>
                ) : mode === 'reviewed' || m.acknowledged ? (
                  <Button
                    disabled={!canWrite || marking}
                    title={canWrite ? undefined : VIEW_ONLY_TITLE}
                    onClick={() => onAckFile(m.file, false)}
                  >
                    Undo
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <CrashLogPanel file={file} />

      {ctxQ.isLoading ? <p className="cr-ctx-loading">Loading context…</p> : null}
      {!ctxQ.isLoading && (!hasCtx || !hasData) ? (
        <EmptyState title="No pre-crash context">
          No TPS samples or events for this file yet — Scanning enriches context on the next pass.
        </EmptyState>
      ) : null}
      {!ctxQ.isLoading && hasCtx && hasData ? (
        <>
          <div className="cr-evidence__meta">
            {windowMinutes ? <StatusPill tone="neutral">{windowMinutes}m window</StatusPill> : null}
            {tpsValues.length ? (
              <StatusPill tone="neutral">{tpsValues.length} TPS samples</StatusPill>
            ) : null}
            {events.length ? <StatusPill tone="neutral">{events.length} events</StatusPill> : null}
          </div>
          {tpsValues.length ? (
            <div className="cr-evidence__spark">
              <div className="cr-evidence__spark-head">
                <strong>TPS trend</strong>
                <span>
                  min {tpsMin?.toFixed?.(1) ?? tpsMin ?? '—'} · max {tpsMax?.toFixed?.(1) ?? tpsMax ?? '—'}
                </span>
              </div>
              <Sparkline series={tpsValues} tone="warn" />
            </div>
          ) : null}
          {events.length ? (
            <div className="cr-evidence__events">
              <strong>Events before crash</strong>
              <ul>
                {events.map((ev, i) => (
                  <li key={i}>
                    <span className="cr-evidence__ev-type">{str(ev.type || ev.kind, 'event')}</span>
                    {str(ev.detail) ? (
                      <span className="cr-evidence__ev-detail">{str(ev.detail)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {incidents.length ? (
        <div className="cr-incidents">
          <div className="cr-members__label">Linked incidents</div>
          <div className="cr-incidents__chips">
            {incidents.map((id) => (
              <StatusPill key={id} tone="neutral">
                {id}
              </StatusPill>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailsPanel({ row, file }: { row: EnrichedCrash; file: string }) {
  const { group, summary } = row;
  const member = group.members.find((m) => bareFile(m.file) === bareFile(file)) || leadMember(group);
  const javaMismatch = asRecord(summary.java_mismatch);

  const identity = [
    { label: 'Fingerprint', value: <code className="break-all text-[11px]">{group.fingerprint}</code> },
    str(summary.exception)
      ? { label: 'Exception', value: <code className="break-all text-xs">{str(summary.exception)}</code> }
      : null,
    str(summary.failure_kind || group.failure_kind)
      ? { label: 'Kind', value: str(summary.failure_kind || group.failure_kind) }
      : null,
    { label: 'Lead file', value: <code className="text-xs">{bareFile(file)}</code> },
    str(summary.mod_file)
      ? { label: 'Mod file', value: <code className="text-xs">{str(summary.mod_file)}</code> }
      : null,
    member?.time ? { label: 'When', value: fmtDate(member.time) } : null,
    str(summary.primary_mod_id || summary.suspect_mod_id)
      ? { label: 'Primary mod', value: str(summary.primary_mod_id || summary.suspect_mod_id) }
      : null,
    str(summary.paired_primary_file)
      ? {
          label: 'Paired file',
          value: <code className="text-xs">{str(summary.paired_primary_file)}</code>,
        }
      : null,
  ].filter(Boolean) as { label: string; value: ReactNode }[];

  const classification = [
    str(summary.matched_rule_id)
      ? {
          label: 'Rule',
          value: (
            <>
              <code>{str(summary.matched_rule_id)}</code>
              {str(summary.matched_pack_id) ? (
                <span className="text-wt-text-low"> ({str(summary.matched_pack_id)})</span>
              ) : null}
            </>
          ),
        }
      : null,
    str(summary.ecosystem) ? { label: 'Ecosystem', value: str(summary.ecosystem) } : null,
    str(summary.oom_kind) ? { label: 'OOM kind', value: str(summary.oom_kind) } : null,
    Object.keys(javaMismatch).length
      ? {
          label: 'Java mismatch',
          value: `compiled ${str(javaMismatch.compiled_java, '?')} / runtime ${str(javaMismatch.runtime_java, '?')}`,
        }
      : null,
  ].filter(Boolean) as { label: string; value: ReactNode }[];

  const mixinsConfig = [
    str(summary.mixin_config)
      ? { label: 'Mixin config', value: <code className="text-xs">{str(summary.mixin_config)}</code> }
      : null,
    str(summary.mixin_config_conflict)
      ? {
          label: 'Conflict config',
          value: <code className="text-xs">{str(summary.mixin_config_conflict)}</code>,
        }
      : null,
    str(summary.conflict_mod_id) ? { label: 'Conflict mod', value: str(summary.conflict_mod_id) } : null,
    str(summary.invalid_location)
      ? {
          label: 'Invalid location',
          value: <code className="text-xs">{str(summary.invalid_location)}</code>,
        }
      : null,
    str(summary.config_file || summary.config_path)
      ? {
          label: 'Config',
          value: <code className="text-xs">{str(summary.config_file || summary.config_path)}</code>,
        }
      : null,
  ].filter(Boolean) as { label: string; value: ReactNode }[];

  const dupMods = Array.isArray(summary.duplicate_mod_ids)
    ? summary.duplicate_mod_ids.map(String).join(', ')
    : str(summary.duplicate_mod_ids);
  const dupJars = Array.isArray(summary.duplicate_jars)
    ? summary.duplicate_jars.map(String).join(', ')
    : str(summary.duplicate_jars);
  const duplicates = [
    dupMods ? { label: 'Duplicate mods', value: <code className="text-xs">{dupMods}</code> } : null,
    dupJars ? { label: 'Duplicate jars', value: <code className="text-xs">{dupJars}</code> } : null,
    str(summary.locked_path)
      ? { label: 'Locked path', value: <code className="text-xs">{str(summary.locked_path)}</code> }
      : null,
  ].filter(Boolean) as { label: string; value: ReactNode }[];

  return (
    <div className="cr-details">
      <p className="cr-details__intro">Technical fields for forensics and rule matching</p>
      <TechSection title="Identity" hint="How this crash group is identified" rows={identity} />
      <TechSection title="Classification" hint="Rules and failure signals" rows={classification} />
      <TechSection title="Mixins & config" hint="Loader and config forensics" rows={mixinsConfig} />
      <TechSection title="Duplicates & locks" hint="Jar conflicts and locked paths" rows={duplicates} />
      <CrashLogPanel file={file} />
    </div>
  );
}

function FixPanel({
  plan,
  mode,
  activeFile,
  unreviewed,
  marking,
  onAckFile,
  onMarkGroup,
  onUndoFile,
  fingerprint,
  why,
}: {
  plan: ReturnType<typeof buildFixPlan>;
  mode: 'review' | 'reviewed';
  activeFile: string;
  unreviewed: number;
  marking: boolean;
  onAckFile: (file: string, reviewed: boolean) => void;
  onMarkGroup: (fp: string) => void;
  onUndoFile: (file: string) => void;
  fingerprint: string;
  why: string | null;
}) {
  const canWrite = useCanWrite();
  const [finding, setFinding] = useState(false);
  const [findResult, setFindResult] = useState<Record<string, unknown> | null>(null);

  const handleFindJar = async () => {
    const exception = why || '';
    const guess =
      plan.modId ||
      exception.match(/([a-zA-Z0-9_.]+(?:Exception|Error))/)?.[1]?.replace(/\./g, '/') ||
      '';
    const q = window.prompt('Class or package to look up', guess.replace(/\./g, '/'));
    if (!q?.trim()) return;
    setFinding(true);
    setFindResult(null);
    try {
      const classPath = q.includes('/') ? q.trim() : q.trim().replace(/\./g, '/');
      const res = await api.forensicsFindClass({ class: classPath, include_nested: true });
      setFindResult(asRecord(res));
    } catch (e) {
      setFindResult({ error: (e as Error)?.message || 'Find failed', matches: [] });
    } finally {
      setFinding(false);
    }
  };

  const matches = asArray<Record<string, unknown>>(findResult?.matches);

  return (
    <>
      <div className="cr-panel__eyebrow">Do this now</div>
      <p className="cr-panel__headline">{plan.headline}</p>
      {plan.confidenceLabel ? (
        <StatusPill tone={confidenceTone(plan.confidenceLabel)}>
          {plan.confidenceLabel} confidence
        </StatusPill>
      ) : null}
      {plan.versionGuide.length ? (
        <div className="cr-version-guide" aria-label="Installed and suggested versions">
          {plan.versionGuide.map((line) => (
            <div key={line.modId} className="cr-version-guide__row">
              <strong>{line.label}</strong>
              <span className="cr-version-guide__vers">
                {line.installed ? (
                  <>
                    <code>{line.installed}</code>
                    {line.target && line.target !== line.installed ? (
                      <>
                        <span aria-hidden>→</span>
                        <code className="cr-version-guide__target">{line.target}</code>
                      </>
                    ) : null}
                  </>
                ) : line.target ? (
                  <code className="cr-version-guide__target">{line.target}</code>
                ) : (
                  '—'
                )}
              </span>
              {line.note ? <span className="cr-version-guide__note">{line.note}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {plan.steps.length ? (
        <ol className="cr-steps">
          {plan.steps.map((step, i) => (
            <li key={i}>
              <span className="cr-steps__num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="cr-cta-row">
        {plan.modrinthUrl ? (
          <Button kind="primary" onClick={() => openExternal(plan.modrinthUrl)}>
            {plan.modrinthLabel || 'Open Modrinth'}
          </Button>
        ) : null}
        <Button
          onClick={() =>
            navigate({
              tab: 'mods',
              view: plan.modsTabParams.view,
              mod: plan.modsTabParams.mod ?? null,
              group: null,
            })
          }
        >
          Open Mods
        </Button>
        <Button onClick={() => navigate({ tab: 'logs', view: null, group: null, mod: null })}>
          Open Logs
        </Button>
      </div>

      {plan.relatedMods.length ? (
        <div className="cr-related">
          <span className="cr-related__label">Related</span>
          {plan.relatedMods.map((m) => (
            <button
              key={m.id}
              type="button"
              className="cr-related__chip"
              onClick={() => openExternal(m.url)}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="cr-cta-row">
        <Button
          disabled={!canWrite || finding}
          title={canWrite ? undefined : VIEW_ONLY_TITLE}
          onClick={() => void handleFindJar()}
        >
          {finding ? 'Finding…' : 'Find owning jar'}
        </Button>
        <Button
          onClick={() => {
            const text = [`${plan.headline}`, '', ...plan.steps.map((s, i) => `${i + 1}. ${s}`)].join(
              '\n',
            );
            void copyText(text);
          }}
        >
          <Copy size={14} className="mr-1.5" />
          Copy steps
        </Button>
      </div>

      {matches.length ? (
        <ul className="cr-find-matches">
          {matches.slice(0, 5).map((m, i) => (
            <li key={`${str(m.jar)}-${i}`}>
              <code>{str(m.jar, '?')}</code>
              <span>{str(m.mod_id, '?')}</span>
            </li>
          ))}
        </ul>
      ) : findResult && !matches.length ? (
        <p className="cr-ctx-loading">{str(findResult.error, 'No owning jar matches.')}</p>
      ) : null}

      {why ? <p className="cr-why">{why}</p> : null}

      <div className="cr-cta-row">
        {mode === 'review' ? (
          <>
            <Button
              kind="primary"
              disabled={!canWrite || marking}
              title={canWrite ? undefined : VIEW_ONLY_TITLE}
              onClick={() => onAckFile(activeFile, true)}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              Ack file
            </Button>
            <Button
              disabled={!canWrite || marking || !(unreviewed > 0)}
              title={canWrite ? undefined : VIEW_ONLY_TITLE}
              onClick={() => onMarkGroup(fingerprint)}
            >
              Mark group reviewed
            </Button>
          </>
        ) : (
          <Button
            disabled={!canWrite || marking}
            title={canWrite ? undefined : VIEW_ONLY_TITLE}
            onClick={() => onUndoFile(activeFile)}
          >
            Move to Review
          </Button>
        )}
      </div>
    </>
  );
}

export function CrashQueue({
  mode,
  items,
  allCount,
  selectedFp,
  selectedFile,
  onSelect,
  onSelectFile,
  onAckFile,
  onMarkGroup,
  onUndoFile,
  marking,
  kindFilter,
  onKindFilter,
  waiting,
  hasSearchOrFilter,
}: {
  mode: 'review' | 'reviewed';
  items: EnrichedCrash[];
  allCount: number;
  selectedFp: string | null;
  selectedFile: string | null;
  onSelect: (fp: string | null) => void;
  onSelectFile: (file: string | null) => void;
  onAckFile: (file: string, reviewed: boolean) => void;
  onMarkGroup: (fp: string) => void;
  onUndoFile: (file: string) => void;
  marking: boolean;
  kindFilter: KindFilter;
  onKindFilter: (k: KindFilter) => void;
  waiting: boolean;
  hasSearchOrFilter: boolean;
}) {
  const [detailTab, setDetailTab] = useState<DetailPanel>('fix');
  const dayBands = useMemo(() => groupEnrichedByDay(items), [items]);

  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!dayBands.length) return;
    setExpandedDays((prev) => {
      if (prev.size) return prev;
      const today = todayDayKey();
      const prefer = dayBands.find((b) => b.key === today) ?? dayBands[0];
      return new Set(prefer ? [prefer.key] : []);
    });
  }, [dayBands]);

  useEffect(() => {
    if (!selectedFp) return;
    const row = items.find((r) => r.group.fingerprint === selectedFp);
    if (!row) return;
    const key = dayKeyForGroup(row.group);
    setExpandedDays((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [selectedFp, items]);

  const active =
    (selectedFp ? items.find((r) => r.group.fingerprint === selectedFp) : null) ?? null;
  const activeFp = active?.group.fingerprint ?? null;
  const members = active?.group.members ?? [];
  const activeFile =
    members.find((m) => m.file === selectedFile)?.file ??
    (active ? leadMember(active.group)?.file : null) ??
    members[0]?.file ??
    null;

  useEffect(() => {
    setDetailTab('fix');
  }, [activeFp]);

  const modsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });
  const mods = asArray<Record<string, unknown>>(asRecord(asRecord(modsQ.data).optional).mods);
  const plan = useMemo(
    () => (active ? buildFixPlan(active.summary, mods) : null),
    [active, mods],
  );
  const conf = active ? formatConfidenceLabel(active.summary.confidence) : null;
  const chip = active ? kindChip(active.group, active.summary) : null;
  const why =
    str(active?.summary.likely_cause) ||
    str(asRecord(active?.summary.mod_fix).why) ||
    str(active?.summary.plain_english) ||
    null;

  const emptyTitle = waiting
    ? 'Waiting for crash scan'
    : mode === 'review' && !hasSearchOrFilter && allCount > 0
      ? 'Inbox clear'
      : mode === 'review' && hasSearchOrFilter
        ? 'No matches'
        : mode === 'review'
          ? 'Nothing to review'
          : hasSearchOrFilter
            ? 'No matches'
            : 'Nothing reviewed yet';

  const emptyBody = waiting
    ? 'Crash files will appear here after the next scan finds reports on disk.'
    : mode === 'review' && !hasSearchOrFilter && allCount > 0
      ? 'All crash groups are reviewed. Open Reviewed or Tools when you need history.'
      : mode === 'review' && hasSearchOrFilter
        ? 'Try another kind filter or clear search.'
        : mode === 'review'
          ? 'No crash groups yet.'
          : hasSearchOrFilter
            ? 'Try clearing search.'
            : 'Ack a crash file or mark a group reviewed to fill this list.';

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="cr-queue">
      {mode === 'review' ? (
        <div className="cr-kind-chips">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`cr-kind-chip${kindFilter === f.value ? ' is-active' : ''}`}
              onClick={() => onKindFilter(f.value)}
            >
              {f.value === 'all' ? 'All' : f.value === 'mod' ? 'Mod' : f.value === 'hang' ? 'Hang' : 'Host'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="cr-split">
        <div className="cr-list">
          {dayBands.length ? (
            <Stagger className="cr-list-stagger">
              {dayBands.map((band) => {
                const open = expandedDays.has(band.key);
                const unreviewedInDay = band.items.reduce((n, r) => n + r.group.unreviewed, 0);
                return (
                  <div key={band.key} className={`cr-day${open ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="cr-day__header"
                      onClick={() => toggleDay(band.key)}
                      aria-expanded={open}
                    >
                      <span className="cr-day__label">
                        <ChevronRight
                          size={14}
                          className={`cr-day__chev${open ? ' is-open' : ''}`}
                        />
                        {band.label || formatInboxDayLabel(band.key)}
                      </span>
                      <span className="cr-day__badges">
                        {unreviewedInDay > 0 ? (
                          <StatusPill tone="warn">{unreviewedInDay} open</StatusPill>
                        ) : null}
                        <span className="cr-day__count">{band.items.length}</span>
                      </span>
                    </button>
                    {open ? (
                      <CrashDayItems
                        items={band.items}
                        activeFp={activeFp}
                        onSelect={onSelect}
                        onSelectFile={onSelectFile}
                      />
                    ) : null}
                  </div>
                );
              })}
            </Stagger>
          ) : (
            <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
          )}
        </div>

        <div className="cr-detail">
          {active && activeFile && plan ? (
            <div className="cr-detail__card">
              <div className="cr-detail__head">
                <div className="min-w-0">
                  <div className="cr-detail__pills">
                    {chip ? (
                      <StatusPill
                        tone={
                          chip.tone === 'danger' ? 'danger' : chip.tone === 'warn' ? 'warn' : 'neutral'
                        }
                      >
                        {chip.label}
                      </StatusPill>
                    ) : null}
                    {conf ? (
                      <StatusPill tone={confidenceTone(conf)}>{conf} confidence</StatusPill>
                    ) : null}
                  </div>
                  <h3 className="cr-detail__title">{groupTitle(active.group, active.summary)}</h3>
                  <p className="cr-detail__hint">
                    {active.group.count} file(s)
                    {active.group.unreviewed > 0
                      ? ` · ${active.group.unreviewed} unreviewed`
                      : ' · all reviewed'}
                  </p>
                </div>
                <button
                  type="button"
                  className="cr-detail__close"
                  aria-label="Close detail"
                  onClick={() => onSelect(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="cr-file-chips">
                {members.map((m) => {
                  const isLead = leadMember(active.group)?.file === m.file;
                  return (
                    <button
                      key={m.file}
                      type="button"
                      className={`cr-file-chip${m.file === activeFile ? ' is-active' : ''}${m.acknowledged ? ' is-acked' : ''}`}
                      onClick={() => onSelectFile(m.file)}
                    >
                      {isLead ? '★ ' : ''}
                      {bareFile(m.file)}
                    </button>
                  );
                })}
              </div>

              <div className="cr-detail-tabs" role="tablist">
                {DETAIL_PANELS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === t.id}
                    className={`cr-detail-tab${detailTab === t.id ? ' is-active' : ''}`}
                    onClick={() => setDetailTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="cr-panel">
                {detailTab === 'fix' ? (
                  <FixPanel
                    plan={plan}
                    mode={mode}
                    activeFile={activeFile}
                    unreviewed={active.group.unreviewed}
                    marking={marking}
                    onAckFile={onAckFile}
                    onMarkGroup={onMarkGroup}
                    onUndoFile={onUndoFile}
                    fingerprint={active.group.fingerprint}
                    why={why}
                  />
                ) : null}

                {detailTab === 'evidence' ? (
                  <EvidencePanel
                    row={active}
                    file={activeFile}
                    onSelectFile={onSelectFile}
                    onAckFile={onAckFile}
                    marking={marking}
                    mode={mode}
                  />
                ) : null}

                {detailTab === 'details' ? <DetailsPanel row={active} file={activeFile} /> : null}
              </div>
            </div>
          ) : (
            <EmptyState title="Select a group">
              {dayBands.length
                ? 'Pick a crash group on the left.'
                : 'Nothing to show in detail until a group is selected.'}
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
