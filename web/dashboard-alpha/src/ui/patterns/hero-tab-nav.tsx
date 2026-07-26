import type { ReactNode } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import './hero-tab-nav.css';

export type HeroTabItem = {
  id: string;
  label: ReactNode;
  /** Optional count chip shown after the label (active tabs use light-on-pill). */
  count?: number | string | null;
};

/**
 * Spark-style hero subnav: sliding accent pill via shared `layoutId`.
 * Pass a unique `layoutGroupId` per page so pills don't animate across routes.
 */
export function HeroTabNav({
  items,
  value,
  onChange,
  layoutGroupId,
  'aria-label': ariaLabel,
  className,
  stretch = true,
}: {
  items: HeroTabItem[];
  value: string;
  onChange: (id: string) => void;
  layoutGroupId: string;
  'aria-label': string;
  className?: string;
  /** Full-width bar inside BorderGlow heroes (Spark default). */
  stretch?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const pillId = `${layoutGroupId}-pill`;

  return (
    <LayoutGroup id={layoutGroupId}>
      <nav
        className={cn('wt-hero-tabs', stretch && 'wt-hero-tabs--stretch', className)}
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const active = value === item.id;
          const showCount = item.count != null && item.count !== '' && Number(item.count) !== 0;
          return (
            <button
              key={item.id}
              type="button"
              className={cn('wt-hero-tab', active && 'is-active')}
              onClick={() => onChange(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              {active ? (
                reduceMotion ? (
                  <span className="wt-hero-tab__pill" aria-hidden />
                ) : (
                  <motion.span
                    layoutId={pillId}
                    className="wt-hero-tab__pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }}
                    aria-hidden
                  />
                )
              ) : null}
              <span className="wt-hero-tab__label">
                {item.label}
                {showCount ? <span className="wt-hero-tab__count">{item.count}</span> : null}
              </span>
            </button>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
