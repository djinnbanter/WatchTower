import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCanWrite } from '@/app/permissions';
import { navigate, type RouteState } from '@/app/router';
import { useSessionStore } from '@/state/session';
import { FadeIn, HeroWatermark, PageEnter } from '@/ui/motion';
import { Button, ErrorState, HeroCard, HeroTabNav, MetricReadout, StatusPill } from '@/ui/patterns';
import { Bug } from '@/ui/icons';
import { asRecord, num } from '@/lib/utils';
import {
  enrichGroups,
  filterEnriched,
  formatAge,
  inboxKeyForFile,
  normalizeView,
  resolveDeepLinkView,
  type KindFilter,
} from './helpers';
import { type GroupedCrashes } from './groups';
import { CrashQueue } from './queue';
import { CrashTools } from './tools';
import './crashes.css';

const VIEW_ONLY_TITLE = 'Your account can view Watchtower but not change it';

const VIEWS = [
  { id: 'review', label: 'Review' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'tools', label: 'Tools' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];
type IconCmp = ComponentType<{ size?: number; className?: string }>;
const BugIcon = Bug as IconCmp;

function VitalTile({
  label,
  value,
  tone = 'default',
  format,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
  format?: (n: number) => string;
}) {
  return (
    <div className="cr-vital">
      <MetricReadout
        label={label}
        value={value}
        format={format ?? ((n) => String(Math.round(n)))}
        size="sm"
        tone={tone}
      />
    </div>
  );
}

function nextReviewFingerprint(
  enriched: ReturnType<typeof enrichGroups>,
  currentFp: string | null,
): string | null {
  const open = enriched.filter((r) => r.group.unreviewed > 0);
  if (!open.length) return null;
  const idx = open.findIndex((r) => r.group.fingerprint === currentFp);
  if (idx < 0) return open[0]?.group.fingerprint ?? null;
  return open[(idx + 1) % open.length]?.group.fingerprint ?? null;
}

export function PageView({ route }: { route: RouteState }) {
  const queryClient = useQueryClient();
  const canWrite = useCanWrite();
  const dismissInbox = useSessionStore((s) => s.dismissInbox);
  const undismissInbox = useSessionStore((s) => s.undismissInbox);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [deepLinkDone, setDeepLinkDone] = useState(false);
  const [clearedSelection, setClearedSelection] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const crashesQ = useQuery({
    queryKey: ['crashes-grouped'],
    queryFn: api.crashesGrouped,
    refetchInterval: 20_000,
  });
  const factsQ = useQuery({
    queryKey: ['facts'],
    queryFn: api.facts,
    // Facts enrich fix plans; /api/crashes already carries grouped rows without them.
    retry: false,
  });

  const grouped = asRecord(crashesQ.data) as unknown as GroupedCrashes;
  const facts = asRecord(factsQ.data);

  const enrichedAll = useMemo(() => enrichGroups(grouped, facts), [grouped, facts]);

  const invalidateCrashQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['crashes-grouped'] });
    void queryClient.invalidateQueries({ queryKey: ['crashes-acks'] });
    void queryClient.invalidateQueries({ queryKey: ['ops-cache'] });
    void queryClient.invalidateQueries({ queryKey: ['overview-meta'] });
  };

  const ackMutation = useMutation({
    mutationFn: (payload: { file: string; reviewed: boolean }) => api.ackCrash(payload),
    onSuccess: (_data, vars) => {
      const key = inboxKeyForFile(vars.file);
      if (vars.reviewed) dismissInbox(key);
      else undismissInbox(key);
      invalidateCrashQueries();
    },
  });

  const ackAllMutation = useMutation({
    mutationFn: () => api.acknowledgeAllCrashes({ scope: 'unreviewed' }),
    onSuccess: () => {
      for (const row of enrichedAll) {
        for (const m of row.group.members) {
          if (!m.acknowledged) dismissInbox(inboxKeyForFile(m.file));
        }
      }
      invalidateCrashQueries();
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => api.scanCrashes(),
    onSuccess: () => invalidateCrashQueries(),
  });

  useEffect(() => {
    if (deepLinkDone) return;
    const normalized = normalizeView(route.view);
    if (route.view && normalized && normalized !== route.view) {
      navigate({ tab: 'crashes', view: normalized, group: route.group ?? null }, true);
      setDeepLinkDone(true);
      return;
    }
    if (normalized) {
      setDeepLinkDone(true);
      return;
    }
    if (!route.group) {
      navigate({ tab: 'crashes', view: 'review', group: null }, true);
      setDeepLinkDone(true);
      return;
    }
    if (!grouped?.groups?.length) {
      if (!crashesQ.isLoading) setDeepLinkDone(true);
      return;
    }
    const view = resolveDeepLinkView(route.group, grouped.groups);
    navigate({ tab: 'crashes', view, group: route.group }, true);
    setDeepLinkDone(true);
  }, [route.view, route.group, grouped?.groups, deepLinkDone, crashesQ.isLoading]);

  const resolvedView: ViewId =
    normalizeView(route.view) ??
    (route.group ? resolveDeepLinkView(route.group, grouped?.groups) : 'review');

  const reviewItems = useMemo(
    () =>
      filterEnriched(enrichedAll, {
        search,
        kind: kindFilter,
        needsReviewOnly: true,
      }),
    [enrichedAll, search, kindFilter],
  );

  const reviewedItems = useMemo(
    () =>
      filterEnriched(enrichedAll, {
        search,
        reviewedOnly: true,
      }),
    [enrichedAll, search],
  );

  const listForMode = resolvedView === 'reviewed' ? reviewedItems : reviewItems;

  const selectedFp = clearedSelection
    ? null
    : listForMode.find((r) => r.group.fingerprint === route.group)?.group.fingerprint ??
      (route.group
        ? enrichedAll.find((r) => r.group.fingerprint === route.group)?.group.fingerprint ?? null
        : listForMode[0]?.group.fingerprint ?? null);

  useEffect(() => {
    if (route.group) setClearedSelection(false);
  }, [route.group]);

  useEffect(() => {
    if (!selectedFp) {
      setSelectedFile(null);
      return;
    }
    const row = enrichedAll.find((r) => r.group.fingerprint === selectedFp);
    const members = row?.group.members ?? [];
    if (!members.some((m) => m.file === selectedFile)) {
      const lead = members.find((m) => !m.acknowledged) || members[0];
      setSelectedFile(lead?.file ?? null);
    }
  }, [selectedFp, enrichedAll, selectedFile]);

  const needsReview = num(grouped?.unreviewed_groups, reviewItems.length);
  const unreviewedFiles = num(grouped?.unreviewed, 0);
  const total = num(grouped?.count, enrichedAll.reduce((n, r) => n + r.group.count, 0));
  const reviewedCount = enrichedAll.filter((r) => !(r.group.unreviewed > 0)).length;
  const latestAt =
    enrichedAll.find((r) => r.group.unreviewed > 0)?.group.last_at ??
    enrichedAll[0]?.group.last_at ??
    null;
  const waiting = !enrichedAll.length && !crashesQ.isLoading;
  const heroTone = needsReview > 0 ? 'danger' : waiting ? 'info' : 'ok';

  const selectGroup = (fp: string | null) => {
    if (fp == null) {
      setClearedSelection(true);
      navigate({ tab: 'crashes', view: resolvedView, group: null });
      return;
    }
    setClearedSelection(false);
    navigate({ tab: 'crashes', view: resolvedView, group: fp });
  };

  const markGroupMutation = useMutation({
    mutationFn: async (fp: string) => {
      const row = enrichedAll.find((r) => r.group.fingerprint === fp);
      if (!row) return { fp, files: [] as string[] };
      const files = row.group.members.filter((m) => !m.acknowledged).map((m) => m.file);
      for (const file of files) {
        await api.ackCrash({ file, reviewed: true });
        dismissInbox(inboxKeyForFile(file));
      }
      return { fp, files };
    },
    onSuccess: (result) => {
      invalidateCrashQueries();
      const next = nextReviewFingerprint(
        reviewItems.filter((r) => r.group.fingerprint !== result.fp),
        result.fp,
      );
      selectGroup(next);
    },
  });

  const busy =
    ackMutation.isPending ||
    ackAllMutation.isPending ||
    scanMutation.isPending ||
    markGroupMutation.isPending;

  const ackFile = (file: string, reviewed: boolean) => {
    ackMutation.mutate(
      { file, reviewed },
      {
        onSuccess: () => {
          if (reviewed && resolvedView === 'review') {
            const next = nextReviewFingerprint(reviewItems, selectedFp);
            if (next && next !== selectedFp) selectGroup(next);
          }
        },
      },
    );
  };

  const markGroup = (fp: string) => {
    markGroupMutation.mutate(fp);
  };

  const undoFile = (file: string) => {
    ackFile(file, false);
    navigate({ tab: 'crashes', view: 'review', group: selectedFp });
  };

  const markAll = () => {
    if (unreviewedFiles <= 0) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `Mark all ${unreviewedFiles} unreviewed crash${unreviewedFiles === 1 ? '' : 'es'} as reviewed? Files stay on disk.`,
      )
    ) {
      return;
    }
    ackAllMutation.mutate();
  };

  useEffect(() => {
    if (resolvedView === 'tools') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const typing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        if (!listForMode.length) return;
        const idx = Math.max(
          0,
          listForMode.findIndex((r) => r.group.fingerprint === selectedFp),
        );
        const nextIdx =
          e.key === 'j'
            ? Math.min(listForMode.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        const next = listForMode[nextIdx];
        if (next) {
          selectGroup(next.group.fingerprint);
          setSelectedFile(
            next.group.members.find((m) => !m.acknowledged)?.file ??
              next.group.members[0]?.file ??
              null,
          );
        }
        return;
      }
      if (e.key === 'r' && resolvedView === 'review' && selectedFp && !busy) {
        e.preventDefault();
        markGroup(selectedFp);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resolvedView, listForMode, selectedFp, busy]);

  const crashesLoading = crashesQ.isLoading && crashesQ.data === undefined;

  if (crashesLoading) {
    return (
      <PageEnter className="cr-stack">
        <div className="cr-skeleton">
          <div className="cr-skeleton__bar" />
          <div className="cr-skeleton__bar" style={{ width: '60%' }} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="cr-skeleton__panel" />
            <div className="cr-skeleton__panel" />
          </div>
        </div>
      </PageEnter>
    );
  }

  if (crashesQ.isError) {
    return (
      <ErrorState title="Couldn't load crashes">{(crashesQ.error as Error)?.message}</ErrorState>
    );
  }

  const hasSearchOrFilter =
    !!search.trim() || (resolvedView === 'review' && kindFilter !== 'all');

  return (
    <PageEnter className="cr-stack">
      <FadeIn>
        <HeroCard
          className={`cr-hero cr-hero--${heroTone}`}
          tone={heroTone}
          glowRadius={16}
          coneSpread={18}
        >
          <div className="cr-hero__body wt-hero-shell">
            <HeroWatermark icon={BugIcon} tone={needsReview > 0 ? 'danger' : 'ok'} />
            <div className="cr-hero__head">
              <div>
                <div className="cr-hero__title">
                  <h2>Crash inbox</h2>
                  <StatusPill tone={heroTone === 'ok' ? 'ok' : heroTone}>
                    {waiting ? 'Waiting' : needsReview > 0 ? `${needsReview} to review` : 'Clear'}
                  </StatusPill>
                </div>
                <p className="cr-hero__hint">
                  {waiting
                    ? 'Crash scan will fill this inbox when reports appear on disk.'
                    : 'Grouped by fingerprint — mark reviewed when triaged. / search · j/k move · r mark group'}
                </p>
              </div>
            </div>

            <HeroTabNav
              layoutGroupId="cr-views"
              className="cr-hero__tabs"
              aria-label="Crash views"
              value={resolvedView}
              items={VIEWS.map((v) => ({
                id: v.id,
                label: v.label,
                count: v.id === 'review' ? needsReview : null,
              }))}
              onChange={(id) =>
                navigate({
                  tab: 'crashes',
                  view: id,
                  group: id === 'tools' ? null : selectedFp,
                })
              }
            />

            <div className="cr-hero__search-row">
              <input
                ref={searchRef}
                className="cr-search cr-search--hero"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search crashes…"
                aria-label="Search crashes"
                disabled={resolvedView === 'tools'}
              />
              {resolvedView === 'review' && unreviewedFiles > 0 ? (
                <Button
                  disabled={!canWrite || busy}
                  title={canWrite ? undefined : VIEW_ONLY_TITLE}
                  onClick={markAll}
                >
                  Mark all reviewed
                </Button>
              ) : null}
            </div>

            <div className="cr-vitals">
              <VitalTile
                label="Needs review"
                value={needsReview}
                tone={needsReview ? 'danger' : 'default'}
              />
              <VitalTile
                label="Unreviewed files"
                value={unreviewedFiles}
                tone={unreviewedFiles ? 'warn' : 'default'}
              />
              <VitalTile
                label="Latest age"
                value={latestAt ? 1 : 0}
                format={() => (latestAt ? formatAge(latestAt) : '—')}
              />
              <VitalTile label="Reviewed" value={reviewedCount} tone="default" />
            </div>
          </div>
        </HeroCard>
      </FadeIn>

      <FadeIn>
        {resolvedView === 'tools' ? (
          <CrashTools
            needsReview={needsReview}
            total={total}
            unreviewedFiles={unreviewedFiles}
            latestAt={latestAt}
            onMarkAll={markAll}
            onScan={() => scanMutation.mutate()}
            busy={busy}
          />
        ) : (
          <CrashQueue
            mode={resolvedView === 'reviewed' ? 'reviewed' : 'review'}
            items={listForMode}
            allCount={enrichedAll.length}
            selectedFp={selectedFp}
            selectedFile={selectedFile}
            onSelect={selectGroup}
            onSelectFile={setSelectedFile}
            onAckFile={ackFile}
            onMarkGroup={markGroup}
            onUndoFile={undoFile}
            marking={busy}
            kindFilter={kindFilter}
            onKindFilter={setKindFilter}
            waiting={waiting}
            hasSearchOrFilter={hasSearchOrFilter}
          />
        )}
      </FadeIn>
    </PageEnter>
  );
}
