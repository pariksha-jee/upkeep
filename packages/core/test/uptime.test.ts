import { describe, expect, it } from 'vitest';
import { bucketize, uptimeRatio } from '../src/logic/uptime.js';

describe('uptimeRatio', () => {
  it('returns 1 for empty sample sets', () => {
    expect(uptimeRatio(0, 0)).toBe(1);
  });
  it('computes ratio and clamps to [0,1]', () => {
    expect(uptimeRatio(9, 10)).toBeCloseTo(0.9);
    expect(uptimeRatio(0, 10)).toBe(0);
  });
});

describe('bucketize', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2026-01-01T00:10:00Z'); // 10 minutes

  it('distributes points into the right buckets and ignores out-of-window points', () => {
    const points = [
      { checkedAt: new Date('2026-01-01T00:00:30Z'), ok: true, responseTimeMs: 100 },
      { checkedAt: new Date('2026-01-01T00:01:30Z'), ok: false },
      { checkedAt: new Date('2026-01-01T00:09:59Z'), ok: true, responseTimeMs: 300 },
      { checkedAt: new Date('2026-01-01T00:12:00Z'), ok: false }, // outside
      { checkedAt: new Date('2025-12-31T23:00:00Z'), ok: false }, // outside
    ];
    const buckets = bucketize(points, start, end, 10); // 1-minute buckets
    expect(buckets[0]?.total).toBe(1);
    expect(buckets[1]?.total).toBe(1);
    expect(buckets[9]?.total).toBe(1);
    expect(buckets[2]?.total).toBe(0);
    expect(buckets[0]?.avgMs).toBe(100);
    expect(buckets[1]?.avgMs).toBeNull();
    expect(buckets[9]?.avgMs).toBe(300);
    const total = buckets.reduce((acc, b) => acc + b.total, 0);
    expect(total).toBe(3);
  });

  it('averages multiple samples per bucket', () => {
    const points = [
      { checkedAt: new Date('2026-01-01T00:00:10Z'), ok: true, responseTimeMs: 100 },
      { checkedAt: new Date('2026-01-01T00:00:50Z'), ok: true, responseTimeMs: 200 },
    ];
    const buckets = bucketize(points, start, end, 10);
    expect(buckets[0]?.avgMs).toBe(150);
  });
});
