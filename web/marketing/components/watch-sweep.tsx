'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * The signature motion: a lantern blade crosses the plate once on entry.
 * It is the product's verb made visible. Expects a positioned parent.
 */
export function WatchSweep({ delay = 0.45 }: { delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 w-[36%] will-change-transform"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(245,165,36,0.04) 44%, rgba(245,165,36,0.14) 84%, rgba(245,165,36,0.7) 98.5%, transparent 100%)',
        mixBlendMode: 'screen',
      }}
      initial={{ x: '-40%', opacity: 0 }}
      animate={{ x: '270%', opacity: [0, 1, 1, 0] }}
      transition={{
        duration: 1.6,
        delay,
        ease: [0.33, 0, 0.15, 1],
        opacity: { times: [0, 0.1, 0.8, 1], duration: 1.6, delay },
      }}
    />
  );
}
