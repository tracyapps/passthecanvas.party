import { describe, expect, it } from 'vitest';
import { fitView, zoomView, panView } from './study-view';
describe('canvas navigation', () => {
  it('keeps the focal artwork point under the pointer', () => {
    const before = { zoom: 2, x: 0.3, y: 0.4 };
    const next = zoomView(before, 4, 0.25, 0.75);
    expect((next.x + 0.25) / next.zoom).toBeCloseTo((before.x + 0.25) / before.zoom);
    expect((next.y + 0.75) / next.zoom).toBeCloseTo((before.y + 0.75) / before.zoom);
  });
  it('bounds navigation and fits without losing artwork', () => {
    expect(panView({ zoom: 3, x: 1, y: 1 }, -50, 50)).toEqual({ zoom: 3, x: 0, y: 2 });
    expect(zoomView({ zoom: 6, x: 5, y: 5 }, 1)).toEqual(fitView());
    expect(zoomView(fitView(), 20).zoom).toBe(6);
  });
});
