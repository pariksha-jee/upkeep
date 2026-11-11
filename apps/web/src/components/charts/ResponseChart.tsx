'use client';

import { useMemo } from 'react';
import type { MonitorStatsDto } from '@upkeep/core';
import styles from './charts.module.css';

/**
 * Response-time chart — pure inline SVG. Geometry (the polyline points) is
 * data-driven and computed here; all strokes/fills come from CSS classes on
 * the SVG elements (tokens in charts.module.css).
 */
export function ResponseChart({
  stats,
  height = 160,
}: {
  stats: MonitorStatsDto;
  height?: number;
}) {
  const { path, area, max, points } = useMemo(() => {
    const buckets = stats.buckets.filter((b) => b.avgMs !== null && b.avgMs > 0);
    if (buckets.length < 2) {
      return {
        path: '',
        area: '',
        max: 0,
        points: [] as Array<{ x: number; y: number; ms: number }>,
      };
    }
    const width = 100; // viewbox units; scales responsively
    const maxMs = Math.max(...buckets.map((b) => b.avgMs ?? 0)) * 1.15;
    const step = width / (buckets.length - 1);
    const pts = buckets.map((b, i) => ({
      x: i * step,
      y: 100 - ((b.avgMs ?? 0) / maxMs) * 100,
      ms: b.avgMs ?? 0,
    }));
    const d = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');
    const a = `${d} L100,100 L0,100 Z`;
    return { path: d, area: a, max: Math.round(maxMs / 1.15), points: pts };
  }, [stats.buckets]);

  if (path === '') {
    return <div className={styles.barsEmpty}>Not enough response-time data yet.</div>;
  }

  return (
    <div className={styles.responseWrap}>
      <svg
        className={styles.responseSvg}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Response time, max ${max} ms over ${stats.window}`}
        style={{ height: `${height}px` }}
      >
        {[25, 50, 75].map((y) => (
          <line key={y} className={styles.gridLine} x1="0" y1={y} x2="100" y2={y} />
        ))}
        <path className={styles.responseArea} d={area} />
        <path className={styles.responseLine} d={path} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} className={styles.responseDot} cx={p.x} cy={p.y} r="1.2">
            <title>{`${Math.round(p.ms)} ms`}</title>
          </circle>
        ))}
      </svg>
      <div className={styles.responseMeta}>
        <span className={styles.responseMax}>peak {max} ms</span>
        <span className={styles.responseAvg}>
          avg {stats.avgResponseMs !== null ? `${stats.avgResponseMs} ms` : '—'}
        </span>
      </div>
    </div>
  );
}
