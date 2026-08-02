'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#@$%';

function scramble(len: number) {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? 'X';
  }
  return out;
}

/**
 * One-shot glyph settle when `active` becomes true.
 * Real text stays in the DOM for screen readers; scramble overlay is aria-hidden.
 */
export function ScanText({
  text,
  active,
  className = '',
}: {
  text: string;
  active: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [overlay, setOverlay] = useState<string | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!active) {
      fired.current = false;
      setOverlay(null);
      return;
    }
    if (fired.current || reduce) {
      setOverlay(null);
      return;
    }
    fired.current = true;

    let raf = 0;
    let cancelled = false;
    const start = performance.now();
    const duration = 420;

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / duration);
      if (t < 1) {
        const keep = Math.floor(text.length * t);
        setOverlay(text.slice(0, keep) + scramble(Math.max(0, text.length - keep)));
        raf = window.requestAnimationFrame(tick);
      } else {
        setOverlay(null);
      }
    };

    setOverlay(scramble(text.length));
    raf = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      // Never leave a mid-scramble overlay if the effect tears down early
      // (Strict Mode, activeId flicker, etc.).
      setOverlay(null);
    };
  }, [active, reduce, text]);

  return (
    <span className={`relative inline-block ${className}`}>
      <span
        className={overlay ? 'invisible' : undefined}
        aria-hidden={overlay ? true : undefined}
      >
        {text}
      </span>
      {overlay ? (
        <span aria-hidden className="absolute inset-0 font-mono tracking-tight">
          {overlay}
        </span>
      ) : null}
      {overlay ? <span className="sr-only">{text}</span> : null}
    </span>
  );
}
