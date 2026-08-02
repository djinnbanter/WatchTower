import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attentionFromGradeReasons,
  gradeLetter,
  gradeReasonTeasers,
  missionTone,
  openTabLabel,
  resolveMissionStatus,
  wordForGrade,
} from './mission-status.ts';

describe('missionTone', () => {
  it('treats degraded as warn even with no attention', () => {
    assert.equal(missionTone('degraded', 0), 'warn');
    assert.equal(missionTone('warning', 0), 'warn');
  });

  it('treats healthy as ok when attention is clear', () => {
    assert.equal(missionTone('healthy', 0), 'ok');
    assert.equal(missionTone('ok', 0), 'ok');
  });

  it('escalates critical and heavy attention to danger', () => {
    assert.equal(missionTone('critical', 0), 'danger');
    assert.equal(missionTone('healthy', 4), 'danger');
  });
});

describe('resolveMissionStatus', () => {
  it('never shows Degraded when tone is green', () => {
    const status = resolveMissionStatus('healthy', 0);
    assert.equal(status.tone, 'ok');
    assert.equal(status.word, 'Healthy');
    assert.equal(status.letter, 'A');
  });

  it('aligns degraded grade with warn tone and Degraded label', () => {
    const status = resolveMissionStatus('degraded', 0);
    assert.equal(status.tone, 'warn');
    assert.equal(status.word, 'Degraded');
    assert.equal(status.letter, 'C');
  });

  it('maps word helpers consistently', () => {
    assert.equal(wordForGrade('degraded'), 'Degraded');
    assert.equal(wordForGrade('healthy'), 'Healthy');
    assert.equal(gradeLetter('healthy'), 'A');
    assert.equal(gradeLetter('degraded'), 'C');
    assert.equal(gradeLetter('critical'), 'F');
  });
});

describe('attentionFromGradeReasons', () => {
  it('maps grade_reasons into attention rows', () => {
    const rows = attentionFromGradeReasons([
      {
        code: 'low_tps_24h',
        severity: 'warning',
        message: '12 low-TPS minutes in the last 24h',
        tab: 'insights',
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'grade:low_tps_24h');
    assert.equal(rows[0].tab, 'insights');
    assert.match(rows[0].label, /low-TPS/);
  });

  it('returns empty for missing or malformed input', () => {
    assert.deepEqual(attentionFromGradeReasons(undefined), []);
    assert.deepEqual(attentionFromGradeReasons([]), []);
    assert.deepEqual(attentionFromGradeReasons([{ code: 'x' }]), []);
  });
});

describe('openTabLabel', () => {
  it('maps known tabs to chrome titles', () => {
    assert.equal(openTabLabel('issues'), 'Issues');
    assert.equal(openTabLabel('crashes'), 'Crashes');
    assert.equal(openTabLabel('insights'), 'Insights');
    assert.equal(openTabLabel('live'), 'Live');
    assert.equal(openTabLabel('backups'), 'Backups');
    assert.equal(openTabLabel('activity'), 'Activity');
    assert.equal(openTabLabel('startup'), 'Startup');
  });

  it('title-cases unknown tabs instead of lying about Backups', () => {
    assert.equal(openTabLabel('mods'), 'Mods');
    assert.equal(openTabLabel(''), 'Details');
  });
});

describe('gradeReasonTeasers', () => {
  it('returns up to two plain messages in order', () => {
    const lines = gradeReasonTeasers(
      [
        { code: 'a', message: 'First reason', severity: 'warning', tab: 'insights' },
        { code: 'b', message: 'Second reason', severity: 'critical', tab: 'crashes' },
        { code: 'c', message: 'Third reason', severity: 'warning', tab: 'issues' },
      ],
      2,
    );
    assert.deepEqual(lines, ['First reason', 'Second reason']);
  });

  it('skips malformed rows', () => {
    assert.deepEqual(gradeReasonTeasers([{ code: 'x' }]), []);
  });
});
