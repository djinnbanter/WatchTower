'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/components/wordmark';
import { Cta } from '@/components/cta';
import { MagnetHit } from '@/components/motion';
import { MarginNote } from '@/components/type/margin-note';
import { Reveal } from '@/components/reveal';
import { DEMO_URL, FOOTER_BLURB, FOOTNOTE, LINKS } from '@/content/product';
import './site-footer.css';

const PRODUCT = [
  { href: '/', label: 'Overview' },
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/demo', label: 'Live Demo' },
] as const;

const HELP = [
  { href: '/install', label: 'Quick Start Guide' },
  { href: LINKS.wiki, label: 'GitHub Wiki', external: true },
  { href: LINKS.wikiDisasterRecovery, label: 'Disaster Recovery Tips', external: true },
  { href: `${LINKS.github}/blob/main/docs/ROADMAP.md`, label: 'In-App Roadmap (Upcoming Features)', external: true },
] as const;

const COMMUNITY = [
  { href: LINKS.modrinth, label: 'Modrinth Page', external: true },
  { href: LINKS.github, label: 'GitHub Repository', external: true },
  { href: LINKS.releasesLatest, label: 'Latest Releases', external: true },
  { href: LINKS.license, label: 'License Information (GPL-3.0)', external: true },
] as const;

function FooterNav({
  label,
  items,
}: {
  label: string;
  items: readonly { href: string; label: string; external?: boolean }[];
}) {
  return (
    <nav aria-label={label} className="min-w-0">
      <MarginNote className="mb-5 !text-[color:var(--wt-footer-low)]">{label}</MarginNote>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li key={item.href + item.label}>
            {item.external || item.href === '/demo' ? (
              <a
                href={item.href === '/demo' ? DEMO_URL : item.href}
                className="wt-site-footer__link inline-block text-[0.9375rem] font-medium tracking-[-0.01em]"
                {...(item.href === '/demo' || item.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : null)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                href={item.href}
                className="wt-site-footer__link inline-block text-[0.9375rem] font-medium tracking-[-0.01em]"
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
    <footer className="wt-site-footer relative">
      <div className="wt-site-footer__lantern" aria-hidden />

      <div className="relative mx-auto grid max-w-[1600px] gap-14 px-4 py-20 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] md:gap-10 md:px-8 md:py-24 lg:gap-14">
        <Reveal className="min-w-0">
          <Wordmark size="lg" tone="on-dark" />
          <p
            className="mt-6 max-w-[34ch] text-[1.0625rem] leading-relaxed"
            style={{ color: 'var(--wt-footer-mid)' }}
          >
            {FOOTER_BLURB}
          </p>
          <div className="mt-8">
            <MagnetHit>
              <Cta href={DEMO_URL} withArrow newTab>
                Try the live demo
              </Cta>
            </MagnetHit>
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

      <div className="wt-site-footer__meta relative">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p className="wt-meta m-0 max-w-[72ch]" style={{ color: 'var(--wt-footer-low)' }}>
            {FOOTNOTE}
          </p>
          <p className="wt-meta m-0" style={{ color: 'var(--wt-footer-low)' }}>
            WatchTower
          </p>
        </div>
      </div>
    </footer>
  );
}
