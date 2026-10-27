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
