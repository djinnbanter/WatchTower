import type { ReactNode } from 'react';

/**
 * Outer board packing: max width + ruled plate. Children stack as compartments
 * (use BoardSection or gap-px grids). Parent bg is the rule colour for 1px gaps.
 */
export function BoardFrame({
  children,
  className = '',
  ariaLabel,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  as?: 'section' | 'div';
}) {
  return (
    <Tag
      className={`relative mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8 ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <div
        className="m-0 border border-[color:var(--wt-line)] bg-[color:var(--wt-line)] p-0"
        style={{ boxShadow: 'none' }}
      >
        {children}
      </div>
    </Tag>
  );
}
