'use client';

import { useMemo } from 'react';
import type { MonitorStatsDto } from '@upkeep/core';
import styles from './charts.module.css';

/**
 * Uptime bars — one bar per bucket. Heights/colors are driven by per-element
 * CSS custom properties (the documented exception for data-derived values);
 * everything visual lives in the CSS module.
 */
export function UptimeBars({
  stats,
  barCount = 60,
}: {
  stats: MonitorStatsDto;
  barCount?: number;
}) {
  const bars = useMemo(() => {
    const src = stats.buckets;
    if (src.length === 0) return [];
    // Downsample to barCount buckets by merging.
    const factor = Math.max(1, Math.ceil(src.length / barCount));
    const merged: Array<{ total: number; up: number; start: string }> = [];
    for (let i = 0; i < src.length; i += factor) {
      const slice = src.slice(i, i + factor);
      merged.push({
        total: slice.reduce((a, b) => a + b.total, 0),
        up: slice.reduce((a, b) => a + b.up, 0),
        start: slice[0]?.start ?? new Date().toISOString(),
      });
    }
    return merged;
  }, [stats.buckets, barCount]);

  if (bars.length === 0) {
    return <div className={styles.barsEmpty}>No check data in this window yet.</div>;
  }

  return (
    <div
      className={styles.bars}
      role="img"
      aria-label={`Uptime ${(stats.uptimeRatio * 100).toFixed(2)}% over ${stats.window}`}
    >
      {bars.map((b, i) => {
        const ratio = b.total === 0 ? null : b.up / b.total;
        const ratioClass =
          ratio === null
            ? 'none'
            : ratio >= 1
              ? 'full'
              : ratio >= 0.99
                ? 'high'
                : ratio >= 0.9
                  ? 'mid'
                  : 'low';
        return (
          <div
            key={i}
            className={`${styles.bar} ${styles[ratioClass]}`}
            title={
              b.total === 0
                ? 'No checks'
                : `${new Date(b.start).toLocaleString()} — ${(ratio !== null ? ratio * 100 : 0).toFixed(2)}% up (${b.up}/${b.total})`
            }
          />
        );
      })}
    </div>
  );
}
