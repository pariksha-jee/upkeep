import { describe, expect, it } from 'vitest';
import { hasUnsafeOpenVpnDirectives, isPrivateHostnameLiteral } from '../src/index.js';

describe('isPrivateHostnameLiteral (SSRF guard)', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '192.168.1.1',
    '172.16.0.1',
    '172.31.255.255',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'localhost',
    'db.internal',
  ])('rejects private/loopback host %s', (host) => {
    expect(isPrivateHostnameLiteral(host)).toBe(true);
  });
  it.each(['example.com', 'api.upkeep.dev', '8.8.8.8', '1.1.1.1', '172.32.0.1'])(
    'allows public host %s',
    (host) => {
      expect(isPrivateHostnameLiteral(host)).toBe(false);
    },
  );
});

describe('openvpn config sanitizer (RCE guard)', () => {
  it('accepts a safe client config unchanged (modulo comments)', () => {
    const config = [
      'client',
      'dev tun',
      'proto udp',
      'remote vpn.example.com 1194',
      'resolv-retry infinite',
      'nobind',
      'persist-tun',
      '<ca>',
      '-----BEGIN CERTIFICATE-----',
      'x',
      '-----END CERTIFICATE-----',
      '</ca>',
      'verb 3',
    ].join('\n');
    expect(hasUnsafeOpenVpnDirectives(config)).toEqual([]);
  });

  it.each([
    ['up /tmp/evil.sh', 'up'],
    ['script-security 2', 'script-security'],
    ['route-up /bin/nc', 'route-up'],
    ['iproute /bin/evil', 'iproute'],
    ['http-proxy internal 8080', 'http-proxy'],
    ['user root', 'user'],
    ['chroot /tmp', 'chroot'],
    ['<secret-script>\nx\n</secret-script>', '<secret-script>'],
  ])('rejects dangerous directive %s', (line, expected) => {
    const rejected = hasUnsafeOpenVpnDirectives(`client\nremote vpn.example.com 1194\n${line}\n`);
    expect(rejected).toContain(expected);
  });
});
