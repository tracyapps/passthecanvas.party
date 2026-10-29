import { describe, expect, it } from 'vitest';
import { homography3d } from './homography.js';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 80 }
];

/** Apply a matrix3d (in CSS convention) to a point. */
function apply(m: number[], x: number, y: number) {
  const px = m[0]! * x + m[4]! * y + m[12]!;
  const py = m[1]! * x + m[5]! * y + m[13]!;
  const w = m[3]! * x + m[7]! * y + m[15]!;
  return { x: px / w, y: py / w };
}

describe('homography3d', () => {
  it('maps a rectangle onto a translated + scaled copy exactly', () => {
    const m = homography3d(square, [
      { x: 50, y: 60 },
      { x: 150, y: 60 },
      { x: 150, y: 100 },
      { x: 50, y: 100 }
    ])!;
    expect(apply(m, 0, 0)).toMatchObject({ x: 50, y: 60 });
    expect(apply(m, 100, 0)).toMatchObject({ x: 150, y: 60 });
    expect(apply(m, 100, 80)).toMatchObject({ x: 150, y: 100 });
    expect(apply(m, 0, 80)).toMatchObject({ x: 50, y: 100 });
    // and the middle follows too
    expect(apply(m, 50, 40)).toMatchObject({ x: 100, y: 80 });
  });

  it('maps onto a warped (perspective) quad', () => {
    const m = homography3d(square, [
      { x: 10, y: 10 },
      { x: 120, y: 20 },
      { x: 110, y: 90 },
      { x: 5, y: 75 }
    ])!;
    for (let i = 0; i < 4; i++) {
      const p = apply(m, square[i]!.x, square[i]!.y);
      expect(Math.abs(p.x - [10, 120, 110, 5][i]!)).toBeLessThan(1e-6);
      expect(Math.abs(p.y - [10, 20, 90, 75][i]!)).toBeLessThan(1e-6);
    }
  });

  it('returns null for a degenerate quad', () => {
    const flat = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 }
    ];
    expect(homography3d(square, flat)).toBeNull();
  });
});
