/**
 * Theme-aware SpecularButton presets used by the shared Button and Overview CTAs.
 * Primary keeps the accent fill; default matches the glass “Open Insights” plate.
 */
import SpecularButton, { type SpecularButtonProps } from '@/components/specular-button/SpecularButton';
import { useTheme, type Theme } from '@/app/theme';
import { cn } from '@/lib/utils';
import type { MouseEventHandler, ReactNode } from 'react';

export type SpecularCtaKind = 'default' | 'primary';

type Palette = Pick<
  SpecularButtonProps,
  | 'tint'
  | 'tintOpacity'
  | 'textColor'
  | 'lineColor'
  | 'baseColor'
  | 'intensity'
  | 'blur'
  | 'proximity'
  | 'shineSize'
  | 'thickness'
  | 'shineFade'
>;

export function specularCtaPalette(theme: Theme, kind: SpecularCtaKind): Palette {
  const light = theme === 'light';

  if (kind === 'primary') {
    return {
      // Accent fill — matches --wt-accent family
      tint: light ? '#5e6ad2' : '#7c89e8',
      tintOpacity: 1,
      textColor: '#ffffff',
      lineColor: light ? '#e0e7ff' : '#ffffff',
      baseColor: light ? '#312e81' : '#c7d2fe',
      intensity: light ? 1.6 : 1.25,
      blur: 0,
      proximity: 56,
      shineSize: light ? 18 : 16,
      shineFade: 32,
      thickness: light ? 1.45 : 1.15,
    };
  }

  return {
    tint: light ? '#ffffff' : theme === 'black' ? '#1a1e26' : '#2a303c',
    tintOpacity: 1,
    textColor: light ? '#171a20' : '#f3f5f8',
    lineColor: light ? '#4f5bd5' : '#f8fafc',
    baseColor: light ? '#5e6ad2' : '#64748b',
    intensity: light ? 1.75 : 1.1,
    blur: 0,
    proximity: 56,
    shineSize: light ? 18 : 12,
    shineFade: light ? 42 : 36,
    thickness: light ? 1.55 : 1,
  };
}

export type SpecularCtaButtonProps = {
  children?: ReactNode;
  kind?: SpecularCtaKind;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  size?: SpecularButtonProps['size'];
  title?: string;
  form?: string;
  'aria-label'?: string;
};

export function SpecularCtaButton({
  children,
  kind = 'default',
  className,
  onClick,
  disabled,
  type = 'button',
  size = 'sm',
  title,
  form,
  'aria-label': ariaLabel,
}: SpecularCtaButtonProps) {
  const { theme } = useTheme();
  const colors = specularCtaPalette(theme, kind);
  const radius = size === 'lg' ? 16 : size === 'md' ? 14 : size === 'xs' ? 10 : 12;

  return (
    <SpecularButton
      size={size}
      radius={radius}
      followMouse
      autoAnimate={false}
      className={cn(
        'wt-specular-cta',
        kind === 'primary' ? 'wt-specular-cta--primary' : 'wt-specular-cta--default',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      type={type}
      title={title}
      form={form}
      aria-label={ariaLabel}
      {...colors}
    >
      {children}
    </SpecularButton>
  );
}
