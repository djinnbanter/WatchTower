import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampLookbackDays,
  daysToHours,
  hoursToLookbackSelection,
} from './lookback-days';

describe('lookback-days', () => {
  it('clamps days to 1..30', () => {
    assert.equal(clampLookbackDays(0), 1);
    assert.equal(clampLookbackDays(14.7), 14);
    assert.equal(clampLookbackDays(99), 30);
  });

  it('maps days to hours', () => {
    assert.equal(daysToHours(1), 24);
    assert.equal(daysToHours(7), 168);
    assert.equal(daysToHours(30), 720);
  });

  it('maps known hours to presets', () => {
    assert.deepEqual(hoursToLookbackSelection(24), { kind: 'preset', days: 1 });
    assert.deepEqual(hoursToLookbackSelection(168), { kind: 'preset', days: 7 });
    assert.deepEqual(hoursToLookbackSelection(720), { kind: 'preset', days: 30 });
  });

  it('maps other 24-multiples to custom', () => {
    assert.deepEqual(hoursToLookbackSelection(336), { kind: 'custom', days: 14 });
  });

  it('defaults unknown hours to 1-day preset', () => {
    assert.deepEqual(hoursToLookbackSelection(undefined), { kind: 'preset', days: 1 });
    assert.deepEqual(hoursToLookbackSelection(13), { kind: 'preset', days: 1 });
  });
});
