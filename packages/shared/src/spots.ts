// Spots: the named seats and props in a 360° room, exported from Blender or
// edited with the spots editor (?spots=<room>). Shared by server + web so
// both sides validate the same way.

export interface Spot {
  id: string; // e.g. "spot_couch_left"
  zone: string; // e.g. "couch" — groups spots for the jump list
  label: string; // e.g. "Couch, left cushion" — spoken in the jump list
  yaw: number; // degrees, 0 = straight ahead (image center)
  pitch: number; // degrees, negative = looking down
}

export interface SpotsFile {
  room: string; // folder name under public/studio/, e.g. "cream-city"
  spots: Spot[];
}

const MAX_SPOTS = 64;
const SAFE_ROOM = /^[a-z0-9-]{2,20}$/;
const SAFE_ID = /^[a-z0-9_]{2,60}$/;

/**
 * Validate and clean a spots file coming from the editor or the network.
 * Returns null (not a partial object) when anything structural is wrong, so
 * a bad save can never write half-junk over a good file.
 */
export function sanitizeSpots(input: unknown): SpotsFile | null {
  if (!input || typeof input !== 'object') return null;
  const { room, spots } = input as { room?: unknown; spots?: unknown };
  if (typeof room !== 'string' || !SAFE_ROOM.test(room)) return null;
  if (!Array.isArray(spots) || spots.length === 0 || spots.length > MAX_SPOTS) return null;

  const seenIds = new Set<string>();
  const clean: Spot[] = [];
  for (const raw of spots) {
    if (!raw || typeof raw !== 'object') return null;
    const { id, zone, label, yaw, pitch } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || !SAFE_ID.test(id)) return null;
    if (seenIds.has(id)) return null; // duplicate ids would confuse the markers
    seenIds.add(id);
    if (typeof label !== 'string' || label.trim() === '' || label.length > 60) return null;
    const cleanSpot: Spot = {
      id,
      zone: typeof zone === 'string' && zone.trim() !== '' ? zone.trim().slice(0, 30) : 'general',
      label: label.trim().slice(0, 60),
      yaw: round1(clamp(Number(yaw), -180, 180)),
      pitch: round1(clamp(Number(pitch), -90, 90))
    };
    if (!Number.isFinite(cleanSpot.yaw) || !Number.isFinite(cleanSpot.pitch)) return null;
    clean.push(cleanSpot);
  }
  return { room, spots: clean };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
