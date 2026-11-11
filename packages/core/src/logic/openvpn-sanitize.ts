/**
 * OpenVPN config sanitizer (security-critical).
 *
 * User-supplied .ovpn files are UNTRUSTED input: on the privileged worker the
 * openvpn process runs as root with NET_ADMIN, so directives like `up`,
 * `route-up`, `iproute` or `script-security` are remote-code-execution. This
 * module enforces a directive allowlist so only safe client options survive.
 * The tunnel schema rejects dangerous configs up front (clear user feedback),
 * and the worker sanitizes AGAIN before writing the file (defense in depth).
 */

/** Directives safe to pass through to the openvpn client. */
const SAFE_DIRECTIVES = new Set([
  'client',
  'tls-client',
  'dev',
  'dev-type',
  'proto',
  'remote',
  'remote-random',
  'remote-random-hostname',
  'nobind',
  'persist-tun',
  'ca',
  'cert',
  'key',
  'cipher',
  'data-ciphers',
  'data-ciphers-fallback',
  'auth',
  'auth-nocache',
  'auth-user-pass',
  'comp-lzo',
  'keepalive',
  'ping',
  'ping-restart',
  'ping-timer-rem',
  'tls-version-min',
  'tls-cipher',
  'tls-auth',
  'tls-crypt',
  'remote-cert-tls',
  'verify-x509-name',
  'verb',
  'mute',
  'float',
  'resolv-retry',
  'connect-retry',
  'connect-retry-max',
  'connect-timeout',
  'server-poll-timeout',
  'sndbuf',
  'rcvbuf',
  'tun-mtu',
  'fragment',
  'mssfix',
]);

/** Inline blocks safe to keep (credential material). */
const SAFE_INLINE_BLOCKS = new Set([
  'ca',
  'cert',
  'key',
  'tls-auth',
  'tls-crypt',
  'auth-user-pass',
]);

export interface SanitizeResult {
  /** Sanitized config (comments stripped, only allowlisted directives). */
  sanitized: string;
  /** Rejected directive names (for schema-level user feedback). */
  rejected: string[];
}

export function sanitizeOpenVpnConfig(config: string): SanitizeResult {
  const rejected: string[] = [];
  const lines: string[] = [];
  let inlineBlock: string | null = null;

  for (const rawLine of config.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (inlineBlock !== null) {
      const close = `</${inlineBlock}>`;
      if (line.toLowerCase() === close) {
        lines.push(close);
        inlineBlock = null;
      } else {
        lines.push(rawLine);
      }
      continue;
    }

    if (line.length === 0 || line.startsWith('#') || line.startsWith(';')) continue;

    const inlineMatch = /^<([a-zA-Z0-9-]+)>$/.exec(line);
    if (inlineMatch !== null) {
      const block = inlineMatch[1]?.toLowerCase() ?? '';
      if (SAFE_INLINE_BLOCKS.has(block)) {
        lines.push(`<${block}>`);
        inlineBlock = block;
      } else {
        rejected.push(`<${block}>`);
      }
      continue;
    }

    const directive = line.split(/\s+/)[0]?.toLowerCase() ?? '';
    if (SAFE_DIRECTIVES.has(directive)) {
      lines.push(line);
    } else {
      rejected.push(directive);
    }
  }

  if (inlineBlock !== null) {
    rejected.push(`<${inlineBlock}> (unterminated)`);
  }
  return { sanitized: lines.join('\n') + '\n', rejected };
}

/** True when the config contains directives that would be stripped (unsafe). */
export function hasUnsafeOpenVpnDirectives(config: string): string[] {
  return sanitizeOpenVpnConfig(config).rejected;
}
