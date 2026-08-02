import { asArray, str } from '@/lib/utils';

const DOMAIN_LABELS: Record<string, string> = {
  lag: 'Lag',
  crash: 'Crash',
  mod: 'Mod change',
  backup: 'Backup',
  lifecycle: 'Lifecycle',
};

function domainLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (DOMAIN_LABELS[key]) return DOMAIN_LABELS[key];
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Friendly headline for an incident story (never the raw `story-…` id). */
export function incidentStoryTitle(story: Record<string, unknown> | null | undefined): string {
  if (!story) return 'Correlated incident';
  const domains = asArray<unknown>(story.domains)
    .map((d) => domainLabel(str(d)))
    .filter(Boolean);
  if (domains.length === 1) return domains[0];
  if (domains.length === 2) return `${domains[0]} → ${domains[1]}`;
  if (domains.length > 2) return domains.join(' → ');

  const narrative = str(story.narrative).trim();
  if (narrative) {
    const first = narrative.split(/[.;]/)[0]?.trim() || narrative;
    if (first.length > 72) return `${first.slice(0, 69).trimEnd()}…`;
    return first;
  }
  return 'Correlated incident';
}

/** One-line narrative for teaser cards (clamped). */
export function incidentStoryBlurb(
  story: Record<string, unknown> | null | undefined,
  maxLen = 140,
): string {
  const narrative = str(story?.narrative).trim();
  if (!narrative) return '';
  if (narrative.length <= maxLen) return narrative;
  return `${narrative.slice(0, maxLen - 1).trimEnd()}…`;
}
