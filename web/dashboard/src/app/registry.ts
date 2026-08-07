import type { ComponentType, LazyExoticComponent } from 'react';
import type { RouteState } from '@/app/router';

export type PageComponent = ComponentType<{ route: RouteState }>;

/** Nested rail link under a parent page (same tab, different `view`). */
export type PageRailChild = {
  id: string;
  title: string;
  /** Query `view=` value. */
  view: string;
  badge?: () => number | string | null;
};

export type PageDef = {
  id: string;
  title: string;
  group: 'monitor' | 'triage' | 'ops' | 'system';
  order: number;
  icon: string;
  subtitle?: string;
  /** When false, page stays registered (deep links / aliases) but is hidden from the rail. Default true. */
  rail?: boolean;
  /**
   * When true, AppShell skips the page H1/subtitle — the page renders its own mission hero.
   * Use for Overview, Live, Issues, Crashes, Spark, Session, Startup, Backups, Activity, Sources.
   */
  hideShellTitle?: boolean;
  render: PageComponent | LazyExoticComponent<PageComponent>;
  badge?: () => number | string | null;
  /** Nested subpages in the main rail (e.g. Mods → Conflicts). */
  children?: PageRailChild[];
};

const pages = new Map<string, PageDef>();

export function registerPage(def: PageDef) {
  pages.set(def.id, def);
}

export function getPages() {
  return [...pages.values()].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getPage(id: string) {
  return pages.get(id);
}

export const GROUPS = [
  { id: 'monitor' as const, label: 'Monitor' },
  { id: 'triage' as const, label: 'Triage' },
  { id: 'ops' as const, label: 'Ops' },
  { id: 'system' as const, label: 'System' },
];
