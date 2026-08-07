import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Eclipse,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  resolvePageIcon,
  SlidersHorizontal,
  Sun,
  X,
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
import { DemoBanner } from '@/app/demo-banner';
import { isFixturePreview } from '@/app/runtime';
import { useSessionStore } from '@/app/session-store';
import { AppearanceControls } from '@/app/appearance-controls';
import { useTheme } from '@/app/theme';
import { ACCENT_PRESETS } from '@/app/accents';
import { asRecord, cn, get, str } from '@/lib/utils';
import { SupportBuilderModal } from '@/features/support';
import { StatusPill } from '@/ui/patterns';
import { PlayerAvatar } from '@/ui/player-avatar';
import '@/features/register';
import './shell.css';
import './appearance-controls.css';

type Props = {
  route: RouteState;
  page?: PageDef;
  children: ReactNode;
};

function ThemeGlyph({ resolved }: { resolved: 'light' | 'dark' | 'black' }) {
  if (resolved === 'light') return <Sun size={14} aria-hidden />;
  if (resolved === 'black') return <Eclipse size={14} aria-hidden />;
  return <Moon size={14} aria-hidden />;
}

export function AppShell({ route, page, children }: Props) {
  const { themeMode, resolvedTheme, accent } = useTheme();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const customizeWrapRef = useRef<HTMLDivElement | null>(null);
  const customizePanelId = useId();
  const canWrite = useCanWrite();
  const session = useSessionStore((s) => s.session);
  const resetToLogin = useSessionStore((s) => s.resetToLogin);
  const queryClient = useQueryClient();
  const role = useRole();
  const username = usernameFromSession(session);
  const mcUuid =
    typeof session?.minecraft_uuid === 'string' ? session.minecraft_uuid : null;
  const mcName =
    typeof session?.minecraft_name === 'string' && session.minecraft_name.trim()
      ? session.minecraft_name.trim()
      : username;
  const accentSwatch =
    ACCENT_PRESETS.find((p) => p.id === accent)?.swatch ?? 'var(--wt-accent)';

  useEffect(() => {
    if (!customizeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCustomizeOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      const el = customizeWrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setCustomizeOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [customizeOpen]);
  const fixture = isFixturePreview();
  const [signingOut, setSigningOut] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const pages = getPages();

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
                  const tabActive = route.tab === p.id;
                  const currentView = route.view || 'overview';
                  const childViews = new Set((p.children ?? []).map((c) => c.view));
                  const parentActive =
                    tabActive && (!route.view || route.view === 'overview' || !childViews.has(currentView));
                  const sectionOpen = (p.children?.length ?? 0) > 0;
                  const badge = p.badge?.();
                  const PageIcon = resolvePageIcon(p.icon);
                  return (
                    <div key={p.id} className={cn('sh-rail__item', sectionOpen && 'is-open')}>
                      <a
                        href={hrefFor(p.id)}
                        aria-current={parentActive ? 'page' : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate({ tab: p.id, view: null, panel: null, filter: null, mod: null });
                        }}
                        className={cn(
                          'sh-rail__link',
                          parentActive && 'is-active',
                          tabActive && !parentActive && 'is-section',
                        )}
                      >
                        {PageIcon ? (
                          <PageIcon size={16} className="sh-rail__link-icon" aria-hidden />
                        ) : null}
                        <span className="truncate">{p.title}</span>
                        {badge != null && badge !== 0 ? (
                          <span className="sh-rail__badge">{badge}</span>
                        ) : null}
                      </a>
                      {p.children?.length ? (
                        <div className="sh-rail__children" role="group" aria-label={`${p.title} tools`}>
                          {p.children.map((child) => {
                            const childActive = tabActive && currentView === child.view;
                            const childBadge = child.badge?.();
                            return (
                              <a
                                key={child.id}
                                href={hrefFor(p.id, { view: child.view })}
                                aria-current={childActive ? 'page' : undefined}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate({
                                    tab: p.id,
                                    view: child.view,
                                    panel: null,
                                    filter: null,
                                    mod: null,
                                  });
                                }}
                                className={cn(
                                  'sh-rail__link',
                                  'sh-rail__link--child',
                                  childActive && 'is-active',
                                )}
                              >
                                <span className="truncate">{child.title}</span>
                                {childBadge != null && childBadge !== 0 ? (
                                  <span className="sh-rail__badge">{childBadge}</span>
                                ) : null}
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sh-rail__foot">
        <div className="sh-rail__account">
          <PlayerAvatar
            uuid={mcUuid}
            name={mcName}
            size={24}
            eager
            className="sh-rail__account-mark"
          />
          <div className="sh-rail__account-body">
            <span className="sh-rail__account-name" title={username}>
              {username}
            </span>
            <span className="sh-rail__account-role">{roleLabel(role)}</span>
          </div>
          <button
            type="button"
            className="sh-rail__sign-out"
            disabled={fixture || signingOut}
            title={
              fixture
                ? 'Not available in fixture preview'
                : signingOut
                  ? 'Signing out…'
                  : 'Sign out'
            }
            aria-label={signingOut ? 'Signing out' : 'Sign out'}
            onClick={() => void onSignOut()}
          >
            <LogOut size={14} aria-hidden />
            <span className="sh-rail__sign-out-label">
              {signingOut ? '…' : 'Sign out'}
            </span>
          </button>
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
        <div className="sh-rail__customize" ref={customizeWrapRef}>
          <button
            type="button"
            className={cn('sh-rail__customize-btn', customizeOpen && 'sh-rail__customize-btn--open')}
            aria-expanded={customizeOpen}
            aria-controls={customizePanelId}
            aria-label="Customize appearance"
            title="Customize appearance"
            onClick={() => setCustomizeOpen((v) => !v)}
          >
            <SlidersHorizontal size={14} aria-hidden />
            <span>Customize</span>
            <span className="sh-rail__customize-meta" aria-hidden>
              <ThemeGlyph resolved={resolvedTheme} />
              <span
                className="sh-rail__accent-dot"
                style={{ background: accentSwatch }}
              />
            </span>
          </button>
          {customizeOpen ? (
            <div
              id={customizePanelId}
              className="sh-rail__customize-pop"
              role="dialog"
              aria-label="Appearance"
            >
              <p className="sh-rail__customize-title">
                Appearance
                {themeMode === 'system' ? ' · follows system' : ''}
              </p>
              <AppearanceControls idPrefix="rail-appearance" compact />
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );

  const hideShellTitle = page?.hideShellTitle === true;

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-wt-text">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[var(--radius-wt)] focus:bg-wt-bg1 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <DemoBanner />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <aside className="hidden h-full shrink-0 md:block">{rail}</aside>

      {navOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden" aria-label="Mobile navigation">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close navigation" onClick={() => setNavOpen(false)} />
          <div className="relative z-10 h-full border-r border-wt-line shadow-[0_8px_24px_rgba(0,0,0,0.45)]">{rail}</div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile-only chrome: menu + view-only. Desktop hostname lives in the rail. */}
        <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-wt-line bg-wt-bg1 px-4 md:hidden">
          <button
            type="button"
            className="inline-flex rounded-[var(--radius-wt-sm)] border border-wt-line p-2"
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">WatchTower</div>
            <div className="truncate text-xs text-wt-text-low">{hostname}</div>
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
      </div>
      <SupportBuilderModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
