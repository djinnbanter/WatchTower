import { html, useState, useCallback, useEffect, useMemo } from '../../lib/preact.js';
import {
  reports, opsCache, crashGroups, ui,
} from '../../state/stores.js';
import {
  scanCrashes,
  acknowledgeAllCrashes,
  addToast,
  fetchCrashesGrouped,
} from '../../state/actions.js';
import { navigate } from '../../app/router.js';
import { Page, Subnav, FreshnessBadge } from '../../ui/patterns/index.js';
import { Button } from '../../ui/primitives/index.js';
import { QueueTab } from './queue-tab.js';
import { enrichGroups } from './helpers.js';
import { ToolsTab } from './tools-tab.js';

const SUBNAV = [
  { value: 'review', label: 'Review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'tools', label: 'Tools' },
];

const VALID_CRASH_VIEWS = new Set(SUBNAV.map((o) => o.value));

/** Map legacy view= needs-review|all → review|reviewed. */
function normalizeView(raw) {
  if (raw === 'needs-review') return 'review';
  if (raw === 'all') return 'reviewed';
  if (VALID_CRASH_VIEWS.has(raw)) return raw;
  return null;
}

function resolveDeepLinkView(groupFp, groups) {
  if (!groupFp || !groups?.length) return 'review';
  const g = groups.find((x) => x.fingerprint === groupFp);
  if (!g) return 'review';
  return g.unreviewed > 0 ? 'review' : 'reviewed';
}

export function crashesBadgeCount() {
  return crashGroups.value?.unreviewed_groups ?? 0;
}

export function PageView() {
  const { params } = ui.value.route;
  const routeGroup = params?.group ? decodeURIComponent(String(params.group)) : null;
  const rawView = params?.view;
  const grouped = crashGroups.value;
  const facts = reports.value.facts;
  const opsCacheData = opsCache.value.data;
  const mods = facts?.optional?.mods ?? [];
  const crashesAt = grouped?.at ?? opsCache.value.at;

  const [scanning, setScanning] = useState(false);
  const [acking, setAcking] = useState(false);
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);

  useEffect(() => {
    if (!grouped?.groups?.length) {
      fetchCrashesGrouped?.();
    }
  }, []);

  // Normalize legacy views + deep links onto review|reviewed|tools
  useEffect(() => {
    if (deepLinkApplied) return;
    const normalized = normalizeView(rawView);
    if (rawView && normalized && normalized !== rawView) {
      const next = { view: normalized };
      if (routeGroup) next.group = routeGroup;
      navigate('crashes', next, { replace: true });
      setDeepLinkApplied(true);
      return;
    }
    if (VALID_CRASH_VIEWS.has(rawView)) {
      setDeepLinkApplied(true);
      return;
    }
    if (!routeGroup) {
      setDeepLinkApplied(true);
      return;
    }
    if (!grouped?.groups?.length) return;
    const view = resolveDeepLinkView(routeGroup, grouped.groups);
    navigate('crashes', { view, group: routeGroup }, { replace: true });
    setDeepLinkApplied(true);
  }, [routeGroup, grouped?.groups, deepLinkApplied, rawView]);

  const activeView = VALID_CRASH_VIEWS.has(rawView)
    ? rawView
    : (routeGroup && !rawView ? null : 'review');

  const effectiveView = activeView
    || (routeGroup ? resolveDeepLinkView(routeGroup, grouped?.groups) : 'review');

  const enriched = useMemo(
    () => enrichGroups(grouped, facts),
    [grouped, facts],
  );

  const latestAt =
    opsCacheData?.crashes?.latest?.mtime
    ?? grouped?.groups?.[0]?.last_at
    ?? null;

  const unreviewedCount = grouped?.unreviewed_groups ?? 0;

  const subnavOptions = useMemo(() => SUBNAV.map((opt) => (
    opt.value === 'review' && unreviewedCount > 0
      ? { ...opt, label: `Review (${unreviewedCount})` }
      : opt
  )), [unreviewedCount]);

  function handleViewChange(v) {
    if (v === 'tools') {
      navigate('crashes', { view: v });
      return;
    }
    const next = { view: v };
    if (routeGroup) {
      const g = grouped?.groups?.find((x) => x.fingerprint === routeGroup);
      const ok = g && (
        (v === 'review' && g.unreviewed > 0)
        || (v === 'reviewed' && !(g.unreviewed > 0))
      );
      if (ok) next.group = routeGroup;
    }
    navigate('crashes', next);
  }

  const handleScan = useCallback(async () => {
    setScanning(true);
    await scanCrashes(true);
    await fetchCrashesGrouped();
    setScanning(false);
    addToast('Crash scan complete', 'success');
  }, []);

  const handleAckAll = useCallback(async () => {
    const n = grouped?.unreviewed ?? 0;
    if (!n) return;
    const ok = window.confirm(
      `Mark all ${n} unreviewed crash${n === 1 ? '' : 'es'} as reviewed? Files stay on disk.`,
    );
    if (!ok) return;
    setAcking(true);
    await acknowledgeAllCrashes({ scope: 'unreviewed' });
    setAcking(false);
  }, [grouped?.unreviewed]);

  const showQueue = effectiveView === 'review' || effectiveView === 'reviewed';

  return html`
    <${Page}
      title="Crashes"
      subtitle="Resolve crashes quickly — grouped problems with clear next steps"
      actions=${effectiveView === 'review' ? html`
        <div class="feat-toolbar">
          <${Button} kind="neutral" size="sm" loading=${scanning} onClick=${handleScan}>
            Scan now
          </${Button}>
        </div>
      ` : null}
    >
      <div data-tour="crashes" class="ui-page__stack crashes-page">
        <div class="feat-crashes-nav">
          <${Subnav}
            options=${subnavOptions}
            value=${effectiveView}
            onChange=${handleViewChange}
          />
        </div>

        ${effectiveView === 'tools' ? html`
          <${ToolsTab}
            grouped=${grouped}
            latestAt=${latestAt}
            onScan=${handleScan}
            scanning=${scanning}
            onAckAll=${handleAckAll}
            acking=${acking}
          />
        ` : showQueue ? html`
          <${QueueTab}
            mode=${effectiveView}
            enriched=${enriched}
            mods=${mods}
            routeKey=${routeGroup}
            onScan=${handleScan}
            scanning=${scanning}
          />
        ` : null}

        ${crashesAt ? html`
          <div class="crashes-freshness">
            <${FreshnessBadge} layer="scan" at=${crashesAt} />
          </div>
        ` : null}
      </div>
    </${Page}>
  `;
}
