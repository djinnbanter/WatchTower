'use client';

import Link from 'next/link';
import { Archive, ArrowUpRight, LifeBuoy, Terminal } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { ModrinthMark } from '@/components/brand/modrinth-mark';
import { SparkMark } from '@/components/brand/spark-mark';
import { LINKS } from '@/content/product';

type ShippingItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  external?: boolean;
  mark: ReactNode;
  accent?: string;
  tag?: string;
  tagTone?: 'lantern' | 'low';
};

const ITEMS: ShippingItem[] = [
  {
    id: 'mods',
    label: 'Mods',
    detail: 'Modrinth lookup. Never downloads jars.',
    href: LINKS.modrinth,
    external: true,
    accent: '#1BD96A',
    tag: 'via Modrinth',
    tagTone: 'low',
    mark: <ModrinthMark className="h-4 w-4" />,
  },
  {
    id: 'backups',
    label: 'Backups',
    detail: 'Advisory status, not a host panel.',
    href: '/features',
    mark: <Archive size={15} strokeWidth={1.6} aria-hidden />,
  },
  {
    id: 'support',
    label: 'Support packs',
    detail: 'Redacted evidence when you need help.',
    href: '/features',
    mark: <LifeBuoy size={15} strokeWidth={1.6} aria-hidden />,
  },
  {
    id: 'spark',
    label: 'Spark',
    detail: 'Lag proof. Deep workspace is alpha.',
    href: '/features',
    tag: 'alpha',
    tagTone: 'lantern',
    mark: <SparkMark size={16} />,
  },
  {
    id: 'cli',
    label: 'CLI',
    detail: "When the game won't boot.",
    href: '/features',
    mark: <Terminal size={15} strokeWidth={1.6} aria-hidden />,
  },
];

function ChipBody({ item }: { item: ShippingItem }) {
  return (
    <>
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] text-[color:var(--wt-text-mid)]"
        style={{
          borderRadius: 'var(--wt-radius-sm)',
          color: item.accent,
        }}
      >
        {item.mark}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[0.8125rem] font-semibold text-[color:var(--wt-text)]">
            {item.label}
          </span>
          {item.tag ? (
            <span
              className={`font-mono text-[0.625rem] font-medium uppercase tracking-[0.08em] ${
                item.tagTone === 'lantern'
                  ? 'text-[color:var(--wt-lantern)]'
                  : 'text-[color:var(--wt-text-low)]'
              }`}
            >
              {item.tag}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[0.75rem] leading-snug text-[color:var(--wt-text-mid)]">
          {item.detail}
        </span>
      </span>
    </>
  );
}

/**
 * Instrument ledger under the showcase bento.
 * Surface chips with the Modrinth mark instead of a plain paragraph dump.
 */
export function ShippingStrip() {
  const reduce = useReducedMotion();
  const chipClass =
    'flex h-full items-start gap-3 bg-[color:var(--wt-bg0)] p-3.5 no-underline transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[color:var(--wt-bg1)] active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--wt-accent)]';

  return (
    <div className="border-t border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)]/50">
      <div className="mx-auto max-w-[84rem] px-5 py-6 lg:px-8">
        <div
          className="border border-[color:var(--wt-line)] bg-[color:var(--wt-plate-outer)] p-[5px]"
          style={{ borderRadius: 'var(--wt-radius-lg)' }}
        >
          <div
            className="relative overflow-hidden bg-[color:var(--wt-bg0)]"
            style={{
              borderRadius: 'var(--wt-radius-sm)',
              boxShadow: 'var(--wt-shadow)',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  'radial-gradient(36rem 14rem at 8% 0%, var(--wt-glow-accent), transparent 60%)',
              }}
              aria-hidden
            />

            <div className="relative flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between md:gap-6 md:p-5">
              <div className="min-w-0 md:max-w-[18rem]">
                <h3 className="text-base font-semibold tracking-tight text-[color:var(--wt-text)]">
                  Also on the dashboard
                </h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[color:var(--wt-text-mid)]">
                  More surfaces in the jar. Modrinth is lookup only.
                </p>
              </div>

              <Link
                href="/features"
                className="group inline-flex shrink-0 items-center gap-2 self-start text-sm font-semibold text-[color:var(--wt-accent)] no-underline transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-85 active:scale-[0.98] md:self-auto"
              >
                All surfaces
                <span
                  className="inline-flex h-7 w-7 items-center justify-center border border-[color:var(--wt-line)] bg-[color:var(--wt-bg1)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px"
                  style={{ borderRadius: 'var(--wt-radius-sm)' }}
                  aria-hidden
                >
                  <ArrowUpRight size={14} strokeWidth={1.75} />
                </span>
              </Link>
            </div>

            <div className="relative grid gap-px border-t border-[color:var(--wt-line)] bg-[color:var(--wt-line)] sm:grid-cols-2 lg:grid-cols-5">
              {ITEMS.map((item, i) => {
                const body = <ChipBody item={item} />;
                const delay = i * 0.05;

                if (item.external) {
                  return (
                    <motion.a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={chipClass}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.35 }}
                      transition={{
                        duration: 0.45,
                        delay,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {body}
                    </motion.a>
                  );
                }

                return (
                  <motion.div
                    key={item.id}
                    className="h-full"
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{
                      duration: 0.45,
                      delay,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <Link href={item.href} className={chipClass}>
                      {body}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
