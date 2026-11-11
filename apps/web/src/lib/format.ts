export function formatPercent(ratio: number | null | undefined, digits = 2): string {
  if (ratio === null || ratio === undefined) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600)
    return `${seconds / 60 === Math.floor(seconds / 60) ? seconds / 60 : seconds / 60}m`.replace(
      /\.0/,
      '',
    );
  const h = seconds / 3600;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

export function formatDuration(startIso: string, endIso: string | null): string {
  const ms =
    (endIso !== null ? new Date(endIso).getTime() : Date.now()) - new Date(startIso).getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
