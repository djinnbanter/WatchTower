import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeStableTimeSeriesRows } from './adapters.ts';

function row(tMs: number, tps: number) {
  return { date: new Date(tMs), tps };
}

/** Simulate `/api/samples` index-stride: take every `step`-th point + tip. */
function strideSample<T>(rows: T[], step: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += step) out.push(rows[i]!);
  const tip = rows[rows.length - 1]!;
  if (out[out.length - 1] !== tip) out.push(tip);
  return out;
}

describe('mergeStableTimeSeriesRows', () => {
  it('keeps settled timestamps when a later poll reshuffles via index stride', () => {
    const dense = Array.from({ length: 100 }, (_, i) =>
      row(1_000_000 + i * 1000, 20 - (i % 5) * 0.1),
    );
    const first = strideSample(dense.slice(0, 90), 3);
    const second = strideSample(dense.slice(0, 95), 3);

    const merged = mergeStableTimeSeriesRows(first, second);

    assert.deepEqual(
      merged.slice(0, first.length - 1).map((r) => r.date.getTime()),
      first.slice(0, first.length - 1).map((r) => r.date.getTime()),
    );
    assert.equal(
      merged[merged.length - 1]!.date.getTime(),
      second[second.length - 1]!.date.getTime(),
    );
    assert.ok(merged.length >= first.length);
  });

  it('refreshes the tip when the last timestamp matches', () => {
    const prev = [row(1000, 19), row(2000, 18)];
    const next = [row(500, 20), row(2000, 17.5)];
    const merged = mergeStableTimeSeriesRows(prev, next);
    assert.equal(merged.length, 2);
    assert.equal(merged[1]!.tps, 17.5);
  });

  it('trims by maxAgeMs and maxPoints', () => {
    const tip = 1_000_000;
    const prev = [row(tip - 10_000, 20), row(tip - 1000, 19), row(tip, 18)];
    const next = [row(tip + 1000, 17)];
    const merged = mergeStableTimeSeriesRows(prev, next, {
      maxAgeMs: 5000,
      maxPoints: 10,
    });
    assert.ok(merged.every((r) => r.date.getTime() >= tip + 1000 - 5000));
    assert.equal(merged[merged.length - 1]!.tps, 17);
  });
});
