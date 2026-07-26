import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eclipse,
  LifeBuoy,
  Menu,
  Moon,
  resolvePageIcon,
  Sun,
  X,
  type WtIcon,
} from '@/ui/icons';
import { api } from '@/api/client';
import { GROUPS, getPages, type PageDef } from '@/app/registry';
import { hrefFor, navigate, type RouteState } from '@/app/router';
import { isFixturePreview } from '@/app/runtime';
import { useTheme, type Theme } from '@/app/theme';
import { asRecord, cn, get, str } from '@/lib/utils';
import { SupportBuilderModal } from '@/features/support';
import '@/features/register';

type Props = {
  route: RouteState;
  page?: PageDef;
  children: ReactNode;
};

const THEME_CYCLE: Record<Theme, { icon: WtIcon; label: string }> = {
  light: { icon: Moon, label: 'Dark theme' },
  dark: { icon: Eclipse, label: 'Black theme' },
  black: { icon: Sun, label: 'Light theme' },
};

export function AppShell({ route, page, children }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [navOpen, setNavOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const pages = getPages();
  const themeCycle = THEME_CYCLE[theme];
  const ThemeIcon = themeCycle.icon;

  const liveQ = useQuery({ queryKey: ['shell-live'], queryFn: api.live, staleTime: 30_000 });
  const factsQ = useQuery({ queryKey: ['shell-facts'], queryFn: api.facts, staleTime: 60_000 });
  const hostname =
    str(get(liveQ.data, 'hostname')) ||
    str(get(asRecord(factsQ.data).minecraft, 'hostname')) ||
    str(get(asRecord(factsQ.data).system, 'hostname')) ||
    'Fixture';

  useEffect(() => {
    setNavOpen(false);
  }, [route.tab, route.view, route.panel]);

  useEffect(() => {
    const onOpenSupport = () => setSupportOpen(true);
    window.addEventListener('wt:open-support', onOpenSupport);
    return () => window.removeEventListener('wt:open-support', onOpenSupport);
  }, []);

  const rail = (
    <nav className="flex h-full w-[220px] flex-col border-r border-wt-line bg-wt-bg1/90 backdrop-blur-xl" aria-label="Main navigation">
      <div className="flex items-center gap-2 border-b border-wt-line px-4 py-4">
        <img src="./assets/watchtower-icon-simple.png" alt="" width={28} height={28} className="rounded-md" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold tracking-tight">WatchTower</span>
          </div>
          <div className="truncate text-xs text-wt-text-low">{hostname}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {GROUPS.map((group) => {
          const groupPages = pages.filter((p) => p.group === group.id && p.rail !== false);
          if (!groupPages.length) return null;
          return (
            <div key={group.id} className="mb-4">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-wt-text-low">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {groupPages.map((p) => {
                  const active = route.tab === p.id;
                  const badge = p.badge?.();
                  const PageIcon = resolvePageIcon(p.icon);
                  return (
                    <a
                      key={p.id}
                      href={hrefFor(p.id)}
                      aria-current={active ? 'page' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate({ tab: p.id, view: null, panel: null });
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition',
                        active
                          ? 'bg-wt-accent-soft text-wt-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--wt-accent)_35%,transparent)]'
                          : 'text-wt-text-mid hover:bg-wt-bg3/70 hover:text-wt-text',
                      )}
                    >
                      {PageIcon ? (
                        <PageIcon
                          size={16}
                          className={cn(
                            'shrink-0',
                            active ? 'text-wt-accent' : 'text-wt-text-low',
                          )}
                          aria-hidden
                        />
                      ) : null}
                      <span className="truncate">{p.title}</span>
                      {badge != null && badge !== 0 ? (
                        <span className="ml-auto rounded-full bg-wt-danger/15 px-1.5 text-[10px] font-semibold text-wt-danger">
                          {badge}
                        </span>
                      ) : null}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-wt-line p-3">
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-wt-line bg-wt-bg2 px-3 py-2 text-sm font-medium text-wt-text-mid hover:text-wt-text"
        >
          <LifeBuoy size={16} /> Build support pack
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Cycle colour theme"
          className="flex w-full items-center gap-2 rounded-xl border border-wt-line bg-wt-bg2 px-3 py-2 text-sm text-wt-text-mid hover:text-wt-text"
        >
          <ThemeIcon size={16} />
          {themeCycle.label}
        </button>
      </div>
    </nav>
  );

  const hideShellTitle = page?.hideShellTitle === true;

  return (
    <div className="flex h-dvh overflow-hidden text-wt-text">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-wt-bg1 focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="hidden h-full shrink-0 md:block">{rail}</aside>

      {navOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden" aria-label="Mobile navigation">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
          <div className="relative z-10 h-full shadow-2xl">{rail}</div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-wt-line bg-wt-bg1/80 px-4 backdrop-blur-xl">
          <button
            type="button"
            className="inline-flex rounded-lg border border-wt-line p-2 md:hidden"
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{hostname}</div>
            <div className="truncate text-xs text-wt-text-low">
              {isFixturePreview() ? 'Fixture preview' : 'Server ops dashboard'}
            </div>
          </div>
        </header>

        <main id="content" className="mx-auto flex w-full max-w-[1400px] min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-6 md:px-8">
          {!hideShellTitle ? (
            <div className="mb-6 shrink-0">
              <h1 className="text-3xl font-semibold tracking-tight">{page?.title ?? route.tab}</h1>
              {page?.subtitle ? <p className="mt-1 text-sm text-wt-text-mid">{page.subtitle}</p> : null}
            </div>
          ) : null}
          {children}
        </main>
      </div>
      <SupportBuilderModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
