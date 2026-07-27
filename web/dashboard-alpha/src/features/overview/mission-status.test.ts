import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  gradeLetter,
  missionTone,
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
