import type { ComponentType } from 'react';
import { usePrefersReducedMotion } from '@/ui/motion';
import type { WtIcon, WtIconProps } from './types';

/**
 * Prefer hover animation from lucide-animated, but honor prefers-reduced-motion.
 * Do not forward refs — attaching a ref disables lucide-animated hover playback.
 */
export function withMotionPolicy<P extends WtIconProps>(Icon: ComponentType<P>): WtIcon {
  function MotionPolicyIcon(props: WtIconProps) {
    const reduced = usePrefersReducedMotion();
    const { animateOnHover, ...rest } = props;
    return <Icon {...({ ...rest, animateOnHover: animateOnHover ?? !reduced } as P)} />;
  }
  MotionPolicyIcon.displayName = `MotionPolicy(${Icon.displayName || Icon.name || 'Icon'})`;
  return MotionPolicyIcon;
}
