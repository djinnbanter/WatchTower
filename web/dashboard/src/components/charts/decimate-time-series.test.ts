import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { downsampleTimeBuckets } from './decimate-time-series.ts';

function row(t: number, value = t) {
  return { date: new Date(t), value };
}

describe('downsampleTimeBuckets', () => {
  it('keeps sample identity when the window slides by less than a bucket', () => {
    const start = 1_000_000;
    const step = 1_000;
    const data = Array.from({ length: 200 }, (_, i) => row(start + i * step, i));
    const windowMs = 60_000;
    const maxPoints = 30;

    const first = downsampleTimeBuckets(data, maxPoints, start, start + windowMs);
    const slid = downsampleTimeBuckets(
      data,
      maxPoints,
      start + step,
      start + windowMs + step,
    );

    const firstTimes = new Set(first.map((r) => r.date.getTime()));
    const shared = slid.filter((r) => firstTimes.has(r.date.getTime()));
    // Most buckets should reuse the same absolute samples after a 1s slide.
    assert.ok(shared.length > first.length * 0.7);
  });

  it('returns the input when already under the cap', () => {
    const data = [row(0), row(1000), row(2000)];
    assert.equal(downsampleTimeBuckets(data, 10, 0, 2000), data);
  });

  it('keeps the first sample in interior buckets when more points arrive', () => {
    const start = 0;
    const end = 60_000;
    const maxPoints = 3;
    // Interior bucket: first should win after a denser refill. Tip/oldest are forced.
    const sparse = [row(0, 1), row(30_000, 2), row(60_000, 3)];
    const dense = [
      row(0, 1),
      row(5_000, 99),
      row(30_000, 2),
      row(35_000, 98),
      row(60_000, 3),
    ];
    const a = downsampleTimeBuckets(sparse, maxPoints, start, end);
    const b = downsampleTimeBuckets(dense, maxPoints, start, end);
    assert.deepEqual(
      a.map((r) => r.date.getTime()),
      b.map((r) => r.date.getTime()),
    );
    assert.equal(b.find((r) => r.date.getTime() === 0)?.value, 1);
    assert.equal(b.find((r) => r.date.getTime() === 30_000)?.value, 2);
  });

  it('always includes the newest in-range sample as the tip', () => {
    const start = 0;
    const end = 60_000;
    const maxPoints = 4;
    // Many points in the tip bucket — first-wins alone would keep an older tip.
    const data = [
      row(0, 1),
      row(20_000, 2),
      row(40_000, 3),
      row(45_000, 4),
      row(50_000, 5),
      row(55_000, 6),
      row(58_000, 7),
      row(60_000, 99),
    ];
    const out = downsampleTimeBuckets(data, maxPoints, start, end);
    assert.equal(out[0]?.date.getTime(), 0);
    assert.equal(out[out.length - 1]?.date.getTime(), 60_000);
    assert.equal(out[out.length - 1]?.value, 99);
  });

  it('updates the tip when a newer sample arrives in the same tip bucket', () => {
    const start = 0;
    const end = 60_000;
    const maxPoints = 3;
    const first = downsampleTimeBuckets(
      [row(0, 1), row(30_000, 2), row(55_000, 3)],
      maxPoints,
      start,
      end,
    );
    const second = downsampleTimeBuckets(
      [row(0, 1), row(30_000, 2), row(55_000, 3), row(59_000, 42)],
      maxPoints,
      start,
      end,
    );
    assert.equal(first[first.length - 1]?.value, 3);
    assert.equal(second[second.length - 1]?.date.getTime(), 59_000);
    assert.equal(second[second.length - 1]?.value, 42);
  });
});
