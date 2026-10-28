import { describe, expect, it } from 'vitest';
import { sanitizeArt } from './art.js';

const good = { room: 'cream-city', art: [{ id: 'art_brick', label: 'Brick wall', yaw: 30, pitch: 5, yawSpan: 24, pitchSpan: 16 }] };

describe('sanitizeArt', () => {
  it('accepts a good file and rounds to 0.1°', () => {
    const clean = sanitizeArt({ ...good, art: [{ ...good.art[0], yaw: 30.06, pitchSpan: 16.04 }] });
    expect(clean?.art[0]).toMatchObject({ yaw: 30.1, pitchSpan: 16 });
  });

  it('allows an empty art list (a room with no canvases yet)', () => {
    expect(sanitizeArt({ room: 'cream-city', art: [] })?.art).toEqual([]);
  });

  it('rejects bad ids, duplicate ids and bad rooms', () => {
    expect(sanitizeArt({ room: 'cream-city', art: [{ ...good.art[0], id: 'A' }] })).toBeNull();
    expect(sanitizeArt({ room: 'cream-city', art: [good.art[0], good.art[0]] })).toBeNull();
    expect(sanitizeArt({ room: '../etc', art: [] })).toBeNull();
  });

  it('clamps spans into the 2–120° range', () => {
    const clean = sanitizeArt({ room: 'cream-city', art: [{ ...good.art[0], yawSpan: 400, pitchSpan: 0 }] });
    expect(clean?.art[0]).toMatchObject({ yawSpan: 120, pitchSpan: 2 });
  });
});
