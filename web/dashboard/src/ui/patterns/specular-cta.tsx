/**
 * Theme-aware CTA presets — CSS-only (no WebGL / ogl).
 * Primary keeps the accent fill; default matches the glass plate treatment.
 */
import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type SpecularCtaKind = 'default' | 'primary';

export type SpecularCtaButtonProps = {
  children?: ReactNode;
  kind?: SpecularCtaKind;
  className?: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  size?: 'xs' | 'sm' | 'md' | 'lg';
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
  const sizeClass =
    size === 'lg'
      ? 'wt-specular-cta--lg'
      : size === 'md'
        ? 'wt-specular-cta--md'
        : size === 'xs'
          ? 'wt-specular-cta--xs'
          : 'wt-specular-cta--sm';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      form={form}
      aria-label={ariaLabel}
      className={cn(
        'wt-specular-cta ov-specular-cta',
        kind === 'primary' ? 'wt-specular-cta--primary' : 'wt-specular-cta--default',
        sizeClass,
        className,
      )}
    >
      {children}
    </button>
  );
}
