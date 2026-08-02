'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ShapeGrid } from '@/components/motion/shape-grid';
import { useTheme } from '@/components/theme-provider';
import './desk-shape-grid.css';

/**
 * Close-band ambient: ShapeGrid tuned to Night Watch Desk tokens.
 * Theme-aware stroke/fill; pauses off-screen and under reduced motion.
 */
export function DeskShapeGrid({ className = '' }: { className?: string }) {
  const { theme } = useTheme();
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

  const dark = theme === 'dark';

  return (
    <div
      ref={rootRef}
      className={`wt-mkt-shape-ambient ${className}`.trim()}
      data-theme-mode={dark ? 'dark' : 'light'}
      aria-hidden
    >
      <ShapeGrid
        direction="diagonal"
        speed={reduce ? 0 : 0.4}
        squareSize={36}
        shape="square"
        hoverTrailAmount={3}
        pause={Boolean(reduce) || !visible}
        borderColor={
          dark ? 'rgba(157, 178, 206, 0.28)' : 'rgba(22, 24, 29, 0.16)'
        }
        hoverFillColor={
          dark ? 'rgba(76, 141, 255, 0.22)' : 'rgba(27, 79, 224, 0.14)'
        }
      />
    </div>
  );
}
