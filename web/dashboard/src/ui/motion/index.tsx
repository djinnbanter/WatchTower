import {
  Children,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import './hero-mark.css';

/**
 * Soft motion budget (Phase E):
 * - Allowed: BorderGlow on heroes / primary CTAs, count-up, PageEnter / FadeIn / Stagger,
 *   GlareIcon, HeroWatermark.
 * - Prefer plain plates over chase/spark/magnet/shimmer effects.
 */

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/**
 * Hold intro animations until after paint + a short idle window.
 * Prevents cold-load jank when dials animate while fetch/parse still owns the main thread.
 */
export function useDeferredIntro(armed: boolean, timeoutMs = 280) {
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!armed) {
      setReady(false);
      return;
    }
    if (reduced) {
      setReady(true);
      return;
    }

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let raf1 = 0;
    let raf2 = 0;

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const ric = window.requestIdleCallback?.bind(window);
        if (ric) {
          idleId = ric(finish, { timeout: timeoutMs });
        } else {
          timeoutId = setTimeout(finish, Math.min(80, timeoutMs));
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [armed, reduced, timeoutMs]);

  return ready;
}

export function useCountUp(value: number, duration = 700) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return display;
}

export function Stagger({
  children,
  className,
  delayMs = 45,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
} & HTMLAttributes<HTMLDivElement>) {
  const reduced = usePrefersReducedMotion();
  const items = Children.toArray(children);
  return (
    <div className={className} {...rest}>
      {items.map((child, i) => (
        <div
          key={i}
          className={cn('min-w-0', !reduced && 'animate-[wt-enter_0.45s_ease-out_both]')}
          style={reduced ? undefined : { animationDelay: `${i * delayMs}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export function PageEnter({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className={cn(!reduced && 'animate-[wt-enter_0.5s_ease-out_both]', className)}>
      {children}
    </div>
  );
}

/** Compact tone-tinted icon tile for section/plate headers. */
export function GlareIcon({
  icon: Icon,
  className,
  tone = 'accent',
  size = 16,
  hoverScale = false,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  className?: string;
  tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'info';
  size?: number;
  /** Opt-in hover lift — off by default so section headers stay static. */
  hoverScale?: boolean;
}) {
  const toneClass =
    tone === 'ok'
      ? 'bg-wt-ok/15 text-wt-ok'
      : tone === 'warn'
        ? 'bg-wt-warn/15 text-wt-warn'
        : tone === 'danger'
          ? 'bg-wt-danger/15 text-wt-danger'
          : tone === 'info'
            ? 'bg-wt-accent-soft text-wt-accent'
            : 'bg-wt-accent-soft text-wt-accent';

  return (
    <span
      className={cn(
        'relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-wt-sm)] transition-transform duration-200',
        hoverScale && 'hover:scale-105',
        toneClass,
        className,
      )}
    >
      <Icon size={size} className="relative z-[1]" />
    </span>
  );
}

/**
 * Oversized corner watermark — faded, clipped by a `wt-hero-shell` ancestor.
 * Use `size="card"` on KPI / metric plates; default is for page heroes.
 */
export function HeroWatermark({
  icon: Icon,
  tone = 'accent',
  size = 'hero',
  className,
}: {
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number | string }>;
  tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'info';
  size?: 'hero' | 'card';
  className?: string;
}) {
  const glyph = size === 'card' ? 96 : 168;
  return (
    <span
      className={cn(
        'wt-hero-mark',
        `wt-hero-mark--${tone}`,
        size === 'card' && 'wt-hero-mark--card',
        className,
      )}
      aria-hidden
    >
      <Icon size={glyph} strokeWidth={1.15} />
    </span>
  );
}

type GlowTone = 'accent' | 'ok' | 'warn' | 'danger';

const GLOW_COLORS: Record<GlowTone, string> = {
  accent: 'var(--wt-accent, #0ea5e9)',
  ok: 'var(--wt-ok, #10b981)',
  warn: 'var(--wt-warn, #f59e0b)',
  danger: 'var(--wt-danger, #ef4444)',
};

/**
 * Cursor-following glowing border (React Bits Border Glow–inspired, Watchtower-owned).
 * Uses a 2px frame gap (conic cone + radial bleed + outer aura). Honors prefers-reduced-motion.
 */
export function BorderGlow({
  children,
  className,
  tone = 'accent',
  intensity = 0.55,
  glowRadius = 220,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: GlowTone;
  intensity?: number;
  /** Soft radial size in px along the border */
  glowRadius?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const live = !reduced && !disabled;
  const color = GLOW_COLORS[tone];

  return (
    <div
      ref={ref}
      className={cn('wt-border-glow', live && 'wt-border-glow--live', className)}
      style={
        {
          '--wt-glow-color': color,
          '--wt-glow-intensity': String(intensity),
          '--wt-glow-radius': `${glowRadius}px`,
          '--glow-x': '50%',
          '--glow-y': '50%',
          '--glow-angle': '135deg',
          '--glow-edge': '0.4',
        } as CSSProperties
      }
      onPointerMove={(e) => {
        if (!live || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
        const x = (px / w) * 100;
        const y = (py / h) * 100;
        const angle = (Math.atan2(py - h / 2, px - w / 2) * 180) / Math.PI + 90;
        const edgeX = Math.min(px, w - px) / (w * 0.5);
        const edgeY = Math.min(py, h - py) / (h * 0.5);
        const edge = 1 - Math.min(1, Math.min(edgeX, edgeY));
        ref.current.style.setProperty('--glow-x', `${x}%`);
        ref.current.style.setProperty('--glow-y', `${y}%`);
        ref.current.style.setProperty('--glow-angle', `${angle}deg`);
        ref.current.style.setProperty('--glow-edge', String(0.35 + edge * 0.65));
        ref.current.dataset.active = '1';
      }}
      onPointerLeave={() => {
        if (!ref.current) return;
        delete ref.current.dataset.active;
        ref.current.style.setProperty('--glow-edge', '0.4');
      }}
    >
      <div aria-hidden className="wt-border-glow__aura" />
      <div aria-hidden className="wt-border-glow__frame" />
      <div className="wt-border-glow__body">{children}</div>
    </div>
  );
}

/** Lightweight mount fade + slide (React Bits Fade Content–inspired). */
export function FadeIn({
  children,
  className,
  delayMs = 0,
  direction = 'up',
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}) {
  const reduced = usePrefersReducedMotion();
  const anim =
    direction === 'none'
      ? 'animate-[wt-fade_0.45s_ease-out_both]'
      : direction === 'down'
        ? 'animate-[wt-enter-down_0.45s_ease-out_both]'
        : direction === 'left'
          ? 'animate-[wt-enter-left_0.45s_ease-out_both]'
          : direction === 'right'
            ? 'animate-[wt-enter-right_0.45s_ease-out_both]'
            : 'animate-[wt-enter_0.45s_ease-out_both]';

  return (
    <div
      className={cn(!reduced && anim, className)}
      style={reduced || !delayMs ? undefined : { animationDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

