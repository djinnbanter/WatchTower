import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

const BASE =
  'group inline-flex items-center justify-center whitespace-nowrap font-semibold no-underline transition-[background-color,border-color,color] duration-200';

export function Cta({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  withArrow = false,
  leading,
  newTab = false,
}: {
  href: string;
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
  /** Nested trailing icon for primary conversion moments. */
  withArrow?: boolean;
  /** Nested leading mark (e.g. Modrinth) to balance the arrow chip. */
  leading?: ReactNode;
  /** Open in a new tab (demo / external destinations). */
  newTab?: boolean;
}) {
  const primary = variant === 'primary';
  const compact = size === 'sm';
  const shell = compact
    ? 'min-h-9 gap-2 px-3 py-2 text-xs'
    : 'min-h-11 gap-2.5 px-5 py-3 text-sm sm:min-h-10 sm:py-2.5';
  const arrow = compact ? 12 : 14;

  const style = primary
    ? {
        background: 'var(--wt-accent)',
        color: 'var(--wt-accent-ink)',
        border: '1px solid var(--wt-accent)',
      }
    : {
        background: 'transparent',
        color: 'var(--wt-text)',
        border: '1px solid var(--wt-text)',
      };

  return (
    <a
      href={href}
      className={`${BASE} ${shell} ${className}`}
      style={style}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : null)}
    >
      {leading ? (
        <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
          {leading}
        </span>
      ) : null}
      <span>{children}</span>
      {withArrow ? (
        <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
          <ArrowUpRight size={arrow} strokeWidth={1.75} />
        </span>
      ) : null}
    </a>
  );
}
