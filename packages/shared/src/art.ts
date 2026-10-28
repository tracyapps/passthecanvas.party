// Wall art regions: the blank canvases hanging in a 360° room, drawn with the
// art editor (?art=<room>). The party feature that hangs real artwork on them
// is not built yet — this file only describes where each canvas hangs and how
// big it is, so both server and web validate the same way.

export interface ArtRegion {
  id: string; // e.g. "art_brick_wall_left"
  label: string; // e.g. "Brick wall, left of the shelves"
  yaw: number; // degrees, center of the canvas (0 = straight ahead)
  pitch: number; // degrees, center of the canvas (negative = lower on the wall)
  yawSpan: number; // degrees wide the canvas appears from the room's center
  pitchSpan: number; // degrees tall the canvas appears from the room's center
}

export interface ArtFile {
  room: string; // folder name under public/studio/, e.g. "cream-city"
  art: ArtRegion[];
}

const MAX_ART = 32;
const SAFE_ROOM = /^[a-z0-9-]{2,20}$/;
const SAFE_ID = /^[a-z0-9_]{2,60}$/;

/**
 * Validate and clean an art file coming from the editor or the network.
 * Returns null (not a partial object) when anything structural is wrong, so
 * a bad save can never write half-junk over a good file.
 */
export function sanitizeArt(input: unknown): ArtFile | null {
  if (!input || typeof input !== 'object') return null;
  const { room, art } = input as { room?: unknown; art?: unknown };
  if (typeof room !== 'string' || !SAFE_ROOM.test(room)) return null;
  if (!Array.isArray(art) || art.length > MAX_ART) return null;

  const seenIds = new Set<string>();
  const clean: ArtRegion[] = [];
  for (const raw of art) {
    if (!raw || typeof raw !== 'object') return null;
    const { id, label, yaw, pitch, yawSpan, pitchSpan } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || !SAFE_ID.test(id)) return null;
    if (seenIds.has(id)) return null; // duplicate ids would confuse placement
    seenIds.add(id);
    if (typeof label !== 'string' || label.trim() === '' || label.length > 60) return null;
    const region: ArtRegion = {
      id,
      label: label.trim().slice(0, 60),
      yaw: round1(clamp(Number(yaw), -180, 180)),
      pitch: round1(clamp(Number(pitch), -90, 90)),
      // Spans of 2–120° keep a region canvas-sized, not "half the room".
      yawSpan: round1(clamp(Number(yawSpan), 2, 120)),
      pitchSpan: round1(clamp(Number(pitchSpan), 2, 120))
    };
    for (const n of [region.yaw, region.pitch, region.yawSpan, region.pitchSpan]) {
      if (!Number.isFinite(n)) return null;
    }
    clean.push(region);
  }
  return { room, art: clean };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
