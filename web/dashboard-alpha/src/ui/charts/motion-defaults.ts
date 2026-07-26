import type { Transition } from 'motion/react';
import { usePrefersReducedMotion } from '@/ui/motion';

/** Default clip-reveal duration (ms) matching Bklit chart defaults. */
export const WT_CHART_ANIM_MS = 1100;

/** Spring used for gauge notches / ring enter when motion is allowed. */
export const WT_ENTER_SPRING: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 22,
};

export const WT_ENTER_TWEEN: Transition = {
  type: 'tween',
  duration: WT_CHART_ANIM_MS / 1000,
  ease: [0.85, 0, 0.15, 1],
};

export function useChartMotion() {
  const reduced = usePrefersReducedMotion();
  return {
    reduced,
    animationDuration: reduced ? 0 : WT_CHART_ANIM_MS,
    enterTransition: reduced ? ({ type: 'tween', duration: 0 } as Transition) : WT_ENTER_TWEEN,
    gaugeEnter: reduced ? ({ type: 'tween', duration: 0 } as Transition) : WT_ENTER_SPRING,
  };
}
