import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetaButton, MetaLink } from '@/components/ui/desk';
import { useMemo, useState } from 'react';
import {
  BACKUPS,
  type BackupArchive,
  type BackupFreshness,
  type BackupVerifyStatus,
  type Tone,
} from '../fixtures';
import { DeskHero, DeskSignal, PageHeader } from './PageHero';
import { Plate } from './Plate';
import { DeskPage } from './layout/DeskPage';
import { toneColor, HashMeter } from './charts';

const HEAD = 'flex h-11 shrink-0 items-center border-b border-[color:var(--wt-line)] px-4';
const FOOT = 'mt-auto flex h-12 shrink-0 items-center border-t border-[color:var(--wt-line)] px-4';

function freshnessTone(f: BackupFreshness): Tone {
  if (f === 'fresh') return 'ok';
  if (f === 'aging') return 'warn';
  return 'danger';
}

function freshnessWord(f: BackupFreshness) {
  if (f === 'fresh') return 'Fresh';
  if (f === 'aging') return 'Aging';
  return 'Stale';
}

function verifyTone(v: BackupVerifyStatus): Tone {
  if (v === 'verified') return 'ok';
  if (v === 'suspicious') return 'warn';
  if (v === 'broken') return 'danger';
  return 'default';
}

function verifyWord(v: BackupVerifyStatus) {
  if (v === 'verified') return 'Verified';
  if (v === 'suspicious') return 'Suspicious';
  if (v === 'broken') return 'Broken';
  return 'Unchecked';
}

function ageLabel(hours: number) {
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 10) return `${days.toFixed(1)}d`;
  return `${Math.round(days)}d`;
}

function freshnessPct(ageHours: number, staleHours: number) {
  return Math.max(0, Math.min(100, Math.round(100 - (ageHours / staleHours) * 100)));
}

/** Worst status ink for a row: broken > suspicious > stale > aging > unchecked > fresh/verified. */
function rowTone(freshness: BackupFreshness, verify: BackupVerifyStatus): Tone {
  if (verify === 'broken') return 'danger';
  if (verify === 'suspicious') return 'warn';
  if (freshness === 'stale') return 'danger';
  if (freshness === 'aging') return 'warn';
  if (verify === 'unchecked') return 'default';
  return freshnessTone(freshness);
}

function rowStatus(freshness: BackupFreshness, verify: BackupVerifyStatus) {
  if (verify === 'broken') return 'Broken';
  if (verify === 'suspicious') return 'Suspect';
  if (freshness === 'stale') return 'Stale';
  if (freshness === 'aging') return 'Aging';
  if (verify === 'unchecked') return 'Unchecked';
  return freshnessWord(freshness);
}

/**
 * Backups POC - freshness desk, archive inventory, setup gaps.
 * Tracks archives; does not create backups.
 */
