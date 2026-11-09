import { describe, expect, it } from 'vitest';
import { clockText, durationText, MIN_TURN_SECONDS, PASS_SECONDS, painterForRound, planTiming, turnSecondsForRest, turnsUntil } from './turns';

const order = ['maya', 'sam', 'you', 'jordan'];

describe('painterForRound', () => {
  it('starts with the first person', () => expect(painterForRound(order, 1)).toBe('maya'));
  it('wraps around', () => expect(painterForRound(order, 5)).toBe('maya'));
  it('handles an empty party', () => expect(painterForRound([], 1)).toBeNull());
});

describe('turnsUntil', () => {
  it('is 0 when painting now', () => expect(turnsUntil(order, 3, 'you')).toBe(0));
  it('counts ahead', () => expect(turnsUntil(order, 1, 'you')).toBe(2));
  it('wraps', () => expect(turnsUntil(order, 4, 'sam')).toBe(2));
});

describe('clockText', () => {
  it('pads seconds', () => expect(clockText(65)).toBe('1:05'));
  it('never goes negative', () => expect(clockText(-3)).toBe('0:00'));
});

describe('lobby settings', () => {
  it('says turn lengths in words', async () => {
    const { turnLengthText } = await import('./turns');
    expect(turnLengthText(30)).toBe('30 seconds');
    expect(turnLengthText(60)).toBe('1 minute');
    expect(turnLengthText(90)).toBe('1 min 30 sec');
    expect(turnLengthText(300)).toBe('5 minutes');
  });
  it('clamps turn length', async () => {
    const { clampTurnSeconds } = await import('./turns');
    expect(clampTurnSeconds(5)).toBe(20);
    expect(clampTurnSeconds('90')).toBe(90);
    expect(clampTurnSeconds(9999)).toBe(600);
    expect(clampTurnSeconds('soon')).toBeNull();
  });
  it('only accepts a reorder of exactly the same people', async () => {
    const { reorder } = await import('./turns');
    expect(reorder(order, ['jordan', 'you', 'sam', 'maya'])).toEqual(['jordan', 'you', 'sam', 'maya']);
    expect(reorder(order, ['jordan', 'jordan', 'sam', 'maya'])).toBeNull();
    expect(reorder(order, ['jordan', 'you', 'sam'])).toBeNull();
    expect(reorder(order, ['jordan', 'you', 'sam', 'intruder'])).toBeNull();
  });
  it('moves someone one place, never off the ends', async () => {
    const { moveInOrder } = await import('./turns');
    expect(moveInOrder(order, 'you', -1)).toEqual(['maya', 'you', 'sam', 'jordan']);
    expect(moveInOrder(order, 'maya', -1)).toEqual(order);
    expect(moveInOrder(order, 'jordan', 1)).toEqual(order);
  });
});

describe('party timing', () => {
  const base = { partyMinutes: 60, turnSeconds: 180, introMinutes: 5, wrapMinutes: 10, laps: 1 };
  it('a set turn length makes the party as long as it takes', () => {
    const plan = planTiming({ ...base, mode: 'turn' }, 4);
    expect(plan.rounds).toBe(5); // 4 artists + the owners' last round
    expect(plan.turnSeconds).toBe(180);
    expect(plan.totalSeconds).toBe(5 * 180 + 4 * PASS_SECONDS + 15 * 60);
  });
  it('a set party length shares the painting time fairly', () => {
    const plan = planTiming({ ...base, mode: 'party' }, 4);
    // 60 min − 15 min intro/wrap − 16 s of passing, over 5 rounds, rounded down to 5 s.
    expect(plan.turnSeconds).toBe(Math.floor((45 * 60 - 16) / 5 / 5) * 5);
    expect(plan.totalSeconds).toBeLessThanOrEqual(60 * 60);
    expect(plan.tooShort).toBe(false);
  });
  it('flags a party too short for everyone', () => {
    const plan = planTiming({ ...base, mode: 'party', partyMinutes: 15 }, 20);
    expect(plan.tooShort).toBe(true);
    expect(plan.turnSeconds).toBe(MIN_TURN_SECONDS);
  });
  it('re-shares the time left mid-party', () => {
    // 3 rounds left, 20 minutes until the end, 10 of them wrap-up.
    expect(turnSecondsForRest({ ...base, mode: 'party' }, 3, 20 * 60)).toBe(Math.floor((600 - 8) / 3 / 5) * 5);
  });
  it('says durations in words', () => {
    expect(durationText(45 * 60)).toBe('45 min');
    expect(durationText(65 * 60)).toBe('1 hr 5 min');
    expect(durationText(120 * 60)).toBe('2 hours');
  });
});
