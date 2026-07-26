import type { ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
} from '@/ui/icons';
import { navigate } from '@/app/router';
import { asRecord, num, str } from '@/lib/utils';

export const VIEWS = [
  { id: 'patterns', label: 'Patterns' },
  { id: 'configs', label: 'Configs' },
  { id: 'mod-changes', label: 'Mod changes' },
  { id: 'storage', label: 'Storage' },
] as const;

export const PANELS = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'load', label: 'Load' },
  { id: 'incidents', label: 'Incidents' },
] as const;

/** Unified Insights nav — Patterns panels + top-level views in one bar. */
export const INSIGHTS_NAV = [
  { id: 'overview', label: 'Overview', view: 'patterns' as const, panel: 'overview' as const },
  { id: 'schedule', label: 'Schedule', view: 'patterns' as const, panel: 'schedule' as const },
  { id: 'load', label: 'Load', view: 'patterns' as const, panel: 'load' as const },
  { id: 'incidents', label: 'Incidents', view: 'patterns' as const, panel: 'incidents' as const },
  { id: 'configs', label: 'Configs', view: 'configs' as const, panel: null },
  { id: 'mod-changes', label: 'Mod changes', view: 'mod-changes' as const, panel: null },
  { id: 'storage', label: 'Storage', view: 'storage' as const, panel: null },
] as const;

export type InsightsView = (typeof VIEWS)[number]['id'];
export type InsightsPanel = (typeof PANELS)[number]['id'];
export type InsightsNavId = (typeof INSIGHTS_NAV)[number]['id'];

export function activeInsightsNavId(view: string, panel: string): InsightsNavId {
  if (view === 'patterns') {
    const match = PANELS.find((p) => p.id === panel);
    return (match?.id ?? 'overview') as InsightsNavId;
  }
  if (view === 'configs' || view === 'mod-changes' || view === 'storage') {
    return view;
  }
  return 'overview';
}

export function navigateInsightsNav(id: InsightsNavId) {
  const item = INSIGHTS_NAV.find((x) => x.id === id);
  if (!item) return;
  navigate({
    tab: 'insights',
    view: item.view,
    panel: item.panel,
  });
}

export const severityTone: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  critical: 'danger',
  warning: 'warn',
  warn: 'warn',
  info: 'info',
  ok: 'ok',
  pass: 'ok',
};

export function SubNav<T extends string>({
  items,
  active,
  onSelect,
}: {
  items: readonly { id: T; label: string }[];
  active: string;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-wt-line bg-wt-bg2/60 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            active === item.id
              ? 'bg-wt-accent text-white shadow'
              : 'text-wt-text-mid hover:bg-wt-bg3 hover:text-wt-text'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function DeltaBadge({ delta, invert = false }: { delta: number; invert?: boolean }) {
  const good = invert ? delta <= 0 : delta >= 0;
  const Icon = delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        good ? 'text-wt-ok' : 'text-wt-danger'
      }`}
    >
      <Icon size={12} />
      {Math.abs(delta).toFixed(1)}
    </span>
  );
}

/** Open a production-style `tab_link` string (`issues`, `live`, or `tab=x&view=y`). */
export function openTabLink(tabLink: string | null | undefined) {
  const raw = str(tabLink);
  if (!raw) return;
  if (raw.includes('=')) {
    const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
    const next: Record<string, string | null> = {};
    for (const [k, v] of params.entries()) next[k] = v;
    if (!next.tab) next.tab = 'insights';
    navigate(next);
    return;
  }
  navigate({ tab: raw, view: null, panel: null });
}

export function coveragePct(flagsCoverage: unknown): number {
  if (typeof flagsCoverage === 'number') {
    return flagsCoverage <= 1 ? flagsCoverage * 100 : flagsCoverage;
  }
  const row = asRecord(flagsCoverage);
  const matched = num(row.matched);
  const expected = num(row.expected);
  if (expected > 0) return (matched / expected) * 100;
  return 0;
}

export function formatCompareLabel(key: string) {
  return key.replace(/_/g, ' ');
}

export function invertDeltaKey(key: string) {
  return key !== 'players_peak' && key !== 'tps_avg';
}

export function PanelShell({ children }: { children: ReactNode }) {
  return <div className="in-panel space-y-6">{children}</div>;
}
