import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { Button, EmptyState, StatusPill } from '@/ui/patterns';
import { severityTone, type IssueItem } from './helpers';

export type SuppressionRow = {
  id: string;
  message: string;
  severity: string;
};

export function IssuesTools({
  criticalCount,
  warningCount,
  infoCount,
  reviewedCount,
  activeKeys,
  suppressions,
  onMarkAll,
  onRestore,
  busy,
}: {
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  reviewedCount: number;
  activeKeys: string[];
  suppressions: SuppressionRow[];
  onMarkAll: (keys: string[]) => void;
  onRestore: (id: string) => void;
  busy: boolean;
}) {
  const canWrite = useCanWrite();
  return (
    <div className="is-tools">
      <div className="is-kpi-strip is-kpi-strip--4">
        <div className="is-kpi">
          <div className="is-kpi__label">Critical</div>
          <div className="is-kpi__value">{criticalCount}</div>
        </div>
        <div className="is-kpi">
          <div className="is-kpi__label">Warning</div>
          <div className="is-kpi__value">{warningCount}</div>
        </div>
        <div className="is-kpi">
          <div className="is-kpi__label">Info</div>
          <div className="is-kpi__value">{infoCount}</div>
        </div>
        <div className="is-kpi">
          <div className="is-kpi__label">Reviewed</div>
          <div className="is-kpi__value">{reviewedCount}</div>
        </div>
      </div>

      <div className="is-card">
        <h3 className="is-card__title">Mark all reviewed</h3>
        <p className="is-card__hint">
          Clears the Active queue (except the crash pointer — clear those on Crashes). Useful after a triage session.
        </p>
        <Button
          kind="primary"
          disabled={!canWrite || busy || activeKeys.length === 0}
          title={canWrite ? undefined : VIEW_ONLY_TITLE}
          onClick={() => onMarkAll(activeKeys)}
        >
          Mark {activeKeys.length || 'all'} reviewed
        </Button>
      </div>

      <div className="is-card">
        <h3 className="is-card__title">Hidden (suppressed)</h3>
        <p className="is-card__hint">
          Issues silenced with Don&apos;t show again. Restore brings them back into the Active queue when evidence is
          still present.
        </p>
        {suppressions.length ? (
          <div className="is-hidden-list">
            {suppressions.map((row) => (
              <div key={row.id} className="is-hidden-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={severityTone(row.severity)}>{row.severity}</StatusPill>
                    <strong className="text-sm">{row.id}</strong>
                  </div>
                  <p className="mt-1 text-xs text-wt-text-low">{row.message}</p>
                </div>
                <Button
                  disabled={!canWrite || busy}
                  title={canWrite ? undefined : VIEW_ONLY_TITLE}
                  onClick={() => onRestore(row.id)}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing hidden">Suppress an issue from Active to see it here.</EmptyState>
        )}
      </div>

      <div className="is-card">
        <h3 className="is-card__title">Tips</h3>
        <ul className="is-tips">
          <li>
            <strong>Review</strong> when you fixed it or accepted the risk — it moves to Reviewed and can be undone.
          </li>
          <li>
            <strong>Don&apos;t show again</strong> when the finding is noisy/expected — it stays hidden until you
            restore it from Tools.
          </li>
          <li>Active is grouped by severity (Critical / Warning / Info), not by scan source.</li>
          <li>Crash rows are pointers only — open Crashes for the real fix plan.</li>
          <li>Boot warnings/errors from Startup deep-link here (client synthesis for now).</li>
        </ul>
      </div>
    </div>
  );
}

export function nextActiveKey(items: IssueItem[], currentKey: string): string | null {
  const idx = items.findIndex((i) => i.key === currentKey);
  if (idx < 0) return items[0]?.key ?? null;
  return items[idx + 1]?.key ?? items[idx - 1]?.key ?? null;
}
