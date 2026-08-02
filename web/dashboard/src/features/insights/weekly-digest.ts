import { asArray, asRecord, num, str } from '@/lib/utils';

export type DigestTrend =
  | 'improved'
  | 'steady'
  | 'worse'
  | 'better'
  | 'insufficient'
  | 'unknown';

export type DigestTopAction = {
  message: string;
  severity: string;
  tabLink: string;
};

export type DigestRow = {
  id: string;
  generatedAt: string;
  trigger: string;
  gradeWord: string;
  gradeTrend: DigestTrend;
  summary: string;
  crashCount: number;
  crashTopMod: string | null;
  diskGrowthGb: number | null;
  daysUntilFull: number | null;
  msptDeltaPct: number | null;
  perfTrend: DigestTrend;
  modsAdded: number;
  modsRemoved: number;
  modsChanged: number;
  topAction: DigestTopAction | null;
};

function asTrend(v: unknown): DigestTrend {
  const s = str(v);
  switch (s) {
    case 'improved':
    case 'steady':
    case 'worse':
    case 'better':
    case 'insufficient':
    case 'unknown':
      return s;
    default:
      return 'unknown';
  }
}

export function parseDigestHistory(payload: unknown): DigestRow[] {
  const root = asRecord(payload);
  const history = asArray(root.history);
  return history.map((raw) => {
    const row = asRecord(raw);
    const crashes = asRecord(row.crashes);
    const disk = asRecord(row.disk);
    const performance = asRecord(row.performance);
    const mods = asRecord(row.mods);
    const top = asRecord(row.top_action);
    const hasTop = Boolean(str(top.message) || str(top.code));
    return {
      id: str(row.id),
      generatedAt: str(row.generated_at),
      trigger: str(row.trigger, 'auto'),
      gradeWord: str(row.grade_word, str(row.grade, 'Unknown')),
      gradeTrend: asTrend(row.grade_trend),
      summary: str(row.summary),
      crashCount: num(crashes.count),
      crashTopMod: str(crashes.top_mod_id) || null,
      diskGrowthGb: disk.growth_gb_7d_est == null ? null : num(disk.growth_gb_7d_est),
      daysUntilFull: disk.days_until_full == null ? null : num(disk.days_until_full),
      msptDeltaPct: performance.mspt_delta_pct == null ? null : num(performance.mspt_delta_pct),
      perfTrend: asTrend(performance.trend),
      modsAdded: num(mods.added),
      modsRemoved: num(mods.removed),
      modsChanged: num(mods.changed),
      topAction: hasTop
        ? {
            message: str(top.message, str(top.code)),
            severity: str(top.severity, 'info'),
            tabLink: str(top.tab_link, 'issues'),
          }
        : null,
    };
  });
}

export function trendTone(t: DigestTrend): 'ok' | 'warn' | 'danger' | 'neutral' {
  switch (t) {
    case 'improved':
    case 'better':
      return 'ok';
    case 'worse':
      return 'danger';
    case 'steady':
      return 'ok';
    case 'insufficient':
    case 'unknown':
    default:
      return 'neutral';
  }
}

export function trendLabel(t: DigestTrend): string {
  switch (t) {
    case 'improved':
      return 'Improved';
    case 'better':
      return 'Better';
    case 'worse':
      return 'Worse';
    case 'steady':
      return 'Steady';
    case 'insufficient':
      return 'Insufficient data';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

export function formatDigestPeriod(row: DigestRow): string {
  const iso = row.generatedAt;
  if (!iso) return 'week ending —';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'week ending —';
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `week ending ${label}`;
}
