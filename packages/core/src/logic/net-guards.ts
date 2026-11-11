/**
 * Pure hostname guards shared by schemas, the API services and the check
 * engine. These check LITERAL hostnames only (no DNS) — services that can
 * afford DNS must additionally resolve and re-check (DNS-rebinding defense).
 *
 * Private targets are legitimate ONLY for tunnel-attached monitors; direct
 * (public-route) monitors must never probe the API host's internal network.
 */

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

const PRIVATE_V4_DECIMAL = /^(?:0|10|127|1690?9?0?|2886729728|3232235[0-9]{3})\d*$/;

export function isPrivateHostnameLiteral(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    bare === 'localhost' ||
    bare === '::1' ||
    bare.endsWith('.localhost') ||
    bare.endsWith('.internal')
  ) {
    return true;
  }
  if (/^[0-9.]+$/.test(bare)) {
    // Reject non-dotted decimal/hex/octal IPv4 encodings (e.g. 2130706433).
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(bare) || PRIVATE_V4_DECIMAL.test(bare)) return true;
    return PRIVATE_V4.some((re) => re.test(bare));
  }
  if (/^[0-9a-f:]+$/.test(bare)) {
    return (
      bare === '::1' ||
      bare === '::' ||
      bare.startsWith('fc') ||
      bare.startsWith('fd') ||
      bare.startsWith('fe80')
    );
  }
  return false;
}

/** Hostname of an http(s) URL, or null when unparseable. */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
