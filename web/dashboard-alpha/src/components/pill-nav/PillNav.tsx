/**
 * Watchtower pill section nav — replaces former React Bits Pill Nav (gsap).
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './PillNav.css';

export type PillNavItem = {
  id: string;
  label: string;
  href?: string;
};

export type PillNavProps = {
  items: readonly PillNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  trailing?: ReactNode;
  'aria-label'?: string;
};

export default function PillNav({
  items,
  activeId,
  onSelect,
  className,
  trailing,
  'aria-label': ariaLabel = 'Section navigation',
}: PillNavProps) {
  return (
    <div className={cn('wt-pill-nav-row', className)}>
      <div className="wt-pill-nav" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn('wt-pill-nav__item', active && 'is-active')}
              onClick={() => onSelect?.(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="wt-pill-nav__trailing">{trailing}</div> : null}
    </div>
  );
}
