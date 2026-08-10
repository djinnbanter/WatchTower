import type { ComponentProps } from 'react';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export { Button, buttonVariants, Badge, badgeVariants };

/** Mono meta text action — replaces hand-rolled CTA links. */
export function MetaLink({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="link"
      className={cn(
        'h-auto p-0 wt-meta text-primary no-underline hover:text-foreground hover:no-underline',
        className,
      )}
      {...props}
    />
  );
}

/** Outlined industrial control. */
export function MetaButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" size="sm" className={cn('wt-meta', className)} {...props} />
  );
}
