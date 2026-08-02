'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import './sweep-beacon.css';

/**
 * Quiet radar sweep behind Welcome — CSS + DOM only (no three.js).
 * Pauses when off-screen. Static rings under reduced motion.
 */
export function SweepBeacon({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const spinning = !reduce && visible;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="wt-mkt-radar__ring wt-mkt-radar__ring--lg" />
      <div className="wt-mkt-radar__ring wt-mkt-radar__ring--md" />
      <div className="wt-mkt-radar__ring wt-mkt-radar__ring--sm" />
      <div className={`wt-mkt-radar__sweep${spinning ? ' is-spinning' : ''}`} />
    </div>
  );
}
