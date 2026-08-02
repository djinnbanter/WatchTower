import type { ReactNode } from 'react';
import BorderGlow, { type BorderGlowProps } from '@/components/border-glow/BorderGlow';
import { cn } from '@/lib/utils';

export type HeroTone = 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'neutral';

const TONE_GLOW: Record<
  Exclude<HeroTone, 'neutral'>,
  Pick<BorderGlowProps, 'glowColor' | 'colors' | 'fillOpacity'>
> = {
  danger: {
    glowColor: '0 84 60',
    colors: [
      'var(--wt-danger)',
      'color-mix(in srgb, var(--wt-danger) 70%, var(--wt-warn))',
      'var(--wt-warn)',
    ],
    fillOpacity: 0.32,
  },
  warn: {
    glowColor: '38 92 55',
    colors: [
      'var(--wt-warn)',
      'color-mix(in srgb, var(--wt-warn) 70%, var(--wt-danger))',
      'color-mix(in srgb, var(--wt-warn) 60%, var(--wt-accent))',
    ],
    fillOpacity: 0.28,
  },
  ok: {
    glowColor: '160 72 42',
    colors: ['var(--wt-ok)', 'var(--wt-ch-disk)', 'var(--wt-accent)'],
    fillOpacity: 0.24,
  },
  info: {
    glowColor: '210 78 48',
    colors: ['var(--wt-info)', 'var(--wt-ch-players)', 'var(--wt-accent)'],
    fillOpacity: 0.24,
  },
  accent: {
    glowColor: '220 70 48',
    colors: ['var(--wt-accent)', 'var(--wt-ch-players)', 'var(--wt-info)'],
    fillOpacity: 0.24,
  },
};

function resolveTone(tone: HeroTone): Exclude<HeroTone, 'neutral'> {
  return tone === 'neutral' ? 'info' : tone;
}

export type HeroCardProps = {
  children: ReactNode;
  className?: string;
  tone?: HeroTone;
  /** Override default 0.55 intensity when a page needs a quieter/louder hero. */
  glowIntensity?: number;
  animated?: boolean;
  edgeSensitivity?: number;
  glowRadius?: number;
  coneSpread?: number;
  borderRadius?: number;
  backgroundColor?: string;
};

/**
 * Shared hero wrapper — toned-down BorderGlow keyed to status tokens.
 * Use on Overview / Live / Issues / Crashes / Mods / Spark / Startup heroes.
 */
export function HeroCard({
  children,
  className,
  tone = 'ok',
  glowIntensity = 0.55,
  animated = true,
  edgeSensitivity = 28,
  glowRadius = 32,
  coneSpread = 22,
  borderRadius = 4,
  backgroundColor = 'var(--wt-bg1)',
}: HeroCardProps) {
  const palette = TONE_GLOW[resolveTone(tone)];
  return (
    <BorderGlow
      className={cn(className)}
      backgroundColor={backgroundColor}
      borderRadius={borderRadius}
      edgeSensitivity={edgeSensitivity}
      glowRadius={glowRadius}
      coneSpread={coneSpread}
      glowIntensity={glowIntensity}
      animated={animated}
      glowColor={palette.glowColor}
      colors={palette.colors as string[]}
      fillOpacity={palette.fillOpacity}
    >
      {children}
    </BorderGlow>
  );
}
