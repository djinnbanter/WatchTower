'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/wordmark';
import { Cta } from '@/components/cta';
import { MagnetHit } from '@/components/motion';
import { MarginNote } from '@/components/type/margin-note';
import { Reveal } from '@/components/reveal';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { GithubMark } from '@/components/brand/github-mark';
import { DEMO_URL, FOOTER_BLURB, FOOTNOTE, LINKS } from '@/content/product';
import './site-footer.css';

const PRODUCT = [
  { href: '/', label: 'Overview' },
  { href: '/features', label: 'Features Catalog' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/demo', label: 'Live Sandbox Demo' },
] as const;

const HELP = [
  { href: '/install', label: 'Quick Start Guide' },
  { href: LINKS.wiki, label: 'GitHub Wiki', external: true },
  { href: LINKS.wikiDisasterRecovery, label: 'Disaster Recovery Tips', external: true },
  { href: `${LINKS.github}/blob/main/docs/ROADMAP.md`, label: 'In-App Roadmap', external: true },
] as const;

const COMMUNITY = [
  { href: LINKS.modrinth, label: 'Modrinth Page', external: true, icon: 'modrinth' },
  { href: LINKS.github, label: 'GitHub Repository', external: true, icon: 'github' },
  { href: LINKS.releasesLatest, label: 'Latest Releases', external: true },
  { href: LINKS.license, label: 'GPL-3.0 License', external: true },
] as const;

function FooterNav({
  label,
  items,
}: {
  label: string;
  items: readonly { href: string; label: string; external?: boolean; icon?: string }[];
}) {
  return (
    <nav aria-label={label} className="min-w-0">
      <MarginNote className="mb-4 !text-[color:var(--wt-footer-low)] uppercase tracking-wider">{label}</MarginNote>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((item) => (
          <li key={item.href + item.label}>
            {item.external || item.href === '/demo' ? (
              <a
                href={item.href === '/demo' ? DEMO_URL : item.href}
                className="wt-site-footer__link group inline-flex items-center gap-1.5 text-sm font-medium tracking-[-0.01em]"
                {...(item.href === '/demo' || item.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : null)}
              >
                {item.icon === 'modrinth' ? (
                  <ModrinthMark className="h-3.5 w-3.5 text-[color:var(--wt-footer-mid)] transition-colors group-hover:text-[#00AF5C]" />
                ) : null}
                {item.icon === 'github' ? (
                  <GithubMark className="h-3.5 w-3.5 text-[color:var(--wt-footer-mid)] transition-colors group-hover:text-[color:var(--wt-footer-ink)]" />
                ) : null}
                <span>{item.label}</span>
                {item.external ? (
                  <span className="text-[0.7rem] opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    ↗
                  </span>
                ) : null}
              </a>
            ) : (
              <Link
                href={item.href}
                className="wt-site-footer__link inline-block text-sm font-medium tracking-[-0.01em]"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  /** Home uses hard full-screen snaps; Close is the end plate — skip site footer there. */
  if (pathname === '/') return null;

  return (
    <footer className="wt-site-footer relative border-t border-[color:var(--wt-footer-line)]">
      <div className="wt-site-footer__lantern" aria-hidden />

      {/* Top Status Rail */}
      <div className="border-b border-[color:var(--wt-footer-line)] bg-[color:var(--wt-footer-bg)]/80 py-3 px-4 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 font-mono text-xs text-[color:var(--wt-footer-low)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[color:var(--wt-accent)] animate-pulse" />
            <span className="font-semibold text-[color:var(--wt-footer-ink)]">
              WATCHTOWER OPERATIONAL
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span>NEOFORGE 1.21.X</span>
            <span>///</span>
            <span>JAVA 21</span>
            <span>///</span>
            <span className="text-[color:var(--wt-ok)]">100% LOCAL-FIRST</span>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="relative mx-auto grid max-w-[1600px] gap-10 px-4 py-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] md:px-8 md:py-16 lg:gap-14">
        <Reveal className="min-w-0 space-y-4">
          <Wordmark size="lg" tone="on-dark" />
          <p
            className="max-w-[34ch] text-sm leading-relaxed"
            style={{ color: 'var(--wt-footer-mid)' }}
          >
            {FOOTER_BLURB}
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <MagnetHit>
              <Cta href={DEMO_URL} withArrow newTab size="sm">
                Try live demo
              </Cta>
            </MagnetHit>
            <Cta
              href={LINKS.modrinth}
              variant="ghost"
              leading={<ModrinthMark className="h-3.5 w-3.5" />}
              newTab
              size="sm"
            >
              Modrinth
            </Cta>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <FooterNav label="Product" items={PRODUCT.map((item) => ({ ...item }))} />
        </Reveal>

        <Reveal delay={0.08}>
          <FooterNav label="Help & Guides" items={[...HELP]} />
        </Reveal>

        <Reveal delay={0.1}>
          <FooterNav label="Community & Source Code" items={[...COMMUNITY]} />
        </Reveal>
      </div>

      {/* Bottom Legal & Meta Bar */}
      <div className="wt-site-footer__meta relative border-t border-[color:var(--wt-footer-line)]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p className="wt-meta m-0 max-w-[72ch] text-xs" style={{ color: 'var(--wt-footer-low)' }}>
            {FOOTNOTE}
          </p>
          <div className="flex items-center gap-3 font-mono text-xs text-[color:var(--wt-footer-low)]">
            <span className="border border-[color:var(--wt-footer-line)] px-2 py-0.5">GPL-3.0</span>
            <span className="font-semibold text-[color:var(--wt-footer-ink)]">WatchTower</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
