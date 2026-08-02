'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Desk Dot Grid / LanternField — WatchTower-owned, React Bits Dot Grid–inspired.
 * Instrument-field dots with a quiet cursor proximity glow. Pauses when off-screen.
 */
export function DeskDotGrid({
  className = '',
  gap = 28,
  baseRadius = 1.15,
}: {
  className?: string;
  gap?: number;
  baseRadius?: number;
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
    let raf = 0;
    let dots: Array<{ x: number; y: number }> = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let visible = true;

    const readCss = (name: string, fallback: string) =>
      getComputedStyle(parent).getPropertyValue(name).trim() || fallback;

    const layout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = parent.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
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
    };

    const draw = (t: number) => {
      if (!visible) {
        raf = 0;
        return;
      }
      const low = readCss('--wt-text-low', '#8a92a1');
      const accent = readCss('--wt-accent', '#4c8dff');
      const lantern = readCss('--wt-lantern', '#f5a524');

      ctx.clearRect(0, 0, w, h);

      const breath = reduce ? 0 : Math.sin(t * 0.0007) * 0.5 + 0.5;

      for (const dot of dots) {
        const dx = pointer.x - dot.x;
        const dy = pointer.y - dot.y;
        const dist = Math.hypot(dx, dy);
        const near = pointer.active ? Math.max(0, 1 - dist / 160) : 0;
        const r = baseRadius + near * 1.6 + breath * 0.15;
        const a = 0.22 + near * 0.55 + breath * 0.06;

        ctx.beginPath();
        ctx.fillStyle = near > 0.35 ? accent : near > 0.12 ? lantern : low;
        ctx.globalAlpha = a;
        ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!reduce && visible) raf = window.requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    layout();
    draw(performance.now());
    if (!reduce) raf = window.requestAnimationFrame(draw);

    const ro = new ResizeObserver(layout);
    ro.observe(parent);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible && !reduce && !raf) {
          raf = window.requestAnimationFrame(draw);
        }
      },
      { threshold: 0.05 },
    );
    io.observe(parent);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [baseRadius, gap, reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}

/** Spec alias for Welcome ambient. */
export const LanternField = DeskDotGrid;
