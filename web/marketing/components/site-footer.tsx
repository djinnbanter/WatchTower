'use client';

import Link from 'next/link';
import { Wordmark } from '@/components/wordmark';
import { Cta } from '@/components/cta';
import { MagnetHit } from '@/components/motion';
import { MarginNote } from '@/components/type/margin-note';
import { Reveal } from '@/components/reveal';
import { DEMO_URL, FOOTER_BLURB, FOOTNOTE, LINKS } from '@/content/product';
import './site-footer.css';

const PRODUCT = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/install', label: 'Install' },
  { href: '/demo', label: 'Demo' },
  { href: '/faq', label: 'FAQ' },
] as const;

const PROJECT = [
  { href: LINKS.modrinth, label: 'Modrinth' },
  { href: LINKS.github, label: 'GitHub' },
  { href: LINKS.wiki, label: 'Wiki' },
  { href: LINKS.license, label: 'License' },
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
          <li key={item.href}>
            {item.external ? (
              <a
                href={item.href}
                className="wt-site-footer__link inline-block text-[0.9375rem] font-medium tracking-[-0.01em]"
              >
                {item.label}
              </a>
            ) : (
              <Link
                href={item.href === '/demo' ? DEMO_URL : item.href}
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
  return (
    <footer className="wt-site-footer relative">
      <div className="wt-site-footer__lantern" aria-hidden />

      <div className="relative mx-auto grid max-w-[84rem] gap-14 px-5 py-20 md:grid-cols-[minmax(0,1.55fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] md:gap-12 md:py-24 lg:gap-20 lg:px-8">
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
              <Cta href={DEMO_URL} withArrow>
                Open the demo
              </Cta>
            </MagnetHit>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <FooterNav
            label="Product"
            items={PRODUCT.map((item) => ({ ...item, external: false }))}
          />
        </Reveal>

        <Reveal delay={0.1}>
          <FooterNav
            label="Project"
            items={PROJECT.map((item) => ({ ...item, external: true }))}
          />
        </Reveal>
      </div>

      <div className="wt-site-footer__meta relative">
        <div className="mx-auto flex max-w-[84rem] flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p
            className="m-0 font-mono text-[0.75rem] leading-relaxed tracking-[0.04em]"
            style={{ color: 'var(--wt-footer-low)' }}
          >
            {FOOTNOTE}
          </p>
          <p
            className="m-0 font-mono text-[0.75rem] uppercase tracking-[0.14em]"
            style={{ color: 'var(--wt-footer-low)' }}
          >
            WatchTower
          </p>
        </div>
      </div>
    </footer>
  );
}
