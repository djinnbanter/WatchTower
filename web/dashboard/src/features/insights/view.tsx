import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { RouteState } from '@/app/router';
import PillNav from '@/components/pill-nav/PillNav';
import { FadeIn, PageEnter } from '@/ui/motion';
import { ErrorState } from '@/ui/patterns';
import { asRecord } from '@/lib/utils';
import {
  INSIGHTS_NAV,
  activeInsightsNavId,
  navigateInsightsNav,
  type InsightsNavId,
  type InsightsPanel,
  type InsightsView,
} from './shared';
import { PatternsOverview } from './panels/patterns-overview';
import { PatternsSchedule } from './panels/patterns-schedule';
import { PatternsLoad } from './panels/patterns-load';
import { PatternsIncidents } from './panels/patterns-incidents';
import { ConfigsPanel } from './panels/configs';
import { ModChangesPanel } from './panels/mod-changes';
import { WorldPanel } from './panels/world';
import { StoragePanel } from './panels/storage';
import { WeeklyDigestPanel } from './panels/digest';
import './insights.css';

export function PageView({ route }: { route: RouteState }) {
  const view = (route.view as InsightsView) || 'patterns';
  const panel = (route.panel as InsightsPanel) || 'overview';
  const [windowKey, setWindowKey] = useState<'7d' | '30d'>('7d');
  const activeNav = activeInsightsNavId(view, panel);

  const dashQ = useQuery({
    queryKey: ['performance-dashboard', windowKey],
    queryFn: () => api.performanceDashboard(windowKey),
  });
  const opsQ = useQuery({ queryKey: ['ops-cache'], queryFn: api.opsCache });
  const liveQ = useQuery({ queryKey: ['live'], queryFn: api.live });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });

  if (dashQ.isLoading) {
    return (
      <PageEnter className="in-stack">
        <div className="h-10 w-72 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
        <div className="h-64 animate-pulse rounded-[var(--radius-wt)] bg-wt-bg2" />
      </PageEnter>
    );
  }
  if (dashQ.isError) {
    return (
      <ErrorState title="Couldn't load insights">{(dashQ.error as Error)?.message}</ErrorState>
    );
  }

  const dash = asRecord(dashQ.data);
  const ops = asRecord(opsQ.data);
  const live = asRecord(liveQ.data);
  const facts = asRecord(factsQ.data);

  return (
    <PageEnter className="in-stack">
      <PillNav
        className="in-pill-nav"
        items={INSIGHTS_NAV}
        activeId={activeNav}
        onSelect={(id) => navigateInsightsNav(id as InsightsNavId)}
        trailing={
          <div className="in-window" role="group" aria-label="Insights window">
            <span className="in-window__label">Window</span>
            <div className="in-window-pills">
              {(['7d', '30d'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindowKey(w)}
                  className={`in-window-pill${windowKey === w ? ' is-active' : ''}`}
                  aria-pressed={windowKey === w}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {view === 'patterns' ? (
        <FadeIn>
          <div className="space-y-6">
            {panel === 'overview' ? <PatternsOverview dash={dash} windowKey={windowKey} /> : null}
            {panel === 'schedule' ? <PatternsSchedule dash={dash} /> : null}
            {panel === 'load' ? <PatternsLoad dash={dash} windowKey={windowKey} /> : null}
            {panel === 'incidents' ? <PatternsIncidents dash={dash} /> : null}
          </div>
        </FadeIn>
      ) : null}

      {view === 'configs' ? (
        <FadeIn>
          <ConfigsPanel dash={dash} ops={ops} facts={facts} live={live} />
        </FadeIn>
      ) : null}
      {view === 'mod-changes' ? (
        <FadeIn>
          <ModChangesPanel ops={ops} />
        </FadeIn>
      ) : null}
      {view === 'world' ? (
        <FadeIn>
          <WorldPanel ops={ops} dash={dash} windowKey={windowKey} />
        </FadeIn>
      ) : null}
      {view === 'storage' ? (
        <FadeIn>
          <StoragePanel live={live} dash={dash} facts={facts} ops={ops} windowKey={windowKey} />
        </FadeIn>
      ) : null}
      {view === 'digest' ? (
        <FadeIn>
          <WeeklyDigestPanel />
        </FadeIn>
      ) : null}
    </PageEnter>
  );
}
