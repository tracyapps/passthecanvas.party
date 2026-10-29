import { describe, expect, it } from 'vitest';
import { affineFromUnitSquare, applyH } from './quadMesh';
import { homography8 } from './homography';

describe('affineFromUnitSquare', () => {
  it('maps the unit square corners exactly', () => {
    const [a, b, c, d, e, f] = affineFromUnitSquare({ x: 10, y: 20 }, { x: 30, y: 26 }, { x: 14, y: 40 });
    // (0,0) → (10,20)
    expect(e).toBe(10);
    expect(f).toBe(20);
    // (1,0) → (30,26)
    expect(e + a).toBe(30);
    expect(f + b).toBe(26);
    // (0,1) → (14,40)
    expect(e + c).toBe(14);
    expect(f + d).toBe(40);
  });
});

describe('applyH (used per-cell by paintQuadMesh)', () => {
  const dst = [
    { x: 10, y: 10 },
    { x: 110, y: 20 },
    { x: 100, y: 80 },
    { x: 4, y: 70 }
  ];
  const h = homography8(
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ],
    dst
  )!;

  it('hits all four corners exactly (so cells tile the quad seamlessly)', () => {
    expect(h).not.toBeNull();
    const corners = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];
    corners.forEach((p, i) => {
      const out = applyH(h, p);
      expect(out.x).toBeCloseTo(dst[i]!.x, 6);
      expect(out.y).toBeCloseTo(dst[i]!.y, 6);
    });
  });

  it('keeps midpoints inside the quad under perspective', () => {
    const mid = applyH(h, { x: 0.5, y: 0.5 });
    expect(mid.x).toBeGreaterThan(4);
    expect(mid.x).toBeLessThan(110);
    expect(mid.y).toBeGreaterThan(10);
    expect(mid.y).toBeLessThan(80);
  });
});
