import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHART_AXIS_TIME_SPAN_MS,
  formatChartAxisTick,
  hmTimeFmt,
  shortDateFmt,
} from './chart-formatters';

describe('formatChartAxisTick', () => {
  const noon = new Date('2026-07-27T12:00:00');
  const midMinute = new Date('2026-07-27T12:00:45');

  it('uses HH:MM (no seconds) for Live-length windows', () => {
    assert.equal(
      formatChartAxisTick(noon, 15 * 60 * 1000),
      hmTimeFmt.format(noon),
    );
    assert.equal(
      formatChartAxisTick(noon, 60 * 60 * 1000),
      hmTimeFmt.format(noon),
    );
    // Sliding wall-clock domains must not rewrite the label every second.
    assert.equal(
      formatChartAxisTick(midMinute, 15 * 60 * 1000),
      formatChartAxisTick(noon, 15 * 60 * 1000),
    );
  });

  it('uses calendar day for multi-day domains', () => {
    assert.equal(
      formatChartAxisTick(noon, CHART_AXIS_TIME_SPAN_MS),
      shortDateFmt.format(noon),
    );
    assert.equal(
      formatChartAxisTick(noon, 7 * 24 * 60 * 60 * 1000),
      shortDateFmt.format(noon),
    );
  });
});
