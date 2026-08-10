'use client';

import { useReducedMotion } from 'motion/react';
import { motion } from 'motion/react';

type TourBring = {
  title: string;
  detail: string;
};

/** Board-pack bring list: equal 1fr rows that fill leftover column height. */
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
      className={`grid h-full min-h-0 w-full list-none gap-px bg-[color:var(--wt-line)] p-0 ${className}`}
      style={{ gridTemplateRows: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((row, i) => (
        <motion.li
          key={row.title}
          className="grid h-full content-center gap-2 bg-[color:var(--wt-bg0)] px-4 py-4 sm:grid-cols-[12rem_1fr] sm:gap-5 sm:px-5 sm:py-5"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{
            duration: 0.3,
            delay: reduce ? 0 : i * 0.03,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <span className="font-mono text-[0.8125rem] font-semibold uppercase tracking-[0.1em] text-[color:var(--wt-text)] sm:text-sm">
            {row.title}
          </span>
          <span className="text-[0.9375rem] leading-snug text-[color:var(--wt-text-mid)]">
            {row.detail}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}
