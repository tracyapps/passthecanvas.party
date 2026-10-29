import { describe, expect, it } from 'vitest';
import { sanitizeArt } from './art.js';

const quad = [
  { yaw: -30, pitch: 20 },
  { yaw: -10, pitch: 22 },
  { yaw: -9, pitch: 4 },
  { yaw: -31, pitch: 6 }
];
const good = { room: 'cream-city', art: [{ id: 'art_brick', label: 'Brick wall', corners: quad }] };

describe('sanitizeArt', () => {
  it('accepts a good quad and rounds to 0.1°', () => {
    const skewed = quad.map((c, i) => (i === 1 ? { ...c, yaw: -10.06, pitch: 22.04 } : c));
    const clean = sanitizeArt({ ...good, art: [{ ...good.art[0], corners: skewed }] });
    expect(clean?.art[0]?.corners[1]).toMatchObject({ yaw: -10.1, pitch: 22 });
  });

  it('keeps the lean role and defaults missing/odd roles to wall', () => {
    // Files saved before lean areas existed carry no role at all.
    expect(sanitizeArt(good)?.art[0]?.role).toBe('wall');
    expect(sanitizeArt({ ...good, art: [{ ...good.art[0], role: 'lean' }] })?.art[0]?.role).toBe('lean');
    expect(sanitizeArt({ ...good, art: [{ ...good.art[0], role: 'ceiling' }] })?.art[0]?.role).toBe('wall');
  });

  it('allows an empty art list (a room with no canvases yet)', () => {
    expect(sanitizeArt({ room: 'cream-city', art: [] })?.art).toEqual([]);
  });

  it('rejects bad ids, duplicate ids and bad rooms', () => {
    expect(sanitizeArt({ room: 'cream-city', art: [{ ...good.art[0], id: 'A' }] })).toBeNull();
    expect(sanitizeArt({ room: 'cream-city', art: [good.art[0], good.art[0]] })).toBeNull();
    expect(sanitizeArt({ room: '../etc', art: [] })).toBeNull();
  });

  it('rejects quads that are not four corners, or spread over more than 120°', () => {
    expect(sanitizeArt({ room: 'cream-city', art: [{ ...good.art[0], corners: quad.slice(0, 3) }] })).toBeNull();
    const huge = [
      { yaw: -60, pitch: 20 },
      { yaw: 70, pitch: 20 },
      { yaw: 70, pitch: 4 },
      { yaw: -60, pitch: 4 }
    ];
    expect(sanitizeArt({ room: 'cream-city', art: [{ ...good.art[0], corners: huge }] })).toBeNull();
  });

  it('keeps a canvas that crosses the back seam (yaw ±180) as one quad', () => {
    // A 20°-wide canvas centered on the seam: left corners at 170°, right
    // corners at -170° (which is 190° unwrapped).
    const across = [
      { yaw: 170, pitch: 20 },
      { yaw: -170, pitch: 20 },
      { yaw: -170, pitch: 4 },
      { yaw: 170, pitch: 4 }
    ];
    const clean = sanitizeArt({ room: 'cream-city', art: [{ ...good.art[0], corners: across }] });
    expect(clean?.art[0]?.corners).toEqual([
      { yaw: 170, pitch: 20 },
      { yaw: -170, pitch: 20 },
      { yaw: -170, pitch: 4 },
      { yaw: 170, pitch: 4 }
    ]);
  });
});
