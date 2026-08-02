/** Overview mission tone + label — one mapping for scorecard grades. */

export type MissionTone = 'ok' | 'warn' | 'danger';

export type MissionStatus = {
  tone: MissionTone;
  letter: string;
  word: string;
};

function normalizeGrade(grade: string): string {
  return grade.trim().toLowerCase();
}

export function gradeLetter(grade: string): string {
  const g = normalizeGrade(grade);
  if (g === 'critical' || g === 'f' || g === 'danger') return 'F';
  if (g === 'degraded' || g === 'warning' || g === 'warn' || g === 'd' || g === 'c') return 'C';
  if (g === 'healthy' || g === 'ok' || g === 'good' || g === 'a' || g === 'b' || g === 'nominal') {
    return 'A';
  }
  return grade.slice(0, 1).toUpperCase() || '?';
}

/** Word for the grade alone (ignores attention queue). */
export function wordForGrade(grade: string): string {
  const g = normalizeGrade(grade);
  if (g === 'critical' || g === 'f' || g === 'danger') return 'Critical';
  if (g === 'degraded' || g === 'warning' || g === 'warn' || g === 'd' || g === 'c') return 'Degraded';
  if (g === 'healthy' || g === 'ok' || g === 'good' || g === 'a' || g === 'b' || g === 'nominal') {
    return 'Healthy';
  }
  return grade ? grade.charAt(0).toUpperCase() + grade.slice(1) : 'Healthy';
}

export function missionTone(grade: string, attentionCount: number): MissionTone {
  const g = normalizeGrade(grade);
  if (g === 'critical' || g === 'f' || g === 'danger' || attentionCount >= 4) return 'danger';
  if (
    g === 'degraded' ||
    g === 'warning' ||
    g === 'warn' ||
    g === 'd' ||
    g === 'c' ||
    attentionCount > 0
  ) {
    return 'warn';
  }
  return 'ok';
}

/**
 * Single source for Overview glow + grade pill.
 * When tone is ok (green), word is never "Degraded".
 */
export function resolveMissionStatus(grade: string, attentionCount: number): MissionStatus {
  const tone = missionTone(grade, attentionCount);
  const letter = gradeLetter(grade);
  let word = wordForGrade(grade);
  if (tone === 'ok') word = 'Healthy';
  else if (tone === 'danger' && word === 'Healthy') word = 'Critical';
  else if (tone === 'warn' && word === 'Healthy') word = 'Degraded';
  return { tone, letter, word };
}

export type GradeReasonAttention = {
  id: string;
  label: string;
  detail: string;
  severity: string;
  tab: string;
};

/**
 * Map scorecard.grade_reasons into Overview attention rows.
 * Used when grade is driven by scorecard (perf/health/crashes) so the
 * Needs attention plate is never empty while the pill says Degraded/Critical.
 */
export function attentionFromGradeReasons(
  reasons: unknown,
): GradeReasonAttention[] {
  if (!Array.isArray(reasons)) return [];
  const out: GradeReasonAttention[] = [];
  for (const raw of reasons) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const code = typeof r.code === 'string' ? r.code : '';
    const message = typeof r.message === 'string' ? r.message : '';
    if (!code || !message) continue;
    const severity =
      typeof r.severity === 'string' && r.severity ? r.severity : 'warning';
    const tab = typeof r.tab === 'string' && r.tab ? r.tab : 'insights';
    out.push({
      id: `grade:${code}`,
      label: message,
      detail: 'Why Overview grade is not Healthy',
      severity,
      tab,
    });
  }
  return out;
}

const TAB_LABELS: Record<string, string> = {
  issues: 'Issues',
  crashes: 'Crashes',
  insights: 'Insights',
  live: 'Live',
  backups: 'Backups',
  activity: 'Activity',
  startup: 'Startup',
  overview: 'Overview',
  mods: 'Mods',
  session: 'Session',
  spark: 'Spark',
  docs: 'Help',
  settings: 'Settings',
};

/** Chrome title for a dashboard tab id (never invent “Backups” for unknown tabs). */
export function openTabLabel(tab: string): string {
  const key = tab.trim().toLowerCase();
  if (!key) return 'Details';
  if (TAB_LABELS[key]) return TAB_LABELS[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Plain grade_reason messages for mission-band teaser (not attention rows). */
export function gradeReasonTeasers(reasons: unknown, limit = 2): string[] {
  if (!Array.isArray(reasons)) return [];
  const out: string[] = [];
  for (const raw of reasons) {
    if (!raw || typeof raw !== 'object') continue;
    const message =
      typeof (raw as { message?: unknown }).message === 'string'
        ? (raw as { message: string }).message.trim()
        : '';
    if (!message) continue;
    out.push(message);
    if (out.length >= limit) break;
  }
  return out;
}
