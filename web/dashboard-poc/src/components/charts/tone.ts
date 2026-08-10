import type { Tone } from '../../fixtures';

export function toneColor(tone: Tone): string {
  if (tone === 'ok') return 'var(--wt-ok)';
  if (tone === 'warn') return 'var(--wt-warn)';
  if (tone === 'danger') return 'var(--wt-danger)';
  if (tone === 'info') return 'var(--wt-info)';
  return 'var(--wt-text)';
}
