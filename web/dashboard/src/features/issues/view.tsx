import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCanWrite, VIEW_ONLY_TITLE } from '@/app/permissions';
import { navigate, type RouteState } from '@/app/router';
import { useSessionStore } from '@/state/session';
import { FadeIn, HeroWatermark, PageEnter } from '@/ui/motion';
import { Button, ErrorState, HeroCard, HeroTabNav, StatusPill, VitalTile } from '@/ui/patterns';
import { AlertTriangle } from '@/ui/icons';
import { asArray, asRecord, str } from '@/lib/utils';
import {
  acksMapFromResponse,
  buildActiveItems,
  buildReviewedItems,
  canonicalIssueParam,
  filterItems,
  findIssue,
  groupByBand,
  resolveDeepLinkView,
  type IssueItem,
} from './helpers';
import { IssuesQueue } from './queue';
import { IssuesTools, nextActiveKey, type SuppressionRow } from './tools';
import './issues.css';

const VIEWS = [
  { id: 'active', label: 'Active' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'tools', label: 'Tools' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];
type IconCmp = ComponentType<{ size?: number; className?: string }>;
const WarnIcon = AlertTriangle as IconCmp;

function bootPanelFromRoute(panel: string | undefined): string | null {
  if (panel === 'boot' || panel === 'boot-warn' || panel === 'boot-error') return panel;
  return null;
}

export function PageView({ route }: { route: RouteState }) {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite();
  const dismissInbox = useSessionStore((s) => s.dismissInbox);
  const undismissInbox = useSessionStore((s) => s.undismissInbox);
  const bootPanel = bootPanelFromRoute(route.panel);
  const [search, setSearch] = useState('');

  const peekQ = useQuery({ queryKey: ['issues-peek'], queryFn: api.issuesPeek, refetchInterval: 15_000 });
  const opsQ = useQuery({ queryKey: ['ops-cache'], queryFn: api.opsCache, refetchInterval: 10_000 });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts });
  const acksQ = useQuery({ queryKey: ['issues-acks'], queryFn: api.issuesAcks });
  const suppressQ = useQuery({ queryKey: ['issues-suppressions'], queryFn: api.issueSuppressions });

  const invalidateIssueQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['issues-acks'] });
    void queryClient.invalidateQueries({ queryKey: ['issues-peek'] });
    void queryClient.invalidateQueries({ queryKey: ['issues-suppressions'] });
    void queryClient.invalidateQueries({ queryKey: ['ops-cache'] });
    void queryClient.invalidateQueries({ queryKey: ['overview-meta'] });
  };

  const ackMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.ackIssue(payload),
    onSuccess: invalidateIssueQueries,
  });
  const ackAllMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.acknowledgeAllIssues(payload),
    onSuccess: invalidateIssueQueries,
  });
  const suppressMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.suppressIssue(payload),
    onSuccess: invalidateIssueQueries,
  });
  const unsuppressMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.unsuppressIssue(payload),
    onSuccess: invalidateIssueQueries,
  });

  const peek = asRecord(peekQ.data);
  const ops = asRecord(opsQ.data);
  const facts = asRecord(factsQ.data);
  const acks = acksMapFromResponse(acksQ.data);

  const suppressions: SuppressionRow[] = useMemo(() => {
    const data = asRecord(suppressQ.data);
    const list = asArray<Record<string, unknown>>(data.suppressions);
    if (list.length) {
      return list.map((r) => ({
        id: str(r.id),
        message: str(r.message, str(r.id)),
        severity: str(r.severity, 'warning'),
      }));
    }
    return asArray<string>(data.ids).map((id) => ({ id, message: id, severity: 'warning' }));
  }, [suppressQ.data]);

  const suppressedIds = useMemo(() => new Set(suppressions.map((s) => s.id)), [suppressions]);

  const activeAll = useMemo(
    () => buildActiveItems({ peek, ops, facts, acks, suppressedIds }),
    [peek, ops, facts, acks, suppressedIds],
  );
  const reviewedAll = useMemo(
    () => buildReviewedItems({ peek, ops, facts, acks }),
    [peek, ops, facts, acks],
  );

  const resolvedView: ViewId = useMemo(() => {
    const requested = (route.view as ViewId) || 'active';
    if (!route.issue) return requested;
    return resolveDeepLinkView(route.issue, activeAll, reviewedAll, suppressedIds);
  }, [route.view, route.issue, activeAll, reviewedAll, suppressedIds]);

  useEffect(() => {
    if (!route.issue) return;
    if (resolvedView !== route.view) {
      navigate({ tab: 'issues', view: resolvedView, issue: route.issue, panel: route.panel ?? null }, true);
    }
  }, [resolvedView, route.issue, route.view, route.panel]);

  const activeFiltered = useMemo(
    () =>
      filterItems(activeAll, {
        search,
        source: bootPanel ? 'boot' : 'all',
        bootPanel,
      }),
    [activeAll, search, bootPanel],
  );
  const reviewedFiltered = useMemo(
    () => filterItems(reviewedAll, { search }),
    [reviewedAll, search],
  );

  const bands = useMemo(() => groupByBand(activeFiltered), [activeFiltered]);
  const criticalCount = bands.find((b) => b.key === 'critical')?.items.length ?? 0;
  const warningCount = bands.find((b) => b.key === 'warning')?.items.length ?? 0;
  const infoCount = bands.find((b) => b.key === 'info')?.items.length ?? 0;

  const listForMode = resolvedView === 'reviewed' ? reviewedFiltered : activeFiltered;
  const selectedKey =
    findIssue(listForMode, route.issue)?.key ??
    findIssue(activeAll, route.issue)?.key ??
    findIssue(reviewedAll, route.issue)?.key ??
    null;

  const selectIssue = (key: string | null) => {
    navigate({
      tab: 'issues',
      view: resolvedView,
      issue: key,
      panel: bootPanel,
    });
  };

  const markReviewed = (item: IssueItem) => {
    const param = canonicalIssueParam(item);
    dismissInbox(param);
    dismissInbox(item.key);
    if (item.issueId) dismissInbox(item.issueId);
    const nextItem = activeFiltered.find((i) => i.key === nextActiveKey(activeFiltered, item.key));
    ackMutation.mutate(
      { id: item.key, key: item.key, reviewed: true, ack: true },
      {
        onSuccess: () => {
          navigate({
            tab: 'issues',
            view: 'active',
            issue: nextItem ? canonicalIssueParam(nextItem) : null,
            panel: bootPanel,
          });
        },
      },
    );
  };

  const moveToActive = (item: IssueItem) => {
    undismissInbox(item.key);
    if (item.issueId) undismissInbox(item.issueId);
    ackMutation.mutate(
      { id: item.key, key: item.key, reviewed: false, ack: false },
      {
        onSuccess: () => {
          navigate({ tab: 'issues', view: 'active', issue: item.key, panel: null });
        },
      },
    );
  };

  const suppress = (item: IssueItem) => {
    if (!item.issueId) return;
    suppressMutation.mutate(
      {
        issue_id: item.issueId,
        id: item.issueId,
        message: item.title,
        severity: item.severity,
      },
      {
        onSuccess: () => {
          navigate({ tab: 'issues', view: 'tools', issue: null, panel: null });
        },
      },
    );
  };

  const markAll = (keys: string[]) => {
    const filtered = keys.filter((k) => k !== 'crash:unreviewed');
    for (const k of filtered) dismissInbox(k);
    ackAllMutation.mutate({ ids: filtered });
  };

  const restore = (id: string) => {
    unsuppressMutation.mutate({ issue_id: id, id });
  };

  const loading = peekQ.isLoading || opsQ.isLoading || factsQ.isLoading || acksQ.isLoading;
  const err = peekQ.error || opsQ.error || acksQ.error;

  if (loading) {
    return (
      <PageEnter className="is-stack">
        <div className="is-skeleton">
          <div className="is-skeleton__bar" />
          <div className="is-skeleton__bar" style={{ width: '60%' }} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="is-skeleton__panel" />
            <div className="is-skeleton__panel" />
          </div>
        </div>
      </PageEnter>
    );
  }

  if (err) {
    return <ErrorState title="Couldn't load issues">{(err as Error)?.message}</ErrorState>;
  }

  const waiting =
    !Object.keys(ops).length && !Object.keys(peek).length && !asArray(facts.issues).length;

  const busy =
    ackMutation.isPending ||
    ackAllMutation.isPending ||
    suppressMutation.isPending ||
    unsuppressMutation.isPending;

  const markAllKeys = activeAll.filter((i) => i.key !== 'crash:unreviewed').map((i) => i.key);
  const heroCritical = groupByBand(activeAll).find((b) => b.key === 'critical')?.items.length ?? 0;
  const heroWarning = groupByBand(activeAll).find((b) => b.key === 'warning')?.items.length ?? 0;
  const heroInfo = groupByBand(activeAll).find((b) => b.key === 'info')?.items.length ?? 0;
  const heroTone =
    heroCritical > 0 ? 'danger' : heroWarning > 0 ? 'warn' : activeAll.length ? 'info' : 'ok';

  return (
    <PageEnter className="is-stack">
      <FadeIn>
        <HeroCard
          className={`is-hero is-hero--${heroTone}`}
          tone={heroTone}
          glowRadius={16}
          coneSpread={18}
        >
          <div className="is-hero__body wt-hero-shell">
            <HeroWatermark
              icon={WarnIcon}
              tone={heroCritical > 0 ? 'danger' : heroWarning > 0 ? 'warn' : 'info'}
            />
            <div className="is-hero__main">
              <div className="is-hero__head">
                <div className="is-hero__title-block">
                  <div className="is-hero__title">
                    <h2>Fix queue</h2>
                    <StatusPill tone={heroTone === 'ok' ? 'ok' : heroTone}>
                      {waiting ? 'Waiting' : `${activeAll.length} active`}
                    </StatusPill>
                  </div>
                  <p className="is-hero__hint">
                    {waiting
                      ? 'Ops cache and live peek will fill this queue.'
                      : 'Grouped by severity — mark reviewed when triaged.'}
                  </p>
                </div>
              </div>

              <HeroTabNav
                layoutGroupId="is-views"
                className="is-hero__tabs"
                aria-label="Issues views"
                value={resolvedView}
                items={VIEWS.map((v) => ({
                  id: v.id,
                  label: v.label,
                  count:
                    v.id === 'active'
                      ? activeAll.length
                      : v.id === 'reviewed'
                        ? reviewedAll.length
                        : null,
                }))}
                onChange={(id) =>
                  navigate({
                    tab: 'issues',
                    view: id,
                    issue: null,
                    panel: id === 'active' ? bootPanel : null,
                  })
                }
              />

              <div className="is-hero__search-row">
                <input
                  className="is-search is-search--hero"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search issues…"
                  aria-label="Search issues"
                  disabled={resolvedView === 'tools'}
                />
                {bootPanel && resolvedView === 'active' ? (
                  <Button
                    onClick={() =>
                      navigate({ tab: 'issues', view: 'active', panel: null, issue: selectedKey })
                    }
                  >
                    Clear boot filter
                  </Button>
                ) : null}
                {resolvedView === 'active' && criticalCount + warningCount + infoCount > 0 ? (
                  <Button
                    disabled={!canWrite || busy}
                    title={canWrite ? undefined : VIEW_ONLY_TITLE}
                    onClick={() => markAll(markAllKeys)}
                  >
                    Mark all reviewed
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="is-vitals" aria-label="Issue severity counts">
              <VitalTile className="is-vital" label="Critical" value={heroCritical} tone={heroCritical ? 'danger' : 'default'} />
              <VitalTile className="is-vital" label="Warning" value={heroWarning} tone={heroWarning ? 'warn' : 'default'} />
              <VitalTile className="is-vital" label="Info" value={heroInfo} tone="default" />
              <VitalTile className="is-vital" label="Reviewed" value={reviewedAll.length} tone="default" />
            </div>
          </div>
        </HeroCard>
      </FadeIn>

      {resolvedView === 'tools' ? (
        <IssuesTools
          criticalCount={heroCritical}
          warningCount={heroWarning}
          infoCount={heroInfo}
          reviewedCount={reviewedAll.length}
          activeKeys={markAllKeys}
          suppressions={suppressions}
          onMarkAll={markAll}
          onRestore={restore}
          busy={busy}
        />
      ) : (
        <IssuesQueue
          mode={resolvedView === 'reviewed' ? 'reviewed' : 'active'}
          items={listForMode}
          selectedKey={selectedKey}
          onSelect={selectIssue}
          onMarkReviewed={markReviewed}
          onMoveToActive={moveToActive}
          onSuppress={suppress}
          marking={busy}
        />
      )}
    </PageEnter>
  );
}
