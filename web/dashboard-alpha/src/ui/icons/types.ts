import type { ComponentType, CSSProperties } from 'react';

/** Minimal props shared by lucide-animated wrappers and lucide-react SVGs. */
export type WtIconProps = {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number | string;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  absoluteStrokeWidth?: boolean;
  animateOnHover?: boolean;
};

export type WtIcon = ComponentType<WtIconProps>;
