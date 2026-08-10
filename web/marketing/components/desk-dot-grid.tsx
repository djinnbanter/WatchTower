'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Desk Dot Grid — square instrument-field marks.
 * Canvas is hard-capped to the viewport so tall parents cannot allocate multi‑GB bitmaps.
 */
export function DeskDotGrid({
  className = '',
  gap = 34,
  baseSize = 3.25,
}: {
  className?: string;
  gap?: number;
  baseSize?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const pointer = { x: -9999, y: -9999, active: false };
    let dots: Array<{ x: number; y: number }> = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let visible = true;
    let breathTimer = 0;
    let moveRaf = 0;

    const readCss = (name: string, fallback: string) =>
      getComputedStyle(parent).getPropertyValue(name).trim() || fallback;

    const layout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = parent.getBoundingClientRect();
      // Never allocate a canvas taller/wider than the viewport (+1 DPR safety).
      const maxW = Math.max(1, window.innerWidth || 1920);
      const maxH = Math.max(1, window.innerHeight || 1080);
      w = Math.max(1, Math.min(Math.floor(rect.width) || maxW, maxW));
      h = Math.max(1, Math.min(Math.floor(rect.height) || maxH, maxH));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pad = gap;
      dots = [];
      for (let y = pad; y <= h - pad; y += gap) {
        for (let x = pad; x <= w - pad; x += gap) {
          dots.push({ x, y });
        }
      }
      paint(performance.now());
    };

    const paint = (t: number) => {
      if (!visible || w < 1 || h < 1) return;
      const low = readCss('--wt-text-low', '#737373');
      const accent = readCss('--wt-accent', '#e8910c');
      const lantern = readCss('--wt-lantern', '#e8910c');

      ctx.clearRect(0, 0, w, h);
      const breath = reduce ? 0 : Math.sin(t * 0.0007) * 0.5 + 0.5;

      for (const dot of dots) {
        const dx = pointer.x - dot.x;
        const dy = pointer.y - dot.y;
        const dist = Math.hypot(dx, dy);
        const near = pointer.active ? Math.max(0, 1 - dist / 180) : 0;
        const size = baseSize + near * 2.4 + breath * 0.35;
        const a = 0.28 + near * 0.5 + breath * 0.06;

        ctx.fillStyle = near > 0.35 ? accent : near > 0.12 ? lantern : low;
        ctx.globalAlpha = a;
        ctx.fillRect(dot.x - size / 2, dot.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    const onMove = (e: PointerEvent) => {
      if (!visible) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
      if (moveRaf) return;
      moveRaf = window.requestAnimationFrame((t) => {
        moveRaf = 0;
        paint(t);
      });
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
      paint(performance.now());
    };

    layout();

    if (!reduce) {
      breathTimer = window.setInterval(() => {
        if (visible) paint(performance.now());
      }, 240);
    }

    const ro = new ResizeObserver(layout);
    ro.observe(parent);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) paint(performance.now());
      },
      { threshold: 0.05 },
    );
    io.observe(parent);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    return () => {
      if (moveRaf) window.cancelAnimationFrame(moveRaf);
      window.clearInterval(breathTimer);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [baseSize, gap, reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}

export const LanternField = DeskDotGrid;
