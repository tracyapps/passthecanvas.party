import { expect, it } from 'vitest';
import { maskHit, type ShapeMask } from './shape-masks';

// A 10×10 photo whose object is a diagonal stripe (like a brush lying across it).
const mask: ShapeMask = { width: 10, height: 10, solid: new Uint8Array(100).map((_, i) => (Math.abs((i % 10) - Math.floor(i / 10)) <= 1 ? 1 : 0)) };

it('hits the object and misses the see-through corners of its photo', () => {
  expect(maskHit(mask, 0.55, 0.55, 0)).toBe(true);
  expect(maskHit(mask, 0.95, 0.05, 0)).toBe(false);
});
it('forgives a near miss at the edge', () => {
  expect(maskHit(mask, 0.35, 0.05, 0)).toBe(false);
  expect(maskHit(mask, 0.35, 0.05, 0.2)).toBe(true);
});
it('works in fractions, so any displayed size uses the same mask', () => {
  expect(maskHit(mask, 0.5, 0.5)).toBe(maskHit(mask, 0.5, 0.5));
  expect(maskHit(mask, 1.2, 0.5)).toBe(false);
});
