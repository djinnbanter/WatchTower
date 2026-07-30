import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  roleLabel,
  useCanWrite,
  useRole,
  usernameFromSession,
  VIEW_ONLY_TITLE,
} from '@/app/permissions';
import { GROUPS, getPages, type PageDef } from '@/app/registry';
import { hrefFor, navigate, type RouteState } from '@/app/router';
import { isFixturePreview } from '@/app/runtime';
import { useSessionStore } from '@/app/session-store';
import { useTheme, type Theme } from '@/app/theme';
import { asRecord, cn, get, str } from '@/lib/utils';
import { isCaptureMode } from '@/app/capture-mode';
import { SupportBuilderModal } from '@/features/support';
import { StatusPill } from '@/ui/patterns';
import '@/features/register';
import './shell.css';

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
  const canWrite = useCanWrite();
  const session = useSessionStore((s) => s.session);
  const resetToLogin = useSessionStore((s) => s.resetToLogin);
  const queryClient = useQueryClient();
  const role = useRole();
  const username = usernameFromSession(session);
  const initial = username.slice(0, 1).toUpperCase();
  const fixture = isFixturePreview();
  const [signingOut, setSigningOut] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [capture, setCapture] = useState(isCaptureMode);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const pages = getPages();
  const themeCycle = THEME_CYCLE[theme];
  const ThemeIcon = themeCycle.icon;

  async function onSignOut() {
    if (fixture || signingOut) return;
    setSigningOut(true);
    try {
      await api.logout();
    } catch {
      // Cookie may already be gone; still clear local UI.
    }
    queryClient.clear();
    resetToLogin();
    setSigningOut(false);
  }

  const liveQ = useQuery({ queryKey: ['live'], queryFn: api.live, staleTime: 30_000 });
  const factsQ = useQuery({ queryKey: ['facts'], queryFn: api.facts, staleTime: 60_000 });
  const hostname =
    str(get(liveQ.data, 'hostname')) ||
    str(get(asRecord(factsQ.data).minecraft, 'hostname')) ||
    str(get(asRecord(factsQ.data).system, 'hostname')) ||
    'Fixture';

  useEffect(() => {
    setNavOpen(false);
  }, [route.tab, route.view, route.panel]);

  // Shared scrollport keeps position across SPA tab changes — reset on tab switch.
  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [route.tab]);

  useEffect(() => {
    const onOpenSupport = () => setSupportOpen(true);
    window.addEventListener('wt:open-support', onOpenSupport);
    return () => window.removeEventListener('wt:open-support', onOpenSupport);
  }, []);

  useEffect(() => {
    const onCapture = () => setCapture(isCaptureMode());
    window.addEventListener('wt:capture-change', onCapture);
    return () => window.removeEventListener('wt:capture-change', onCapture);
  }, []);

  const rail = (
    <nav className="sh-rail" aria-label="Main navigation">
      <div className="sh-rail__brand">
        <img
          src="./assets/watchtower-icon-simple.png"
          alt=""
          width={28}
          height={28}
          className="sh-rail__brand-mark"
        />
        <div className="sh-rail__brand-text min-w-0">
          <div className="sh-rail__brand-title truncate">WatchTower</div>
          <div className="sh-rail__brand-host truncate">{hostname}</div>
        </div>
      </div>

      <div className="sh-rail__scroll">
        {GROUPS.map((group) => {
          const groupPages = pages.filter((p) => p.group === group.id && p.rail !== false);
          if (!groupPages.length) return null;
          return (
            <div key={group.id} className="sh-rail__group">
              <div className="sh-rail__group-label">{group.label}</div>
              <div>
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
                      className={cn('sh-rail__link', active && 'is-active')}
                    >
                      {PageIcon ? (
                        <PageIcon size={16} className="sh-rail__link-icon" aria-hidden />
                      ) : null}
                      <span className="truncate">{p.title}</span>
                      {badge != null && badge !== 0 ? (
                        <span className="sh-rail__badge">{badge}</span>
                      ) : null}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sh-rail__foot">
        <div className="sh-rail__account">
          <div className="sh-rail__account-row">
            <span className="sh-rail__account-mark" aria-hidden>{initial}</span>
            <span className="sh-rail__account-name" title={username}>{username}</span>
          </div>
          <div className="sh-rail__account-meta">
            <span className="sh-rail__account-role">{roleLabel(role)}</span>
            <button
              type="button"
              className="sh-rail__sign-out"
              disabled={fixture || signingOut}
              title={fixture ? 'Not available in fixture preview' : undefined}
              aria-label={signingOut ? 'Signing out' : 'Sign out'}
              onClick={() => void onSignOut()}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
        <button
          type="button"
          disabled={!canWrite}
          title={canWrite ? undefined : VIEW_ONLY_TITLE}
          onClick={() => setSupportOpen(true)}
          className="sh-rail__cta"
        >
          <LifeBuoy size={16} /> Build support pack
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Cycle colour theme"
          className="sh-rail__theme"
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
          <div className="relative z-10 h-full border-r border-wt-line shadow-[0_8px_24px_rgba(0,0,0,0.45)]">{rail}</div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-wt-line bg-wt-bg1 px-4">
          <button
            type="button"
            className="inline-flex rounded-[var(--radius-wt-sm)] border border-wt-line p-2 md:hidden"
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{hostname}</div>
            <div className={cn('truncate text-xs text-wt-text-low', capture && 'wt-capture-hide')}>
              {isFixturePreview() ? 'Fixture preview' : 'Server ops dashboard'}
            </div>
          </div>
          {canWrite ? null : (
            <StatusPill tone="info" title="An owner can change your role in Settings → Accounts">
              View only
            </StatusPill>
          )}
        </header>

        {/* Full-width scrollport so the scrollbar sits on the viewport edge, not the 1400px column. */}
        <div
          ref={pageScrollRef}
          className="wt-page-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
        >
          <main
            id="content"
            className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-col px-4 py-6 md:px-8"
          >
            {!hideShellTitle ? (
              <div className="mb-6 shrink-0">
                <h1 className="text-3xl font-semibold tracking-tight">{page?.title ?? route.tab}</h1>
                {page?.subtitle ? <p className="mt-1 text-sm text-wt-text-mid">{page.subtitle}</p> : null}
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
      <SupportBuilderModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
