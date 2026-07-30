import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GlareIcon } from '@/ui/motion';

/** Default visible rows before “+N more” (Friend-3 chunking). */
export const LIST_CAP = 3;

/** Cap a list for display; pair with a “+N more” control when `more > 0`. */
export function useCappedList<T>(items: T[], cap = LIST_CAP) {
  const [expanded, setExpanded] = useState(false);
  const total = items.length;
  const shown = expanded ? items : items.slice(0, Math.max(0, cap));
  const more = expanded ? 0 : Math.max(0, total - cap);
  return {
    shown,
    more,
    total,
    expanded,
    expand: () => setExpanded(true),
    collapse: () => setExpanded(false),
    toggle: () => setExpanded((v) => !v),
  };
}

export function Section({
  title,
  hint,
  children,
  className,
  actions,
  icon: Icon,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            {Icon ? <GlareIcon icon={Icon} size={15} className="h-7 w-7 rounded-[var(--radius-wt-sm)]" /> : null}
            {title}
          </h2>
          {hint ? <p className="text-sm text-wt-text-low">{hint}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function MetricReadout({
  label,
  value,
  unit,
  format,
  tone = 'default',
  size = 'md',
}: {
  label: string;
  value: number;
  unit?: string;
  format?: (n: number) => string;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
  size?: 'sm' | 'md';
}) {
  const text = format ? format(value) : value.toFixed(1);
  const toneClass =
    tone === 'ok'
      ? 'text-wt-ok'
      : tone === 'warn'
        ? 'text-wt-warn'
        : tone === 'danger'
          ? 'text-wt-danger'
          : 'text-wt-text';
  const valueClass = size === 'sm' ? 'text-lg' : 'text-3xl';

  return (
    <div>
      {label ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wt-text-low">{label}</div>
      ) : null}
      <div className={cn(label ? 'mt-1' : undefined, 'font-mono font-semibold tabular-nums', valueClass, toneClass)}>
        {text}
        {unit ? <span className="ml-1 text-base text-wt-text-low">{unit}</span> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg2/50 px-4 py-8 text-center">
      <h3 className="font-medium">{title}</h3>
      {children ? <p className="mt-1 text-sm text-wt-text-mid">{children}</p> : null}
    </div>
  );
}

export function ErrorState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-wt)] border border-wt-danger/30 bg-wt-danger/10 px-4 py-6">
      <h3 className="font-medium text-wt-danger">{title}</h3>
      {children ? <p className="mt-1 text-sm text-wt-text-mid">{children}</p> : null}
    </div>
  );
}

export function StatusPill({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info';
  title?: string;
}) {
  const tones = {
    neutral: 'border-wt-line bg-wt-bg2 text-wt-text-mid',
    ok: 'border-wt-ok/40 bg-wt-ok/10 text-wt-ok',
    warn: 'border-wt-warn/40 bg-wt-warn/10 text-wt-warn',
    danger: 'border-wt-danger/40 bg-wt-danger/10 text-wt-danger',
    info: 'border-wt-info/40 bg-wt-info/10 text-wt-info',
  };
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-[var(--radius-wt-sm)] border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function QueueRow({
  title,
  detail,
  action,
  flush = false,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  /** Flat row for use inside a shared plate (no nested card chrome). */
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 w-full gap-3',
        flush
          ? 'items-center px-3 py-2'
          : 'items-start rounded-[var(--radius-wt-sm)] border border-wt-line bg-wt-bg2/60 px-3 py-3',
      )}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]">{title}</div>
        {detail ? (
          <div className="mt-0.5 break-words text-[13px] leading-snug text-wt-text-mid [overflow-wrap:anywhere]">
            {detail}
          </div>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1.5 self-start">{action}</div> : null}
    </div>
  );
}

export function Button({
  children,
  kind = 'default',
  className,
  size = 'sm',
  type = 'button',
  onClick,
  disabled,
  title,
  form,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: 'default' | 'primary' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  // Ghost stays lightweight for dense rows / text actions.
  if (kind === 'ghost') {
    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        title={title}
        form={form}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-[var(--radius-wt-sm)] px-3 py-2 text-sm font-medium text-wt-text-mid transition hover:bg-wt-bg3 hover:text-wt-text',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  }

  // Default/primary are CSS-only. Prefer SpecularCtaButton for hero CTAs.
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
      aria-label={typeof rest['aria-label'] === 'string' ? rest['aria-label'] : undefined}
      className={cn(
        'wt-specular-cta',
        kind === 'primary' ? 'wt-specular-cta--primary' : 'wt-specular-cta--default',
        sizeClass,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export { HeroTabNav, type HeroTabItem } from './hero-tab-nav';
export { SpecularCtaButton, type SpecularCtaKind, type SpecularCtaButtonProps } from './specular-cta';
export { HeroCard, type HeroCardProps, type HeroTone } from './hero-card';
