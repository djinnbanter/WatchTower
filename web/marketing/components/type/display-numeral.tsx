'use client';

import { useEffect, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { useReducedMotion } from 'motion/react';

/**
 * Display-scale mono numeral. Optional one-shot count-up on enter.
 * Reserves final height from first paint; reduced-motion shows final immediately.
 */
export function DisplayNumeral({
  value,
  unit,
  countFrom,
  size = 'lg',
  className = '',
}: {
  value: number;
  unit?: string;
  /** When set, counts from this value to `value` once when visible. */
  countFrom?: number;
  /** `lg` = hero-scale spike; `sm` = entry proof numeral. */
  size?: 'lg' | 'sm';
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const start = countFrom ?? value;
  const [shown, setShown] = useState(reduce || countFrom == null ? value : start);
  const fired = useRef(false);

  useEffect(() => {
    if (reduce || countFrom == null) {
      setShown(value);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const bump = () => {
      if (fired.current) return;
      fired.current = true;
      setShown(value);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        bump();
        io.disconnect();
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(node);

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
      const t = window.setTimeout(bump, 80);
      return () => {
        window.clearTimeout(t);
        io.disconnect();
      };
    }

    return () => io.disconnect();
  }, [countFrom, reduce, value]);

  return (
    <div
      ref={ref}
      className={`wt-numeral text-[color:var(--wt-text)] ${size === 'sm' ? 'wt-numeral--sm' : ''} ${className}`}
    >
      <span className="inline-flex items-baseline gap-2">
        {countFrom != null && !reduce ? (
          <NumberFlow value={shown} />
        ) : (
          <span className="tabular-nums">{value}</span>
        )}
        {unit ? (
          <span
            className={`font-mono font-semibold tracking-normal text-[color:var(--wt-text-mid)] ${
              size === 'sm'
                ? 'text-[clamp(0.875rem,1.8vw,1.25rem)]'
                : 'text-[clamp(1rem,2.5vw,1.75rem)]'
            }`}
          >
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}
