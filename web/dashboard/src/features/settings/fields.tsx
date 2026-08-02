import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SettingsStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('wt-plate st-stack', className)}>{children}</div>;
}

export function SettingsPair({ children }: { children: ReactNode }) {
  return <div className="st-pair">{children}</div>;
}

export function ToggleField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn('st-row st-row--toggle', disabled && 'opacity-60')}>
      <div className="min-w-0">
        <div className="st-row__label">{label}</div>
        {hint ? <div className="st-row__hint">{hint}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!value);
        }}
        className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition ${
          value ? 'bg-wt-accent' : 'bg-wt-bg3'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function NumberField({
  label,
  hint,
  value,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn('st-row', disabled && 'opacity-60')}>
      <div className="st-row__label">{label}</div>
      {hint ? <div className="st-row__hint mb-1.5">{hint}</div> : null}
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          disabled={disabled}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 px-2.5 py-1.5 font-mono text-sm outline-none focus-visible:border-wt-accent focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wt-accent)_35%,transparent)] disabled:cursor-not-allowed"
        />
        {unit ? <span className="text-xs text-wt-text-low">{unit}</span> : null}
      </div>
    </label>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password';
  autoComplete?: string;
}) {
  return (
    <label className="st-row">
      <div className="st-row__label">{label}</div>
      {hint ? <div className="st-row__hint mb-1.5">{hint}</div> : null}
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-[var(--radius-wt)] border border-wt-line bg-wt-bg1 px-2.5 py-1.5 text-sm outline-none focus-visible:border-wt-accent focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--wt-accent)_35%,transparent)]"
      />
    </label>
  );
}

export function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="st-row">
      <div className="st-row__label">{label}</div>
      {hint ? <div className="st-row__hint">{hint}</div> : null}
      <div className="mt-1.5 font-mono text-sm text-wt-text">{value || '—'}</div>
    </div>
  );
}
