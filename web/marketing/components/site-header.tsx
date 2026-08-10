'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Wordmark } from '@/components/wordmark';
import { Cta } from '@/components/cta';
import { DEMO_URL } from '@/content/product';
import { ThemeToggle } from '@/components/theme-toggle';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { GithubMark } from '@/components/brand/github-mark';
import { LINKS } from '@/content/product';

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/install', label: 'Install' },
  { href: '/faq', label: 'FAQ' },
] as const;

const SOCIAL = [
  { href: LINKS.modrinth, label: 'Modrinth', Icon: ModrinthMark },
  { href: LINKS.github, label: 'GitHub', Icon: GithubMark },
] as const;

/** Nav chrome type — larger than wt-meta (10px) so links read at a glance. */
const navType =
  'font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em] no-underline transition-colors duration-200 md:text-xs md:tracking-[0.12em]';

/**
 * Flat industrial nav: solid plate, mono labels, ruled bottom edge.
 * On home, stays off-screen until the user scrolls past the hero.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  /** Home: hide until scroll. Other routes: always on. Mobile menu forces visible. */
  const visible = !isHome || scrolled || open;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-[color:var(--wt-line)] bg-[color:var(--wt-bg0)] pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
        }`}
      >
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 pr-[max(1rem,env(safe-area-inset-right))] md:gap-5 md:px-8 md:py-3.5">
          <Link href="/" className="inline-flex min-w-0 shrink items-center no-underline">
            <Wordmark size="md" className="max-w-full" />
          </Link>

          <nav aria-label="Primary" className="ml-auto hidden items-center lg:flex">
            {NAV.map((item, i) => {
              const active = pathname === item.href;
              return (
                <span key={item.href} className="inline-flex items-center">
                  {i > 0 ? (
                    <span
                      className="select-none px-1 font-mono text-xs text-[color:var(--wt-text-low)]"
                      aria-hidden
                    >
                      ///
                    </span>
                  ) : null}
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`${navType} px-1.5 py-2 ${
                      active
                        ? 'text-[color:var(--wt-accent)]'
                        : 'text-[color:var(--wt-text-mid)] hover:text-[color:var(--wt-text)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                </span>
              );
            })}
          </nav>

          <div className="hidden items-center gap-1.5 lg:flex">
            {SOCIAL.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-8 w-8 items-center justify-center text-[color:var(--wt-text-mid)] transition-colors duration-200 hover:text-[color:var(--wt-text)]"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
            <ThemeToggle />
            <Cta href={DEMO_URL} variant="ghost" size="sm" className="ml-0.5" newTab>
              Demo
            </Cta>
            <Cta href={LINKS.modrinth} withArrow size="sm" leading={<ModrinthMark className="h-3.5 w-3.5" />}>
              Download
            </Cta>
          </div>

          {/* Phone: theme + burger only — Modrinth/GitHub stay in the open menu so the burger isn't clipped. */}
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--wt-text)]"
              style={{ border: '1px solid var(--wt-line)' }}
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              <span aria-hidden className="relative block h-3.5 w-4">
                <span
                  className="absolute left-0 top-[1px] block h-[1.5px] w-4 origin-center bg-current transition-transform duration-200"
                  style={{
                    transform: open ? 'translateY(5px) rotate(45deg)' : 'none',
                  }}
                />
                <span
                  className="absolute left-0 top-[6px] block h-[1.5px] w-4 bg-current transition-opacity duration-200"
                  style={{ opacity: open ? 0 : 1 }}
                />
                <span
                  className="absolute left-0 top-[11px] block h-[1.5px] w-4 origin-center bg-current transition-transform duration-200"
                  style={{
                    transform: open ? 'translateY(-5px) rotate(-45deg)' : 'none',
                  }}
                />
              </span>
            </button>
          </div>
        </div>

      </header>

      {/* Mobile menu — rendered OUTSIDE header so fixed positioning works.
          The header's transition-transform creates a containing block that
          would trap a fixed child inside its own bounds. */}
      {open ? (
        <div
          id={panelId}
          className="lg:hidden"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--wt-bg0)',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--wt-line)' }}
          >
            <Wordmark size="md" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              className="flex h-11 w-11 items-center justify-center"
              style={{ border: '1px solid var(--wt-line)' }}
              aria-label="Close menu"
            >
              <span aria-hidden className="relative block h-3.5 w-4">
                <span
                  className="absolute left-0 top-[6px] block h-[1.5px] w-4 bg-current"
                  style={{ transform: 'rotate(45deg)' }}
                />
                <span
                  className="absolute left-0 top-[6px] block h-[1.5px] w-4 bg-current"
                  style={{ transform: 'rotate(-45deg)' }}
                />
              </span>
            </button>
          </div>
          <nav aria-label="Primary" className="flex flex-1 flex-col justify-center gap-1 px-6 pb-[max(4rem,env(safe-area-inset-bottom))]">
            {NAV.map((item, i) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`wt-menu-in min-h-12 py-3 font-display text-3xl font-semibold tracking-[-0.02em] no-underline ${
                    active ? 'text-[color:var(--wt-accent)]' : 'text-[color:var(--wt-text)]'
                  }`}
                  style={{ animationDelay: `${80 + i * 60}ms` }}
                >
                  {item.label}
                </Link>
              );
            })}
            <div
              className="wt-menu-in mt-6 flex flex-wrap items-center gap-3"
              style={{ animationDelay: '300ms' }}
            >
              {SOCIAL.map(({ href, label, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 px-3 py-2.5 font-mono text-xs uppercase tracking-[0.1em] text-[color:var(--wt-text-mid)] no-underline transition-colors duration-200 active:text-[color:var(--wt-text)] hover:text-[color:var(--wt-text)]"
                  style={{ border: '1px solid var(--wt-line)' }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              ))}
            </div>
            <div className="wt-menu-in mt-8" style={{ animationDelay: '360ms' }}>
              <Cta
                href={LINKS.modrinth}
                withArrow
                className="min-h-12 w-full"
                leading={<ModrinthMark className="h-3.5 w-3.5" />}
              >
                Download
              </Cta>
            </div>
          </nav>
        </div>
      ) : null}

      {/* Inner pages need a spacer — header is fixed. Home keeps a full-bleed hero. */}
      {!isHome ? <div className="h-[3.5rem] md:h-[3.75rem]" aria-hidden /> : null}
    </>
  );
}
