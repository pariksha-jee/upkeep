import type { MonitorStatus } from '../constants.js';

/**
 * Monitor state machine (anti-flapping).
 *
 * PENDING --first ok--> UP
 * PENDING --failureThreshold consecutive fails--> DOWN (incident opens)
 * UP      --failureThreshold consecutive fails--> DOWN (incident opens)
 * DOWN    --recoveryThreshold consecutive oks--> UP (incident resolves)
 *
 * Counters reset on every opposite outcome; PAUSED monitors are never advanced.
 */
export interface MonitorCounters {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface AdvanceInput {
  status: MonitorStatus;
  counters: MonitorCounters;
  ok: boolean;
  failureThreshold: number;
  recoveryThreshold: number;
}

export type StateTransition = 'none' | 'went-down' | 'went-up';

export interface AdvanceResult {
  status: MonitorStatus;
  counters: MonitorCounters;
  transition: StateTransition;
}

export function advance(input: AdvanceInput): AdvanceResult {
  const { status, ok, failureThreshold, recoveryThreshold } = input;

  // Paused monitors hold their state; the dispatcher never schedules them anyway.
  if (status === 'PAUSED') {
    return { status, counters: input.counters, transition: 'none' };
  }

  if (ok) {
    const consecutiveSuccesses = input.counters.consecutiveSuccesses + 1;
    const counters: MonitorCounters = { consecutiveSuccesses, consecutiveFailures: 0 };
    if (status === 'PENDING') {
      // First confirmed success establishes the baseline immediately.
      return { status: 'UP', counters, transition: 'none' };
    }
    if (status === 'DOWN' && consecutiveSuccesses >= recoveryThreshold) {
      return { status: 'UP', counters, transition: 'went-up' };
    }
    return { status, counters, transition: 'none' };
  }

  const consecutiveFailures = input.counters.consecutiveFailures + 1;
  const counters: MonitorCounters = { consecutiveFailures, consecutiveSuccesses: 0 };
  if ((status === 'UP' || status === 'PENDING') && consecutiveFailures >= failureThreshold) {
    return { status: 'DOWN', counters, transition: 'went-down' };
  }
  return { status, counters, transition: 'none' };
}
