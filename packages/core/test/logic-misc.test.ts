import { describe, expect, it } from 'vitest';
import { shouldNotify } from '../src/logic/cooldown.js';

describe('shouldNotify (cooldown)', () => {
  const now = new Date('2026-01-01T12:00:00Z');

  it('allows first notification', () => {
    expect(shouldNotify(null, 5, now)).toBe(true);
  });
  it('blocks within cooldown window', () => {
    expect(shouldNotify(new Date('2026-01-01T11:58:00Z'), 5, now)).toBe(false);
  });
  it('allows after cooldown elapsed', () => {
    expect(shouldNotify(new Date('2026-01-01T11:55:00Z'), 5, now)).toBe(true);
  });
  it('zero cooldown always allows', () => {
    expect(shouldNotify(new Date('2026-01-01T11:59:59Z'), 0, now)).toBe(true);
  });
});
