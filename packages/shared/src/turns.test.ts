import { describe, expect, it } from 'vitest';
import { clockText, painterForRound, turnsUntil } from './turns';

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
