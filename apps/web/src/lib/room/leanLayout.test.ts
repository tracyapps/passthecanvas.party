import { describe, expect, it } from 'vitest';
import type { ArtRegion } from '@ptc/shared';
import { areaAspect, leanColumns, planGallery, subQuad } from './leanLayout';

function quad(yaw: number, pitch: number, wDeg: number, hDeg: number): ArtRegion['corners'] {
  return [
    { yaw: yaw - wDeg / 2, pitch: pitch + hDeg / 2 },
    { yaw: yaw + wDeg / 2, pitch: pitch + hDeg / 2 },
    { yaw: yaw + wDeg / 2, pitch: pitch - hDeg / 2 },
    { yaw: yaw - wDeg / 2, pitch: pitch - hDeg / 2 }
  ];
}

function region(id: string, role: 'wall' | 'lean', corners: ArtRegion['corners']): ArtRegion {
  return { id, label: id, role, corners };
}

describe('leanColumns — dimensions decide how many pieces fit', () => {
  it('fits two tall canvases in a 1.5:1 area, but only one landscape', () => {
    expect(leanColumns(1.5, 0.66)).toBe(2);
    expect(leanColumns(1.5, 1.6)).toBe(1);
  });

  it('tiles exactly when the shapes match (three tall in a 2:1 area)', () => {
    expect(leanColumns(2.0, 0.66)).toBe(3);
  });

  it('never returns zero or a crowd', () => {
    expect(leanColumns(0.5, 1.6)).toBe(1);
    expect(leanColumns(10, 0.5)).toBe(4);
    expect(leanColumns(Number.NaN, 1)).toBe(1);
    expect(leanColumns(2, 0)).toBe(1);
  });
});

describe('areaAspect / subQuad', () => {
  it('measures a plain rectangle and slices it without losing the warp', () => {
    const q = quad(0, 0, 40, 20);
    expect(areaAspect(q)).toBeCloseTo(2, 1);

    // A warped quad (a floor area seen at an angle): left edge high, right low.
    const warped: ArtRegion['corners'] = [
      { yaw: -20, pitch: -5 },
      { yaw: 20, pitch: -15 },
      { yaw: 20, pitch: -35 },
      { yaw: -20, pitch: -25 }
    ];
    expect(areaAspect(warped)).toBeCloseTo(40 / 20, 1);

    // Slicing at the full range returns the same shape; a middle slice's
    // corners sit on the top and bottom edges (bilinear along each edge).
    const whole = subQuad(warped, 0, 1);
    expect(whole).toEqual(warped);
    const middle = subQuad(warped, 0.25, 0.75);
    expect(middle[0]).toEqual({ yaw: -10, pitch: -7.5 }); // a quarter along the top edge
    expect(middle[2]).toEqual({ yaw: 10, pitch: -32.5 }); // three quarters along the bottom edge
  });
});

describe('planGallery', () => {
  const walls = [region('w1', 'wall', quad(-30, 10, 20, 14)), region('w2', 'wall', quad(30, 10, 20, 14))];
  const leans = [region('l1', 'lean', quad(0, -30, 30, 20))]; // 1.5:1 lean area
  const art = [...walls, ...leans];
  const tall = { seed: 'a', aspect: 0.66 };
  const wide = { seed: 'b', aspect: 1.6 };

  it('walls-then-lean fills walls first, packs the rest into lean areas', () => {
    // Three tall pieces: two on walls, the third leans.
    const plan = planGallery(art, [tall, { ...tall, seed: 'b' }, { ...tall, seed: 'c' }], 'walls-then-lean');
    expect(plan.map((p) => p.regionId)).toEqual(['w1', 'w2', 'l1']);
    expect(plan[2]!.role).toBe('lean');
    expect(plan[2]!.quad[0]!.yaw).toBeGreaterThan(-15); // inside the lean area
    expect(plan[2]!.quad[1]!.yaw).toBeLessThan(15);
  });

  it('two tall pieces lean side by side where one landscape stands alone', () => {
    const twoTall = planGallery(art, [tall, { ...tall, seed: 'b' }], 'lean');
    expect(twoTall).toHaveLength(2);
    expect(new Set(twoTall.map((p) => p.regionId))).toEqual(new Set(['l1']));
    // The left piece ends up left of the right piece.
    expect(twoTall[0]!.quad[0]!.yaw).toBeLessThan(twoTall[1]!.quad[0]!.yaw);

    const oneWide = planGallery(art, [wide], 'lean');
    expect(oneWide).toHaveLength(1);
    // Nearly the whole area: just the 7% inset plus the slot gutter.
    expect(oneWide[0]!.quad[0]!.yaw).toBeCloseTo(-12.1, 1);
  });

  it('walls-only ignores lean areas; lean-only ignores walls; extras are dropped', () => {
    const three = [tall, { ...tall, seed: 'b' }, { ...tall, seed: 'c' }];
    expect(planGallery(art, three, 'walls').map((p) => p.role)).toEqual(['wall', 'wall']);
    expect(planGallery(art, three, 'lean').every((p) => p.role === 'lean')).toBe(true);
    // Four tall pieces, one 1.5:1 lean area: two lean, two dropped.
    expect(planGallery(art, [tall, { ...tall, seed: 'b' }, { ...tall, seed: 'c' }, { ...tall, seed: 'd' }], 'lean')).toHaveLength(2);
  });
});
