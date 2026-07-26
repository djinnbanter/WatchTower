/**
 * Overview SpecularButton wrapper — thin alias of the shared specular CTA Button.
 * Dense queue Open/View actions stay on the lightweight pattern Button ghost kind.
 */
import { Button } from '@/ui/patterns';
import { cn } from '@/lib/utils';
import type { MouseEventHandler, ReactNode } from 'react';

type Kind = 'default' | 'primary';

type Props = {
  children?: ReactNode;
  kind?: Kind;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  size?: 'xs' | 'sm' | 'md' | 'lg';
};

export function OvButton({
  children,
  kind = 'default',
  className,
  onClick,
  disabled,
  type = 'button',
  size = 'sm',
}: Props) {
  return (
    <Button
      kind={kind}
      size={size}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn('ov-specular-cta', className)}
    >
      {children}
    </Button>
  );
}
