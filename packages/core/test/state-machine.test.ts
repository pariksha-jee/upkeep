import { describe, expect, it } from 'vitest';
import { advance } from '../src/logic/state-machine.js';
import type { MonitorCounters } from '../src/logic/state-machine.js';
import type { MonitorStatus } from '../src/constants.js';
import type { StateTransition } from '../src/logic/state-machine.js';

const zero: MonitorCounters = { consecutiveFailures: 0, consecutiveSuccesses: 0 };
const thresholds = { failureThreshold: 2, recoveryThreshold: 2 };

describe('monitor state machine', () => {
  it('PENDING + first success → UP, no transition', () => {
    const r = advance({ status: 'PENDING', counters: zero, ok: true, ...thresholds });
    expect(r.status).toBe('UP');
    expect(r.transition).toBe('none');
    expect(r.counters.consecutiveSuccesses).toBe(1);
  });

  it('PENDING + single failure stays PENDING (below threshold)', () => {
    const r = advance({ status: 'PENDING', counters: zero, ok: false, ...thresholds });
    expect(r.status).toBe('PENDING');
    expect(r.transition).toBe('none');
  });

  it('PENDING + threshold failures → DOWN with went-down transition', () => {
    let counters = zero;
    let status: MonitorStatus = 'PENDING';
    let transition: StateTransition = 'none';
    for (let i = 0; i < 2; i++) {
      const r = advance({ status, counters, ok: false, ...thresholds });
      status = r.status;
      counters = r.counters;
      transition = r.transition;
    }
    expect(status).toBe('DOWN');
    expect(transition).toBe('went-down');
  });

  it('UP + single failure stays UP and resets success counter', () => {
    const r = advance({
      status: 'UP',
      counters: { consecutiveFailures: 0, consecutiveSuccesses: 5 },
      ok: false,
      ...thresholds,
    });
    expect(r.status).toBe('UP');
    expect(r.counters).toEqual({ consecutiveFailures: 1, consecutiveSuccesses: 0 });
  });

  it('DOWN + successes below recovery threshold stays DOWN', () => {
    const r1 = advance({ status: 'DOWN', counters: zero, ok: true, ...thresholds });
    expect(r1.status).toBe('DOWN');
    const r2 = advance({ status: r1.status, counters: r1.counters, ok: true, ...thresholds });
    expect(r2.status).toBe('UP');
    expect(r2.transition).toBe('went-up');
  });

  it('respects asymmetric thresholds', () => {
    // failureThreshold 1, recoveryThreshold 3
    const down = advance({
      status: 'UP',
      counters: zero,
      ok: false,
      failureThreshold: 1,
      recoveryThreshold: 3,
    });
    expect(down.status).toBe('DOWN');

    let counters = down.counters;
    let status = down.status;
    for (let i = 0; i < 2; i++) {
      const r = advance({
        status,
        counters,
        ok: true,
        failureThreshold: 1,
        recoveryThreshold: 3,
      });
      status = r.status;
      counters = r.counters;
    }
    expect(status).toBe('DOWN'); // only 2 successes, need 3

    const final = advance({
      status,
      counters,
      ok: true,
      failureThreshold: 1,
      recoveryThreshold: 3,
    });
    expect(final.status).toBe('UP');
    expect(final.transition).toBe('went-up');
  });

  it('PAUSED never advances', () => {
    const r = advance({
      status: 'PAUSED',
      counters: zero,
      ok: false,
      ...thresholds,
    });
    expect(r.status).toBe('PAUSED');
    expect(r.transition).toBe('none');
  });
});
