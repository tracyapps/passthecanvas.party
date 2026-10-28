import { describe, expect, it } from 'vitest';
import { sanitizeSpots } from './spots';

const good = {
  room: 'cream-city',
  spots: [{ id: 'spot_couch_left', zone: 'couch', label: 'Couch, left cushion', yaw: -40, pitch: -12.5 }]
};

describe('sanitizeSpots', () => {
  it('accepts a clean file and keeps the values', () => {
    expect(sanitizeSpots(good)).toEqual(good);
  });

  it('rounds coordinates to one decimal and clamps them into range', () => {
    const out = sanitizeSpots({
      room: 'loft',
      spots: [{ id: 'aa', zone: 'z', label: 'A', yaw: 999.123, pitch: -999.94 }]
    });
    expect(out?.spots[0]).toEqual({ id: 'aa', zone: 'z', label: 'A', yaw: 180, pitch: -90 });
  });

  it('rejects a room name that could escape the folder', () => {
    expect(sanitizeSpots({ ...good, room: '../evil' })).toBeNull();
    expect(sanitizeSpots({ ...good, room: 'UPPER' })).toBeNull();
  });

  it('rejects duplicate ids and empty spot lists', () => {
    expect(sanitizeSpots({ room: 'loft', spots: [...good.spots, ...good.spots] })).toBeNull();
    expect(sanitizeSpots({ room: 'loft', spots: [] })).toBeNull();
  });

  it('rejects junk instead of returning a half-clean file', () => {
    expect(sanitizeSpots(null)).toBeNull();
    expect(sanitizeSpots({ room: 'loft', spots: [{ id: 'aa', label: 'x' }] })).toBeNull(); // no yaw/pitch
  });
});
