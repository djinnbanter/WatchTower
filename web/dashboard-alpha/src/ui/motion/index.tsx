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

/**
 * Soft motion budget (alpha UX pass 1A/2A):
 * - Allowed on heroes / primary CTAs: BorderGlow, ShimmerText (ok tone), count-up,
 *   PageEnter / FadeIn / Stagger, one ClickSpark on primary buttons.
 * - Avoid on secondary UI: Magnet on meta/trust chips, ClickSpark on secondary
 *   buttons, SpotlightCard chase on instrument teasers (prefer plain plates).
 * Lab/gallery pages may ignore this and show the full kit.
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

export function SpotlightCard({
  className,
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  return (
    <div
      ref={ref}
      className={cn(
        'relative rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1/90 shadow-[var(--wt-shadow)]',
        className?.includes('overflow-visible') ? 'overflow-visible' : 'overflow-hidden',
        className,
      )}
      style={style}
      onPointerMove={(e) => {
        if (reduced || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * 100;
        const my = ((e.clientY - rect.top) / rect.height) * 100;
        ref.current.style.setProperty('--mx', `${mx}%`);
        ref.current.style.setProperty('--my', `${my}%`);
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{
          background:
            'radial-gradient(500px circle at var(--mx, 50%) var(--my, 50%), var(--wt-spotlight), transparent 45%)',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
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
          className={reduced ? undefined : 'animate-[wt-enter_0.45s_ease-out_both]'}
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

/** React Bits–style icon badge with soft glare on hover (Watchtower-owned). */
export function GlareIcon({
  icon: Icon,
  className,
  tone = 'accent',
  size = 16,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  className?: string;
  tone?: 'accent' | 'ok' | 'warn' | 'danger' | 'info';
  size?: number;
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
        'relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl transition-transform duration-200 hover:scale-105',
        toneClass,
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, color-mix(in srgb, white 35%, transparent), transparent 55%)',
        }}
      />
      <Icon size={size} className="relative z-[1]" />
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
  intensity = 0.85,
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

/** Animated gradient/sheen text (React Bits Shiny/Gradient Text–inspired). */
export function ShimmerText({
  children,
  className,
  as: Tag = 'span',
}: {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'strong';
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <Tag className={cn(reduced ? undefined : 'wt-shimmer-text', className)}>{children}</Tag>
  );
}

/** Subtle magnetic pull toward pointer (React Bits Magnet–inspired). */
export function Magnet({
  children,
  className,
  maxOffset = 8,
}: {
  children: ReactNode;
  className?: string;
  maxOffset?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  return (
    <div
      ref={ref}
      className={cn('will-change-transform', className)}
      onPointerMove={(e) => {
        if (reduced || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = ((e.clientX - cx) / Math.max(1, rect.width / 2)) * maxOffset;
        const dy = ((e.clientY - cy) / Math.max(1, rect.height / 2)) * maxOffset;
        ref.current.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
      }}
      onPointerLeave={() => {
        if (!ref.current) return;
        ref.current.style.transform = 'translate(0, 0)';
      }}
      style={{ transition: reduced ? undefined : 'transform 160ms ease-out' }}
    >
      {children}
    </div>
  );
}

type Spark = { id: number; x: number; y: number; dx: number; dy: number; color: string };

/** Tiny click particle burst (React Bits Click Spark–inspired). */
export function ClickSpark({
  children,
  className,
  color,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [sparks, setSparks] = useState<Spark[]>([]);
  const idRef = useRef(0);

  return (
    <span
      className={cn('relative inline-flex', className)}
      onClick={(e) => {
        if (reduced) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const ox = e.clientX - rect.left;
        const oy = e.clientY - rect.top;
        const hue = color ?? 'var(--wt-accent, #0ea5e9)';
        const next: Spark[] = Array.from({ length: 8 }, (_, i) => {
          const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.35;
          const dist = 10 + Math.random() * 14;
          return {
            id: ++idRef.current,
            x: ox,
            y: oy,
            dx: Math.cos(angle) * dist,
            dy: Math.sin(angle) * dist,
            color: hue,
          };
        });
        setSparks((prev) => [...prev, ...next]);
        window.setTimeout(() => {
          setSparks((prev) => prev.filter((s) => !next.some((n) => n.id === s.id)));
        }, 450);
      }}
    >
      {children}
      {sparks.map((s) => (
        <span
          key={s.id}
          aria-hidden
          className="wt-click-spark pointer-events-none absolute z-20 h-1.5 w-1.5 rounded-full"
          style={
            {
              left: s.x,
              top: s.y,
              background: s.color,
              '--sx': `${s.dx}px`,
              '--sy': `${s.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
