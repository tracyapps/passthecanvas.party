import { describe, expect, it } from 'vitest';
import { allowAttempt, createLink, peekLink, takeLink } from './links.ts';

describe('link codes', () => {
  it('work once, for one party, until they expire', () => {
    const now = 1_000_000;
    const ticket = createLink('party-a', 'm1', 'canvas', now);
    expect(peekLink(ticket.code, now)?.memberId).toBe('m1');
    expect(takeLink(ticket.code, 'party-b', now)).toBeNull();
    expect(takeLink(ticket.code, 'party-a', now)?.role).toBe('canvas');
    expect(takeLink(ticket.code, 'party-a', now)).toBeNull();
    const late = createLink('party-a', 'm1', 'room', now);
    expect(peekLink(late.code, now + 301_000)).toBeNull();
  });
  it('a new code replaces the old one', () => {
    const first = createLink('party-c', 'm1', 'canvas');
    const second = createLink('party-c', 'm1', 'room');
    expect(peekLink(first.code)).toBeNull();
    expect(peekLink(second.code)?.role).toBe('room');
  });
  it('slows down guessing', () => {
    const now = 5_000;
    for (let i = 0; i < 20; i += 1) expect(allowAttempt('ip-x', now)).toBe(true);
    expect(allowAttempt('ip-x', now)).toBe(false);
    expect(allowAttempt('ip-x', now + 600_001)).toBe(true);
  });
});
