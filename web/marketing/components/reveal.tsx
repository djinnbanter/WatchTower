'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** 'rise' for blocks, 'lift' for grid cells that should feel lighter. */
  kind?: 'rise' | 'lift';
};

const VARIANTS = {
  rise: { opacity: 0, y: 18 },
  lift: { opacity: 0, y: 10 },
} as const;

/**
 * Scroll reveal. Transform + opacity only (no blur) so IntersectionObserver
 * cannot leave a tile stuck invisible on tall bento cells.
 */
export function Reveal({ children, className, delay = 0, kind = 'rise' }: Props) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={VARIANTS[kind]}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: '0px 0px -8% 0px' }}
      transition={{
        duration: kind === 'rise' ? 0.55 : 0.45,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
