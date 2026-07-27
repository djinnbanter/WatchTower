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
