import { FadeIn, Stagger } from '@/ui/motion';
import { Button, EmptyState, QueueRow, Section, StatusPill } from '@/ui/patterns';
import { AlertTriangle, Activity, Clock, History } from '@/ui/icons';
import { asArray, num, str } from '@/lib/utils';
import { formatGb, formatMs } from '@/domain/formats';
import { PanelShell, openTabLink, severityTone } from '../shared';

export function PatternsIncidents({ dash }: { dash: Record<string, unknown> }) {
  const sticky = asArray<Record<string, unknown>>(dash.sticky_lag);
  const outliers = asArray<Record<string, unknown>>(dash.outlier_minutes);
  const correlations = asArray<Record<string, unknown>>(dash.correlations);
  const related = asArray<Record<string, unknown>>(dash.related_events);

  const empty =
    !correlations.length && !related.length && !sticky.length && !outliers.length;

  if (empty) {
    return (
      <EmptyState title="No incidents in this window">
        Outliers, sticky lag, and related events show up when rollups catch unusual lag.
      </EmptyState>
    );
  }

  return (
    <PanelShell>
      {correlations.length ? (
        <FadeIn>
          <Section title="Correlations" icon={Activity} hint="Signals that tend to move together.">
            <Stagger className="grid gap-2">
              {correlations.slice(0, 10).map((c, i) => (
                <QueueRow
                  key={str(c.id, String(i))}
                  title={str(c.label, str(c.title, `${str(c.a)} ↔ ${str(c.b)}`))}
                  detail={str(c.detail, `r=${num(c.r, num(c.score)).toFixed(2)}`)}
                  action={
                    <StatusPill tone={severityTone[str(c.severity)] ?? 'info'}>
                      {str(c.severity, 'info')}
                    </StatusPill>
                  }
                />
              ))}
            </Stagger>
          </Section>
        </FadeIn>
      ) : null}

      {related.length ? (
        <FadeIn>
          <Section title="Related events" icon={History} hint="Lag spikes and nearby ops events.">
            <Stagger className="grid gap-2">
              {related.slice(0, 12).map((e, i) => (
                <QueueRow
                  key={`${str(e.ts, str(e.at))}-${i}`}
                  title={str(e.title, str(e.label, str(e.type)))}
                  detail={str(e.detail, str(e.at, e.ts ? new Date(String(e.ts)).toLocaleString() : ''))}
                  action={
                    str(e.tab_link) ? (
                      <Button kind="default" onClick={() => openTabLink(str(e.tab_link))}>
                        Open
                      </Button>
                    ) : null
                  }
                />
              ))}
            </Stagger>
          </Section>
        </FadeIn>
      ) : null}

      <FadeIn>
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Sticky lag episodes" icon={AlertTriangle}>
            {sticky.length ? (
              <div className="space-y-3">
                {sticky.map((s, i) => (
                  <div
                    key={i}
                    className="relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 p-4 text-sm"
                  >
                    <div className="font-medium">{str(s.narrative)}</div>
                    <div className="mt-1 text-xs text-wt-text-low">
                      Duration {num(s.duration_min)}m · peak {formatMs(num(s.peak_mspt))}
                      {s.started_at
                        ? ` · ${new Date(String(s.started_at)).toLocaleString()}`
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="None detected" />
            )}
          </Section>

          <Section title="Outlier minutes" icon={Clock}>
            {outliers.length ? (
              <div className="in-table-scroll">
                <table className="in-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>MSPT</th>
                      <th>Players</th>
                      <th>Reason</th>
                      <th>Mem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outliers.map((o, i) => (
                      <tr key={i}>
                        <td>
                          {o.ts ? new Date(String(o.ts)).toLocaleString() : str(o.at, '—')}
                        </td>
                        <td>{formatMs(num(o.mspt_avg))}</td>
                        <td>{num(o.players_max)}</td>
                        <td>{str(o.reason).replace(/_/g, ' ') || '—'}</td>
                        <td>{formatGb(num(o.mem_used_gb_avg))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="None detected" />
            )}
          </Section>
        </div>
      </FadeIn>
    </PanelShell>
  );
}
