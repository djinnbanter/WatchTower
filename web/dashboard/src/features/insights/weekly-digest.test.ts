import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatDigestPeriod,
  parseDigestHistory,
  trendLabel,
  trendTone,
  type DigestTrend,
} from './weekly-digest.ts';

describe('parseDigestHistory', () => {
  it('parses a valid payload', () => {
    const rows = parseDigestHistory({
      history: [
        {
          id: 'digest-2026-07-28',
          generated_at: '2026-07-28T15:00:00Z',
          trigger: 'auto',
          grade_word: 'Degraded',
          grade_trend: 'worse',
          summary: 'This week: grade Degraded.',
          crashes: { count: 2, top_mod_id: 'create' },
          disk: { growth_gb_7d_est: 14.7, days_until_full: 173.5 },
          performance: { trend: 'worse', mspt_delta_pct: 18.6 },
          mods: { added: 3, removed: 2, changed: 4 },
          top_action: {
            message: 'Update create',
            severity: 'warning',
            tab_link: 'issues',
          },
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'digest-2026-07-28');
    assert.equal(rows[0].crashCount, 2);
    assert.equal(rows[0].crashTopMod, 'create');
    assert.equal(rows[0].diskGrowthGb, 14.7);
    assert.equal(rows[0].topAction?.message, 'Update create');
  });

  it('returns empty for {}', () => {
    assert.deepEqual(parseDigestHistory({}), []);
  });

  it('returns empty for null', () => {
    assert.deepEqual(parseDigestHistory(null), []);
  });
});

describe('trendTone / trendLabel', () => {
  const cases: DigestTrend[] = [
    'improved',
    'steady',
    'worse',
    'better',
    'insufficient',
    'unknown',
  ];
  for (const t of cases) {
    it(`covers ${t}`, () => {
      assert.ok(trendLabel(t).length > 0);
      assert.ok(['ok', 'warn', 'danger', 'neutral'].includes(trendTone(t)));
    });
  }
});

describe('formatDigestPeriod', () => {
  it('formats a known ISO date', () => {
    const label = formatDigestPeriod({
      id: 'x',
      generatedAt: '2026-07-28T15:00:00Z',
      trigger: 'auto',
      gradeWord: 'Healthy',
      gradeTrend: 'unknown',
      summary: '',
      crashCount: 0,
      crashTopMod: null,
      diskGrowthGb: null,
      daysUntilFull: null,
      msptDeltaPct: null,
      perfTrend: 'insufficient',
      modsAdded: 0,
      modsRemoved: 0,
      modsChanged: 0,
      topAction: null,
    });
    assert.match(label, /week ending/);
    assert.match(label, /28/);
    assert.match(label, /Jul/i);
  });
});
