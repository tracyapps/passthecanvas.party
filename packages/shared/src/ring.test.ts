import { describe, expect, it } from 'vitest';
import { canvasOwnerFor, contributionsFor, creditLine, painterOf, roundsFor, seatRing, shuffledRing } from './ring';

const ring = ['maya', 'jordan', 'ari', 'sam'];

describe('the passing ring', () => {
  it('orders people clockwise by seat, then anyone standing', () => {
    const seats: Record<string, string | null> = { maya: 'couch', jordan: 'table', ari: null, sam: 'beanbag' };
    const yaw = { table: 9, couch: -150, beanbag: 120 };
    expect(seatRing(['maya', 'jordan', 'ari', 'sam'], (id) => seats[id] ?? null, yaw)).toEqual(['maya', 'jordan', 'sam', 'ari']);
  });

  it('gives N artists N + 1 rounds, so owners paint first and last', () => {
    expect(roundsFor(4)).toBe(5);
    expect(roundsFor(1)).toBe(1);
    expect(contributionsFor(ring, 'maya', 5).map((c) => c.painterId)).toEqual(['maya', 'jordan', 'ari', 'sam', 'maya']);
  });

  it('passes every canvas one seat clockwise each round', () => {
    expect(canvasOwnerFor(ring, 'jordan', 1)).toBe('jordan');
    expect(canvasOwnerFor(ring, 'jordan', 2)).toBe('maya');
    expect(canvasOwnerFor(ring, 'maya', 2)).toBe('sam');
    expect(painterOf(ring, 'sam', 2)).toBe('maya');
  });

  it('never puts two artists on one canvas, and every artist paints every canvas', () => {
    for (let round = 1; round <= 5; round++) {
      const owners = ring.map((id) => canvasOwnerFor(ring, id, round));
      expect(new Set(owners).size).toBe(ring.length);
    }
    for (const owner of ring) {
      const painters = contributionsFor(ring, owner, 4).map((c) => c.painterId);
      expect(new Set(painters).size).toBe(ring.length);
    }
  });

  it('shuffles once into a ring of the same people', () => {
    const shuffled = shuffledRing(ring, () => 0.3);
    expect([...shuffled].sort()).toEqual([...ring].sort());
  });

  it('writes the credit line', () => {
    expect(creditLine('Maya', ['Jordan', 'Ari', 'Sam', 'Maya'])).toBe('Maya, with the help of Jordan, Ari and Sam');
    expect(creditLine('Maya', ['Maya'])).toBe('Maya');
  });
});
