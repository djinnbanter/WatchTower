'use client';

import { motion, useReducedMotion } from 'motion/react';

type TourBring = {
  title: string;
  detail: string;
};

/** Shared highlight list for desk-tour left columns. Staggers on enter. */
export function TourBrings({
  items,
  className = '',
}: {
  items: readonly TourBring[];
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <ul
      className={`mt-8 max-w-[52ch] space-y-0 border-t border-[color:var(--wt-line)] ${className}`}
    >
      {items.map((row, i) => (
        <motion.li
          key={row.title}
          className="grid gap-1 border-b border-[color:var(--wt-line)] py-4 sm:grid-cols-[9.5rem_1fr] sm:gap-4"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{
            duration: 0.45,
            delay: reduce ? 0 : i * 0.05,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <span className="font-mono text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--wt-text-low)]">
            {row.title}
          </span>
          <span className="text-[0.9375rem] leading-relaxed text-[color:var(--wt-text-mid)]">
            {row.detail}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}
