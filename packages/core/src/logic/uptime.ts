/** Uptime math — pure functions shared by stats endpoints and aggregation jobs. */

export function uptimeRatio(up: number, total: number): number {
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, up / total));
}

export interface CheckPoint {
  checkedAt: Date;
  ok: boolean;
  responseTimeMs?: number | null;
}

export interface StatsBucket {
  start: Date;
  total: number;
  up: number;
  sumMs: number;
  countMs: number;
  avgMs: number | null;
}

/**
 * Bucketize check points into `bucketCount` equal buckets across [windowStart, windowEnd).
 * Points outside the window are ignored. `avgMs` is null when a bucket has no
 * successful timed samples.
 */
export function bucketize(
  points: readonly CheckPoint[],
  windowStart: Date,
  windowEnd: Date,
  bucketCount: number,
): StatsBucket[] {
  const span = windowEnd.getTime() - windowStart.getTime();
  const bucketMs = span / bucketCount;
  const buckets: StatsBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    start: new Date(windowStart.getTime() + i * bucketMs),
    total: 0,
    up: 0,
    sumMs: 0,
    countMs: 0,
    avgMs: null,
  }));

  for (const p of points) {
    const t = p.checkedAt.getTime();
    if (t < windowStart.getTime() || t >= windowEnd.getTime()) continue;
    const idx = Math.min(bucketCount - 1, Math.floor((t - windowStart.getTime()) / bucketMs));
    const bucket = buckets[idx];
    if (!bucket) continue;
    bucket.total += 1;
    if (p.ok) {
      bucket.up += 1;
      if (typeof p.responseTimeMs === 'number') {
        bucket.sumMs += p.responseTimeMs;
        bucket.countMs += 1;
      }
    }
  }

  for (const b of buckets) {
    b.avgMs = b.countMs > 0 ? Math.round(b.sumMs / b.countMs) : null;
  }
  return buckets;
}
