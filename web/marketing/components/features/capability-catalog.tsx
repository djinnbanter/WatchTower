'use client';

import MagicBento, {
  WT_GLOW_RGB,
  type MagicBentoCard,
} from '@/components/react-bits/MagicBento';
import { featurePeek } from '@/components/features/bento-peeks';
import { TONE_CSS } from '@/components/features/capability-marks';
import {
  FEATURE_BENTO_MORE,
  FEATURE_BENTO_SHOWCASE,
} from '@/content/features-bento';
import { FEATURE_CAPABILITIES } from '@/content/features';

function byId(id: string) {
  const f = FEATURE_CAPABILITIES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown feature id: ${id}`);
  return f;
}

function allCards(): MagicBentoCard[] {
  const showcase = FEATURE_BENTO_SHOWCASE.map((cell) => {
    const f = byId(cell.id);
    return {
      id: f.id,
      title: f.title,
      description: f.blurb,
      label: f.tag,
      weight: f.weight,
      alpha: f.alpha,
      tone: TONE_CSS[f.tone],
      layoutClass: `bento-span--${cell.span}`,
      media: cell.media,
      visual: featurePeek(f.id),
    };
  });

  const more = FEATURE_BENTO_MORE.map((cell) => {
    const f = byId(cell.id);
    return {
      id: f.id,
      title: f.title,
      description: f.blurb,
      label: f.tag,
      weight: f.weight,
      alpha: f.alpha,
      tone: TONE_CSS[f.tone],
      layoutClass:
        cell.span === 'two'
          ? 'bento-span--more-two'
          : cell.span === 'half'
            ? 'bento-span--more-half'
            : 'bento-span--more-one',
      media: cell.media,
      visual: featurePeek(f.id),
    };
  });

  return [...showcase, ...more];
}

export function CapabilityCatalog() {
  return (
    <MagicBento
      className="card-grid--showcase"
      cards={allCards()}
      textAutoHide={false}
      enableStars
      enableSpotlight
      enableBorderGlow
      enableTilt={false}
      enableMagnetism
      clickEffect
      spotlightRadius={320}
      particleCount={8}
      glowColor={WT_GLOW_RGB}
    />
  );
}
