import { describe, expect, it } from 'vitest';
import { anglesFrom, directionFrom, moveAlongCenter, placeFromView, sanitizeGeometry, spotsForView, triangulate, type SeatGeometry, type ViewCamera } from './views';

// A camera at the origin looking along +x, with +y to its left (so right = -y), z up.
const center: ViewCamera = { eye: [0, 0, 1.5], forward: [1, 0, 0], right: [0, -1, 0], up: [0, 0, 1] };
const seat: ViewCamera = { eye: [4, -3, 1.2], forward: [-0.8, 0.6, 0], right: [0.6, 0.8, 0], up: [0, 0, 1] };

describe('seat view math', () => {
  it('turns points into yaw/pitch and back', () => {
    expect(anglesFrom(center, [5, 0, 1.5])).toEqual({ yaw: 0, pitch: 0 });
    expect(anglesFrom(center, [0, -5, 1.5])).toEqual({ yaw: 90, pitch: 0 });
    const d = directionFrom(center, 30, -10);
    const back = anglesFrom(center, [d[0] * 3, d[1] * 3, 1.5 + d[2] * 3]);
    expect(back).toEqual({ yaw: 30, pitch: -10 });
  });

  it('finds the seat where the middle-of-room ray and a seat-view ray meet', () => {
    const target: [number, number, number] = [3, 1, 1.1];
    const fromCenter = { origin: center.eye, dir: directionFrom(center, anglesFrom(center, target).yaw, anglesFrom(center, target).pitch) };
    const fromSeat = { origin: seat.eye, dir: directionFrom(seat, anglesFrom(seat, target).yaw, anglesFrom(seat, target).pitch) };
    const found = triangulate(fromCenter, fromSeat)!;
    found.forEach((v, i) => expect(v).toBeCloseTo(target[i]!, 1));
  });

  it('re-aims every other seat for a view, leaving out hidden ones and the seat itself', () => {
    const geometry: SeatGeometry = { room: 'test', center, views: { spot_a: { ...seat, hidden: ['spot_c'] } }, markers: { spot_a: [4, -3, 1.2], spot_b: [3, 1, 1.1], spot_c: [1, 1, 1] } };
    const spots = ['spot_a', 'spot_b', 'spot_c'].map((id) => ({ id, zone: 'z', label: id, yaw: 0, pitch: 0 }));
    const out = spotsForView(geometry, 'spot_a', spots);
    expect(out.map((s) => s.id)).toEqual(['spot_b']);
    expect(out[0]).toMatchObject(anglesFrom(seat, [3, 1, 1.1]));
    const moved = moveAlongCenter(geometry, 'spot_b', 0, 0)!;
    expect(moved[1]).toBeCloseTo(0, 5);
  });

  it('places a marker from a seat view where you clicked, keeping the middle view close', () => {
    const geometry: SeatGeometry = { room: 'test', center, views: { spot_a: { ...seat, hidden: [] } }, markers: { spot_b: [3, 1, 1.1] } };
    const target: [number, number, number] = [3, 1.3, 1.1]; // a little off from the old marker
    const fromCenter = anglesFrom(center, target);
    const clicked = anglesFrom(seat, target);
    const placed = placeFromView(geometry, 'spot_a', { id: 'spot_b', ...fromCenter }, clicked.yaw, clicked.pitch)!;
    placed.marker.forEach((v, i) => expect(v).toBeCloseTo(target[i]!, 1));
    expect(anglesFrom(seat, placed.marker)).toEqual(clicked);
    expect(Math.abs(placed.yaw - fromCenter.yaw)).toBeLessThan(0.5);
    const middle = placeFromView(geometry, 'center', { id: 'spot_b', yaw: 0, pitch: 0 }, 10, -5)!;
    expect(anglesFrom(center, middle.marker)).toEqual({ yaw: 10, pitch: -5 });
  });

  it('refuses junk geometry', () => {
    expect(sanitizeGeometry({ room: 'x' })).toBeNull();
    expect(sanitizeGeometry({ room: 'test', center, views: {}, markers: { 'bad id': [0, 0, 0] } })).toBeNull();
    expect(sanitizeGeometry({ room: 'test', center, views: {}, markers: {} })).not.toBeNull();
  });
});
