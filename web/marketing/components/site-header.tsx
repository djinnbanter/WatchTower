'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Wordmark } from '@/components/wordmark';
import { Cta } from '@/components/cta';
import { ThemeToggle } from '@/components/theme-toggle';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { GithubMark } from '@/components/brand/github-mark';
import { DEMO_URL, LINKS } from '@/content/product';

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/install', label: 'Install' },
  { href: '/faq', label: 'FAQ' },
] as const;

const SOCIAL = [
  { href: LINKS.modrinth, label: 'Modrinth', Icon: ModrinthMark },
  { href: LINKS.github, label: 'GitHub', Icon: GithubMark },
] as const;

const ease = 'duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]';

/**
 * Hero-flush nav: transparent over the page, frosted instrument bar after scroll.
 * Bigger type, quieter CTA, lantern hover on links.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

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

  const elevated = scrolled || open;

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="pointer-events-none h-px w-full" />
      <header className="sticky top-0 z-40 px-3 pt-3 md:px-5 md:pt-4">
        <div
          className={`mx-auto flex max-w-[84rem] items-center gap-4 px-2.5 py-2 md:gap-5 md:px-3.5 transition-[background-color,border-color,box-shadow,backdrop-filter,-webkit-backdrop-filter] ${ease}`}
          style={{
            borderRadius: 'var(--wt-radius-lg)',
            border: elevated ? '1px solid var(--wt-line)' : '1px solid transparent',
            background: elevated
              ? 'color-mix(in srgb, var(--wt-nav-bg) 88%, transparent)'
              : 'transparent',
            backdropFilter: elevated ? 'blur(20px) saturate(1.2)' : 'none',
            WebkitBackdropFilter: elevated ? 'blur(20px) saturate(1.2)' : 'none',
            boxShadow: elevated ? 'var(--wt-shadow)' : 'none',
          }}
        >
          <Link
            href="/"
            className="group/brand inline-flex shrink-0 items-center no-underline transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-95 active:scale-[0.98]"
          >
            <Wordmark size="md" />
          </Link>

          <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative px-3.5 py-2 text-[0.9375rem] font-semibold tracking-[-0.015em] no-underline transition-[color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ${
                    active
                      ? 'text-[color:var(--wt-text)]'
                      : 'text-[color:var(--wt-text-mid)] hover:text-[color:var(--wt-lantern)]'
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-3.5 bottom-1 h-px origin-left bg-[color:var(--wt-lantern)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-1 lg:flex">
            {SOCIAL.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-9 w-9 items-center justify-center text-[color:var(--wt-text-mid)] transition-[color,background-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white/[0.06] hover:text-[color:var(--wt-text)] active:scale-[0.96]"
                style={{ borderRadius: 'var(--wt-radius-md)' }}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" />
              </a>
            ))}
            <ThemeToggle quiet={!elevated} />
            <Cta href={DEMO_URL} withArrow size="sm" className="ml-1.5" newTab>
              Open the demo
            </Cta>
          </div>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            {SOCIAL.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex h-9 w-9 items-center justify-center text-[color:var(--wt-text-mid)] transition-[color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--wt-text)] active:scale-[0.96]"
                style={{ borderRadius: 'var(--wt-radius-md)' }}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" />
              </a>
            ))}
            <ThemeToggle quiet={!elevated} />
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="relative flex h-9 w-9 items-center justify-center text-[color:var(--wt-text)] transition-[border-color,background-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.96]"
              style={{
                borderRadius: 'var(--wt-radius-md)',
                border: elevated ? '1px solid var(--wt-line-strong)' : '1px solid transparent',
                background: elevated ? 'var(--wt-bg0)' : 'transparent',
              }}
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              <span aria-hidden className="relative block h-3.5 w-4">
                <span
                  className="absolute left-0 top-[1px] block h-[1.5px] w-4 origin-center bg-current transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    transform: open ? 'translateY(5px) rotate(45deg)' : 'none',
                  }}
                />
                <span
                  className="absolute left-0 top-[6px] block h-[1.5px] w-4 bg-current transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ opacity: open ? 0 : 1 }}
                />
                <span
                  className="absolute left-0 top-[11px] block h-[1.5px] w-4 origin-center bg-current transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    transform: open ? 'translateY(-5px) rotate(-45deg)' : 'none',
                  }}
                />
              </span>
            </button>
          </div>
        </div>

        {open ? (
          <div
            id={panelId}
            className="fixed inset-0 z-50 flex flex-col backdrop-blur-3xl lg:hidden"
            style={{ background: 'color-mix(in srgb, var(--wt-bg0) 90%, transparent)' }}
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <Wordmark size="md" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className="flex h-9 w-9 items-center justify-center border border-[color:var(--wt-line-strong)] transition-[border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[color:var(--wt-accent)] active:scale-[0.96]"
                style={{ borderRadius: 'var(--wt-radius-md)', background: 'var(--wt-bg1)' }}
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
            <nav aria-label="Primary" className="flex flex-1 flex-col justify-center gap-1 px-6 pb-16">
              {NAV.map((item, i) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`wt-menu-in py-3 font-display text-3xl font-semibold tracking-[-0.02em] no-underline ${
                      active ? 'text-[color:var(--wt-accent)]' : 'text-[color:var(--wt-text)]'
                    }`}
                    style={{ animationDelay: `${80 + i * 60}ms` }}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div
                className="wt-menu-in mt-6 flex items-center gap-3"
                style={{ animationDelay: '300ms' }}
              >
                {SOCIAL.map(({ href, label, Icon }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-[color:var(--wt-line)] px-3 py-2 text-sm font-medium text-[color:var(--wt-text-mid)] no-underline transition-[color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[color:var(--wt-accent)] hover:text-[color:var(--wt-text)]"
                    style={{ borderRadius: 'var(--wt-radius-md)' }}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </a>
                ))}
              </div>
              <div className="wt-menu-in mt-8" style={{ animationDelay: '360ms' }}>
                <Cta href={DEMO_URL} withArrow className="w-full" newTab>
                  Open the demo
                </Cta>
              </div>
            </nav>
          </div>
        ) : null}
      </header>
    </>
  );
}