export function Backups() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(BACKUPS.archives[0]?.id ?? '');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [localVerify, setLocalVerify] = useState<Record<string, BackupVerifyStatus>>({});

  const archives = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BACKUPS.archives.filter((a) =>
      q ? a.file.toLowerCase().includes(q) || a.path.toLowerCase().includes(q) : true,
    );
  }, [query]);

  const selected =
    archives.find((a) => a.id === selectedId) ?? archives[0] ?? BACKUPS.archives[0]!;
  const verifyStatus = localVerify[selected.id] ?? selected.verify;
  const findings =
    verifyStatus === selected.verify
      ? selected.findings
      : verifyStatus === 'verified'
        ? ['Archive opens', 'World metadata present', 'Region chunks present']
        : selected.findings;
  const largest = Math.max(...BACKUPS.archives.map((a) => a.sizeGb), 1);
  const checklistDone = BACKUPS.checklist.filter((c) => c.done).length;
  const openSteps = BACKUPS.checklist.filter((c) => !c.done);
  const nextStep = openSteps[0];
  const pct = freshnessPct(selected.ageHours, BACKUPS.staleHours);
  const tone = freshnessTone(BACKUPS.status);
  const heroFresh = freshnessPct(BACKUPS.lastBackup.ageHours, BACKUPS.staleHours);

  const runVerify = () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    window.setTimeout(() => {
      setLocalVerify((prev) => ({ ...prev, [selected.id]: 'verified' }));
      setVerifyBusy(false);
    }, 900);
  };

  return (
    <DeskPage>
        <PageHeader
          group="Ops"
          title="Backups"
          sub="Track freshness and archive integrity. WatchTower does not create backups."
          aside={
            <p className="wt-meta text-[color:var(--wt-text-low)]">
              Scanned {BACKUPS.scannedAt}
              <span className="mt-1 block">Stale after {BACKUPS.staleHours}h</span>
            </p>
          }
        />

        <DeskHero
          label="Backup health"
          title={BACKUPS.statusWord}
          titleColor={toneColor(tone)}
          detail={
            <p className="m-0">
              Last archive{' '}
              <span className="font-mono tabular-nums text-[color:var(--wt-text)]">
                {BACKUPS.lastBackup.ageLabel}
              </span>{' '}
              ({BACKUPS.lastBackup.sizeGb.toFixed(1)} GB). Browse tracked zips, verify, finish
              offsite + alerts.
            </p>
          }
          sideLabel="This scan"
          side={
            <>
              <ul className="mt-4 m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                <DeskSignal
                  title={`${heroFresh}%`}
                  detail={`Freshness window · ${BACKUPS.lastBackup.ageLabel}`}
                  toneColor={toneColor(tone)}
                />
                <DeskSignal
                  title={BACKUPS.lastBackup.ageLabel}
                  detail={`Newest · ${BACKUPS.lastBackup.mtimeLabel}`}
                  toneColor="var(--wt-text)"
                />
                <DeskSignal
                  title={String(BACKUPS.summary.fileCount)}
                  detail={`${BACKUPS.summary.listed} listed`}
                  toneColor="#5B8FD4"
                />
                <DeskSignal
                  title={`${BACKUPS.summary.totalGb.toFixed(1)} GB`}
                  detail="Total scanned"
                  toneColor="#C9A227"
                />
              </ul>
              <MetaLink type="button" title="POC - scan is visual only">
                Scan now →
              </MetaLink>
            </>
          }
        />

        {/* Archive desk: catalog | readout */}
        <Plate className="grid gap-px overflow-hidden bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
            <div className={`${HEAD} justify-between gap-3`}>
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Archives</p>
              <p className="m-0 font-mono text-[0.8rem] tabular-nums text-[color:var(--wt-text)]">
                {archives.length}
                <span className="ml-1 text-[0.65rem] text-[color:var(--wt-text-low)]">
                  / {BACKUPS.summary.fileCount}
                </span>
              </p>
            </div>

            <div className="border-b border-border px-4 py-2.5">
              <Label className="sr-only" htmlFor="bu-search">
                Search archives
              </Label>
              <Input
                id="bu-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or path"
                className="h-9 font-mono text-[0.75rem]"
              />
            </div>

            <ul
              className="m-0 flex max-h-[28rem] list-none flex-col gap-px overflow-y-auto bg-[color:var(--wt-line)] p-0"
              role="listbox"
              aria-label="Backup archives"
            >
              {archives.length === 0 ? (
                <li className="bg-[color:var(--wt-bg1)] px-4 py-6 text-[0.8125rem] text-[color:var(--wt-text-low)]">
                  No matching archives
                </li>
              ) : (
                archives.map((a, i) => {
                  const on = a.id === selected.id;
                  const v = localVerify[a.id] ?? a.verify;
                  const ink = toneColor(rowTone(a.freshness, v));
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => setSelectedId(a.id)}
                        className={`grid w-full cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-2 px-4 py-2.5 text-left transition-colors duration-200 ${
                          on
                            ? 'bg-[color:var(--wt-bg3)]'
                            : 'bg-[color:var(--wt-bg1)] hover:bg-[color:var(--wt-bg0)]'
                        }`}
                      >
                        <span className="font-mono text-[0.65rem] tabular-nums text-[color:var(--wt-text-low)]">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-[0.8rem] text-[color:var(--wt-text)]">
                            {a.file}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="wt-meta text-[color:var(--wt-text-low)]">
                              {ageLabel(a.ageHours)}
                            </span>
                            {a.newest ? (
                              <span className="wt-meta text-[color:var(--wt-accent)]">Newest</span>
                            ) : null}
                            <span className="wt-meta" style={{ color: ink }}>
                              {rowStatus(a.freshness, v)}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 self-center font-mono text-[0.75rem] tabular-nums text-[color:var(--wt-text-mid)]">
                          {a.sizeGb.toFixed(1)}
                          <span className="ml-0.5 text-[0.6rem] text-[color:var(--wt-text-low)]">
                            GB
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className={FOOT}>
              <p className="m-0 wt-meta text-[color:var(--wt-text-low)]">
                Select a zip for verify + integrity
              </p>
            </div>
          </div>

          <ArchiveDetail
            archive={selected}
            verifyStatus={verifyStatus}
            findings={findings}
            pct={pct}
            largest={largest}
            verifyBusy={verifyBusy}
            onVerify={runVerify}
          />
        </Plate>

        {/* Gaps | Paths */}
        <Plate className="grid gap-px overflow-hidden bg-[color:var(--wt-line)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
            <div className={`${HEAD} justify-between gap-3`}>
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Setup gaps</p>
              <p className="m-0 font-mono text-[0.8rem] tabular-nums text-[color:var(--wt-text)]">
                {checklistDone}
                <span className="text-[color:var(--wt-text-low)]">/5</span>
              </p>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-px border-b border-[color:var(--wt-line)] bg-[color:var(--wt-line)]">
              <div className="bg-[color:var(--wt-bg0)] px-5 py-5">
                <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Open</p>
                <p
                  className="mt-2 m-0 wt-display text-[clamp(2rem,4vw,2.75rem)] leading-none tabular-nums"
                  style={{ color: openSteps.length ? 'var(--wt-accent)' : 'var(--wt-ok)' }}
                >
                  {openSteps.length}
                </p>
              </div>
              <div className="bg-[color:var(--wt-bg1)] px-5 py-5">
                {nextStep ? (
                  <>
                    <p className="wt-meta m-0 text-[color:var(--wt-accent)]">Next</p>
                    <p className="mt-2 m-0 text-[0.9375rem] font-semibold text-[color:var(--wt-text)]">
                      {nextStep.label}
                    </p>
                    <p className="mt-1 m-0 max-w-[42ch] text-[0.75rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                      {nextStep.hint}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="wt-meta m-0 text-[color:var(--wt-ok)]">Complete</p>
                    <p className="mt-2 m-0 text-[0.875rem] text-[color:var(--wt-text-mid)]">
                      Tracking checklist is done.
                    </p>
                  </>
                )}
              </div>
            </div>

            <ul className="m-0 flex list-none flex-col gap-px bg-[color:var(--wt-line)] p-0">
              {BACKUPS.checklist.map((step, i) => {
                const isNext = nextStep?.id === step.id;
                return (
                  <li
                    key={step.id}
                    className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-2 bg-[color:var(--wt-bg1)] px-4 py-2.5"
                  >
                    <span className="font-mono text-[0.65rem] tabular-nums text-[color:var(--wt-text-low)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`m-0 text-[0.8125rem] ${
                          step.done
                            ? 'text-[color:var(--wt-text-low)] line-through'
                            : 'text-[color:var(--wt-text)]'
                        }`}
                      >
                        {step.label}
                      </p>
                      {!step.done ? (
                        <p className="mt-0.5 m-0 truncate text-[0.7rem] text-[color:var(--wt-text-low)]">
                          {step.hint}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className="wt-meta shrink-0"
                      style={{
                        color: step.done
                          ? 'var(--wt-ok)'
                          : isNext
                            ? 'var(--wt-accent)'
                            : 'var(--wt-text-low)',
                      }}
                    >
                      {step.done ? 'Done' : isNext ? 'Next' : 'Open'}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className={FOOT}>
              <p className="m-0 wt-meta text-[color:var(--wt-text-low)]">
                Settings wiring lands later in this POC
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
            <div className={`${HEAD} justify-between gap-3`}>
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Storage</p>
              <p className="wt-meta m-0 text-[color:var(--wt-ok)]">
                Mode {BACKUPS.tracking.mode}
              </p>
            </div>

            <div className="border-b border-[color:var(--wt-line)] px-5 py-5">
              <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Primary path</p>
              <p className="mt-2 m-0 break-all font-mono text-[0.875rem] leading-snug text-[color:var(--wt-text)]">
                {BACKUPS.tracking.primary}
              </p>
              <dl className="mt-4 m-0 grid grid-cols-3 gap-px bg-[color:var(--wt-line)] border border-[color:var(--wt-line)]">
                <div className="bg-[color:var(--wt-bg0)] px-3 py-2.5">
                  <dt className="wt-meta m-0 text-[color:var(--wt-text-low)]">Paths</dt>
                  <dd className="mt-1 m-0 font-mono text-[1.05rem] tabular-nums text-[color:var(--wt-text)]">
                    {BACKUPS.tracking.paths.length}
                  </dd>
                </div>
                <div className="bg-[color:var(--wt-bg0)] px-3 py-2.5">
                  <dt className="wt-meta m-0 text-[color:var(--wt-text-low)]">External</dt>
                  <dd
                    className="mt-1 m-0 font-mono text-[0.8rem]"
                    style={{
                      color: BACKUPS.tracking.externalConfigured
                        ? 'var(--wt-ok)'
                        : 'var(--wt-accent)',
                    }}
                  >
                    {BACKUPS.tracking.externalConfigured ? 'Set' : 'Missing'}
                  </dd>
                </div>
                <div className="bg-[color:var(--wt-bg0)] px-3 py-2.5">
                  <dt className="wt-meta m-0 text-[color:var(--wt-text-low)]">Scan</dt>
                  <dd className="mt-1 m-0 font-mono text-[0.8rem] text-[color:var(--wt-text)]">
                    {BACKUPS.scannedAt}
                  </dd>
                </div>
              </dl>
            </div>

            <ul className="m-0 flex list-none flex-col gap-px bg-[color:var(--wt-line)] p-0">
              {BACKUPS.tracking.paths.map((p, i) => (
                <li
                  key={p.path}
                  className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-2 bg-[color:var(--wt-bg1)] px-4 py-3"
                >
                  <span className="font-mono text-[0.65rem] tabular-nums text-[color:var(--wt-text-low)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="m-0 truncate font-mono text-[0.75rem] text-[color:var(--wt-text)]">
                    {p.path}
                  </p>
                  <span
                    className="wt-meta shrink-0"
                    style={{ color: p.primary ? 'var(--wt-accent)' : 'var(--wt-text-low)' }}
                  >
                    {p.primary ? 'Primary' : 'Tracked'}
                  </span>
                </li>
              ))}
            </ul>

            <div className={FOOT}>
              <button
                type="button"
                disabled
                title="Settings not in this POC yet"
                className="cursor-not-allowed wt-meta text-[color:var(--wt-text-low)] opacity-60"
              >
                Edit paths (soon)
              </button>
            </div>
          </div>
        </Plate>
    </DeskPage>
  );
}

function ArchiveDetail({
  archive,
  verifyStatus,
  findings,
  pct,
  largest,
  verifyBusy,
  onVerify,
}: {
  archive: BackupArchive;
  verifyStatus: BackupVerifyStatus;
  findings: string[];
  pct: number;
  largest: number;
  verifyBusy: boolean;
  onVerify: () => void;
}) {
  const sizeShare = Math.round((archive.sizeGb / largest) * 100);
  const fTone = freshnessTone(archive.freshness);
  const vTone = verifyTone(verifyStatus);

  return (
    <div className="flex min-h-0 flex-col bg-[color:var(--wt-bg1)]">
      <div className={`${HEAD} justify-between gap-3`}>
        <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Selected</p>
        <div className="flex items-center gap-3">
          {archive.newest ? (
            <span className="wt-meta text-[color:var(--wt-accent)]">Newest</span>
          ) : null}
          <span className="wt-meta" style={{ color: toneColor(fTone) }}>
            {freshnessWord(archive.freshness)}
          </span>
          <span className="wt-meta" style={{ color: toneColor(vTone) }}>
            {verifyWord(verifyStatus)}
          </span>
        </div>
      </div>

      <div className="border-b border-[color:var(--wt-line)] px-5 py-5">
        <p className="m-0 break-all font-mono text-[0.9rem] leading-snug text-[color:var(--wt-text)]">
          {archive.file}
        </p>
        <p className="mt-2 m-0 break-all font-mono text-[0.7rem] text-[color:var(--wt-text-low)]">
          {archive.path}
        </p>
        <p className="mt-2 m-0 wt-meta text-[color:var(--wt-text-mid)]">
          {archive.mtimeLabel}
          <span className="mx-2 text-[color:var(--wt-line)]">/</span>
          {ageLabel(archive.ageHours)} ago
          <span className="mx-2 text-[color:var(--wt-line)]">/</span>
          {archive.sizeGb.toFixed(1)} GB
        </p>
      </div>

      {/* Macro freshness + size share */}
      <div className="grid grid-cols-2 gap-px border-b border-[color:var(--wt-line)] bg-[color:var(--wt-line)]">
        <div className="bg-[color:var(--wt-bg0)] px-5 py-5">
          <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Freshness</p>
          <p
            className="mt-2 m-0 wt-display text-[clamp(2.25rem,5vw,3.25rem)] leading-none tabular-nums"
            style={{ color: toneColor(fTone) }}
          >
            {pct}
            <span className="ml-0.5 text-[1rem] text-[color:var(--wt-text-low)]">%</span>
          </p>
          <HashMeter value={pct} ink={toneColor(fTone)} className="mt-3" trackClassName="h-1.5" />
          <p className="mt-2 m-0 text-[0.7rem] text-[color:var(--wt-text-low)]">
            Window {BACKUPS.staleHours}h
          </p>
        </div>
        <div className="bg-[color:var(--wt-bg1)] px-5 py-5">
          <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Size share</p>
          <p className="mt-2 m-0 wt-display text-[clamp(2.25rem,5vw,3.25rem)] leading-none tabular-nums text-[color:var(--wt-accent)]">
            {sizeShare}
            <span className="ml-0.5 text-[1rem] text-[color:var(--wt-text-low)]">%</span>
          </p>
          <HashMeter value={sizeShare} className="mt-3" trackClassName="h-1.5" />
          <p className="mt-2 m-0 text-[0.7rem] text-[color:var(--wt-text-low)]">
            Vs largest tracked
          </p>
        </div>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-px border-b border-[color:var(--wt-line)] bg-[color:var(--wt-line)]">
        {(
          [
            { label: 'Size', value: `${archive.sizeGb.toFixed(1)} GB`, ink: 'var(--wt-text)' },
            { label: 'Age', value: `${ageLabel(archive.ageHours)} ago`, ink: 'var(--wt-text)' },
            {
              label: 'Status',
              value: freshnessWord(archive.freshness),
              ink: toneColor(fTone),
            },
            {
              label: 'Integrity',
              value: verifyWord(verifyStatus),
              ink: toneColor(vTone),
            },
          ] as const
        ).map((cell) => (
          <div key={cell.label} className="bg-[color:var(--wt-bg1)] px-4 py-3">
            <dt className="wt-meta m-0 text-[color:var(--wt-text-low)]">{cell.label}</dt>
            <dd
              className="mt-1 m-0 font-mono text-[0.875rem]"
              style={{ color: cell.ink }}
            >
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-1 flex-col px-5 py-4">
        <p className="wt-meta m-0 text-[color:var(--wt-text-low)]">Integrity checks</p>
        {findings.length === 0 ? (
          <p className="mt-3 m-0 text-[0.75rem] text-[color:var(--wt-text-low)]">
            No light-verify results yet. Run Verify now.
          </p>
        ) : (
          <ul className="mt-3 m-0 flex list-none flex-col gap-2 p-0">
            {findings.map((f) => {
              const bad =
                /can.?t|missing|unreadable|no region/i.test(f) || verifyStatus === 'broken';
              const warn = verifyStatus === 'suspicious' && !bad;
              return (
                <li
                  key={f}
                  className="flex items-start gap-3 border-l-2 pl-3 text-[0.8rem] text-[color:var(--wt-text)]"
                  style={{
                    borderColor: bad
                      ? 'var(--wt-danger)'
                      : warn
                        ? 'var(--wt-warn)'
                        : 'var(--wt-ok)',
                  }}
                >
                  <span
                    className="shrink-0 font-mono text-[0.65rem] tabular-nums"
                    style={{
                      color: bad
                        ? 'var(--wt-danger)'
                        : warn
                          ? 'var(--wt-warn)'
                          : 'var(--wt-ok)',
                    }}
                  >
                    {bad ? '[!]' : warn ? '[~]' : '[+]'}
                  </span>
                  {f}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-auto flex h-12 shrink-0 items-center gap-4 border-t border-border px-4">
        <MetaLink type="button" onClick={onVerify} disabled={verifyBusy}>
          {verifyBusy ? 'Checking...' : 'Verify now →'}
        </MetaLink>
        <MetaButton type="button" disabled title="Test restore is visual-only in this POC">
          Test restore
        </MetaButton>
      </div>
    </div>
  );
}
