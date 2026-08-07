import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatusPill } from '@/ui/patterns';
import {
  MUTATE_STAGE_LABELS,
  MUTATE_TERMINAL,
  fetchMutateJob,
  type MutateJob,
} from './mutate-api';

const STAGES = ['fetching', 'verifying', 'backing_up', 'applying'] as const;

function stageIndex(state: string): number {
  const i = STAGES.indexOf(state as (typeof STAGES)[number]);
  if (i >= 0) return i;
  if (state === 'queued') return -1;
  if (MUTATE_TERMINAL.has(state)) return STAGES.length;
  return 0;
}

export function MutateJobProgress({
  jobId,
  onTerminal,
}: {
  jobId: string | null;
  onTerminal?: (job: MutateJob) => void;
}) {
  const jobQ = useQuery({
    queryKey: ['mods-mutate-job', jobId],
    queryFn: () => fetchMutateJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const state = String(q.state.data?.state ?? '');
      return MUTATE_TERMINAL.has(state) ? false : 600;
    },
  });

  const job = jobQ.data;
  const state = String(job?.state ?? 'queued');
  const errorCode = String(job?.error_code ?? '');
  const isPartial = errorCode === 'batch_partial';

  useEffect(() => {
    if (!job || !MUTATE_TERMINAL.has(job.state)) return;
    onTerminal?.(job);
  }, [job, onTerminal]);

  if (!jobId) return null;

  const idx = stageIndex(state);
  const label =
    isPartial
      ? 'Partial — some mods failed'
      : MUTATE_STAGE_LABELS[state] || state;
  const tone =
    state === 'done'
      ? 'ok'
      : isPartial
        ? 'warn'
        : state === 'failed' || state === 'cancelled'
          ? 'danger'
          : 'info';

  const failedSteps = (job?.steps ?? []).filter(
    (s) => s.state === 'failed' || s.state === 'cancelled',
  );

  return (
    <div className="md-mutate-progress" role="status" aria-live="polite">
      <div className="md-mutate-progress__head">
        <StatusPill tone={tone}>{label}</StatusPill>
        {job?.mod_id ? <span className="md-mutate-progress__mod">{job.mod_id}</span> : null}
      </div>

      <ol className="md-mutate-progress__stages">
        {STAGES.map((s, i) => {
          const done = idx > i || (state === 'done');
          const active = state === s;
          return (
            <li
              key={s}
              className={`md-mutate-progress__stage${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
            >
              {MUTATE_STAGE_LABELS[s]}
            </li>
          );
        })}
      </ol>

      {job?.error ? <p className="md-mutate-progress__error">{job.error}</p> : null}
      {failedSteps.length ? (
        <ul className="md-mutate-progress__steps">
          {failedSteps.map((s) => (
            <li key={`${s.mod_id}-${s.version_id || ''}`}>
              <strong>{s.mod_id || 'mod'}</strong>
              {s.error ? ` — ${s.error}` : s.state === 'cancelled' ? ' — skipped' : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {jobQ.isError ? (
        <p className="md-mutate-progress__error">
          {(jobQ.error as Error)?.message || 'Could not load job status'}
        </p>
      ) : null}
    </div>
  );
}
