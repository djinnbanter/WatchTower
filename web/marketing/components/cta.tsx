import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

const BASE =
  'group inline-flex items-center justify-center whitespace-nowrap font-semibold no-underline transition-[transform,background-color,border-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98]';

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
  const skin = primary
    ? 'bg-[color:var(--wt-accent)] text-white hover:brightness-110'
    : 'border border-[color:var(--wt-line-strong)] bg-[color:var(--wt-bg1)] text-[color:var(--wt-text)] hover:border-[color:var(--wt-accent)]';
  const shell = compact ? 'gap-2 px-3 py-1.5 text-xs' : 'gap-2.5 px-5 py-2.5 text-sm';
  const chip = compact ? 'h-6 w-6' : 'h-7 w-7';
  const arrow = compact ? 12 : 14;

  return (
    <a
      href={href}
      className={`${BASE} ${shell} ${skin} ${className}`}
      style={{
        borderRadius: 'var(--wt-radius-md)',
        ...(primary ? { color: 'var(--wt-accent-ink)' } : null),
      }}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : null)}
    >
      {leading ? (
        <span
          className={`inline-flex ${chip} shrink-0 items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            primary
              ? 'bg-white/15 group-hover:scale-105'
              : 'bg-[color:var(--wt-bg2)] text-[color:var(--wt-text-mid)] group-hover:text-[color:var(--wt-text)] group-hover:scale-105'
          }`}
          style={{ borderRadius: 'var(--wt-radius-sm)' }}
          aria-hidden
        >
          {leading}
        </span>
      ) : null}
      <span>{children}</span>
      {withArrow ? (
        <span
          className={`inline-flex ${chip} shrink-0 items-center justify-center bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105`}
          style={{ borderRadius: 'var(--wt-radius-sm)', color: 'var(--wt-accent-ink)' }}
          aria-hidden
        >
          <ArrowUpRight size={arrow} strokeWidth={1.75} />
        </span>
      ) : null}
    </a>
  );
}
