'use client';

import { useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';

/**
 * Pointer-reactive hero tagline.
 * "OPS DASHBOARD" carries the product noun in full signal; the rest stays quieter.
 */
export function HeroTagline() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 140, damping: 24, mass: 0.35 });
  const sy = useSpring(my, { stiffness: 140, damping: 24, mass: 0.35 });
  const mask = useMotionTemplate`radial-gradient(22rem 12rem at ${sx}px ${sy}px, #000 12%, transparent 70%)`;

  const centerSpotlight = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(r.width * 0.5);
    my.set(r.height * 0.45);
  };

  useLayoutEffect(() => {
    if (reduce) return;
    centerSpotlight();
  }, [reduce]);

  const onMove = (e: MouseEvent<HTMLHeadingElement>) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  const lineClass =
    'mx-auto w-full max-w-full pb-1 text-[clamp(1.7rem,2.35vw+0.95rem,2.85rem)] font-extrabold uppercase leading-[1.12] tracking-[0.015em] text-balance';

  if (reduce) {
    return (
      <h1 className={lineClass} style={{ fontWeight: 800 }}>
        <TaglineParts
          restClass="text-[color:var(--wt-text-mid)]"
          markClass="text-[color:var(--wt-lantern)]"
        />
      </h1>
    );
  }

  return (
    <h1
      ref={ref}
      className={`${lineClass} relative isolate cursor-default select-none`}
      style={{ fontWeight: 800 }}
      onMouseMove={onMove}
      onMouseLeave={centerSpotlight}
    >
      <span className="relative z-0">
        <TaglineParts
          restClass="text-[color:var(--wt-text-mid)]"
          markClass="text-[color:var(--wt-lantern)]"
        />
      </span>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-10 w-full bg-[linear-gradient(105deg,var(--wt-lantern)_8%,var(--wt-text)_48%,var(--wt-accent)_92%)] bg-clip-text text-transparent"
        style={{
          WebkitBackgroundClip: 'text',
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        <TaglineParts restClass="" markClass="" />
      </motion.span>
    </h1>
  );
}

function TaglineParts({
  restClass,
  markClass,
}: {
  restClass: string;
  markClass: string;
}): ReactNode {
  return (
    <>
      <span className={restClass}>The </span>
      <span className={markClass}>ops dashboard</span>
      <span className={restClass}> for your Minecraft server</span>
    </>
  );
}
