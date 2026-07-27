import { describe, expect, it } from 'vitest';
import { downsampleTimeBuckets } from './decimate-time-series';

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
    expect(shared.length).toBeGreaterThan(first.length * 0.7);
  });

  it('returns the input when already under the cap', () => {
    const data = [row(0), row(1000), row(2000)];
    expect(downsampleTimeBuckets(data, 10, 0, 2000)).toBe(data);
  });

  it('keeps the first sample in a bucket when more points arrive', () => {
    const start = 0;
    const end = 60_000;
    const maxPoints = 3;
    // Two points land in the same wide bucket; first should win after a denser refill.
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
    expect(a.map((r) => r.date.getTime())).toEqual(b.map((r) => r.date.getTime()));
    expect(b.find((r) => r.date.getTime() === 0)?.value).toBe(1);
  });
});
