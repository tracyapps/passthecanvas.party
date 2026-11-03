import { describe, expect, it } from 'vitest';
import { sanitizeStroke, strokeIsPossible, unavailability } from './paint';

const canvas = { width: 1600, height: 1200 };
const blue = { medium: 'acrylic' as const, name: 'Blue', colors: ['#1234ab'] };
function stroke(extra: Record<string, unknown> = {}) {
  return { id: 's1', canvasId: 'c1', tool: 'round', load: blue, wet: false, size: 24, intensity: 0.5, first: 0, done: false, stamps: [{ x: 10, y: 20, pressure: 0.5, angle: 0 }], ...extra };
}

describe('shared paint rules', () => {
  it('lets brushes take acrylic or watercolor, but keeps knives and airbrushes on acrylic', () => {
    expect(unavailability('flat', 'watercolor')).toBe('');
    expect(unavailability('knife', 'watercolor')).not.toBe('');
    expect(unavailability('airbrush', 'acrylic')).toBe('');
    expect(unavailability('pencil', 'charcoal')).not.toBe('');
  });

  it('only accepts strokes a real table could make', () => {
    expect(strokeIsPossible({ tool: 'round', load: null, wet: false })).toBe(false);
    expect(strokeIsPossible({ tool: 'round', load: null, wet: true })).toBe(true);
    expect(strokeIsPossible({ tool: 'eraser', load: null, wet: false })).toBe(true);
    expect(strokeIsPossible({ tool: 'knife', load: { ...blue, medium: 'watercolor' }, wet: false })).toBe(false);
    expect(strokeIsPossible({ tool: 'sponge', load: null, wet: true })).toBe(false);
  });

  it('clamps stamps to the canvas and drops junk', () => {
    const clean = sanitizeStroke(stroke({ stamps: [{ x: 99999, y: -999, pressure: 4, angle: 9 }] }), canvas)!;
    expect(clean.stamps[0]).toEqual({ x: 1650, y: -50, pressure: 1, angle: Math.PI });
    expect(sanitizeStroke(stroke({ tool: 'laser' }), canvas)).toBeNull();
    expect(sanitizeStroke(stroke({ load: { ...blue, colors: ['red'] } }), canvas)).toBeNull();
    expect(sanitizeStroke(stroke({ load: { ...blue, colors: Array(10).fill('#000000') } }), canvas)).toBeNull();
    expect(sanitizeStroke(stroke({ id: '' }), canvas)).toBeNull();
    expect(sanitizeStroke(stroke({ canvasId: '../x' }), canvas)).toBeNull();
  });
});
