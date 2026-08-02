'use client';

import type { ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';

/**
 * Subtle magnetic pull toward the pointer. Motion values only — no React state for x/y.
 */
export function MagnetHit({
  children,
  className = '',
  strength = 0.28,
}: {
  children: ReactNode;
  className?: string;
  /** 0–1 pull factor toward pointer from center. */
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 120, damping: 18 });
  const sy = useSpring(y, { stiffness: 120, damping: 18 });

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={`inline-flex ${className}`}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const max = 10;
        const dx = Math.max(-max, Math.min(max, (e.clientX - cx) * strength));
        const dy = Math.max(-max, Math.min(max, (e.clientY - cy) * strength));
        x.set(dx);
        y.set(dy);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
