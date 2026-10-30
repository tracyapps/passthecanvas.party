import { expect, it } from 'vitest';
import { constrainSupply } from './study-placement';

const bounds = { x: 8, y: 96, width: 1424, height: 904 };
const canvas = { x: 300, y: 180, width: 900, height: 550 };

it('keeps every edge of palettes inside the display', () => {
  const box = constrainSupply({ x: 1400, y: 950, width: 430, height: 170 }, bounds);
  expect(box).toEqual({ x: 1002, y: 830, width: 430, height: 170 });
});

it('permits handle overflow but keeps the entire working end in bounds', () => {
  const box = constrainSupply({ x: 1600, y: 1300, width: 240, height: 300 }, bounds,
    { x: 20, y: 10, width: 100, height: 110 });
  expect(box.x + 120).toBe(1432);
  expect(box.y + 120).toBe(1000);
  expect(box.x + box.width).toBeGreaterThan(1440);
  expect(box.y + box.height).toBeGreaterThan(1000);
});

it('moves a working end clear of the canvas while allowing its handle underneath', () => {
  const box = constrainSupply({ x: 1170, y: 300, width: 240, height: 300 }, bounds,
    { x: 0, y: 0, width: 100, height: 110 }, canvas);
  expect(box.x).toBe(1200);
  const under = constrainSupply({ x: 1150, y: 700, width: 240, height: 300 }, bounds,
    { x: 120, y: 20, width: 100, height: 110 }, canvas);
  expect(under.x).toBe(1150);
});

it('recovers containers from the canvas and tools dragged past the top or left', () => {
  const box = constrainSupply({ x: 650, y: 550, width: 430, height: 170 }, bounds, undefined, canvas);
  expect(box.y).toBe(730);
  const tool = constrainSupply({ x: -800, y: -800, width: 240, height: 300 }, bounds,
    { x: 20, y: 10, width: 100, height: 110 });
  expect(tool.x + 20).toBe(8);
  expect(tool.y + 10).toBe(96);
});
