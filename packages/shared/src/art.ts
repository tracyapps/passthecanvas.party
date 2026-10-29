// Wall art regions: the blank canvases hanging in a 360° room, drawn with the
// art editor (?art=<room>). A region is a quad with four corner points — the
// flattened panorama skews canvases, so each corner is placed on its own.
// The party feature that hangs real artwork on them is not built yet; this
// file only describes where each canvas hangs, so both server and web
// validate the same way.

export interface ArtCorner {
  yaw: number; // degrees, 0 = straight ahead (image center)
  pitch: number; // degrees, negative = lower on the wall
}

export interface ArtRegion {
  id: string; // e.g. "art_brick_wall_left"
  label: string; // e.g. "Brick wall, left of the shelves"
  /** Corner points in viewing order: top-left, top-right, bottom-right, bottom-left. */
  corners: [ArtCorner, ArtCorner, ArtCorner, ArtCorner];
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
    const { id, label, corners } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || !SAFE_ID.test(id)) return null;
    if (seenIds.has(id)) return null; // duplicate ids would confuse placement
    seenIds.add(id);
    if (typeof label !== 'string' || label.trim() === '' || label.length > 60) return null;
    if (!Array.isArray(corners) || corners.length !== 4) return null;

    // Unwrap every corner into the first corner's wrap lane, so a canvas
    // that crosses the back seam (yaw ±180) stays one connected quad. The
    // extent check below then doubles as the sanity bound.
    const anchor = Number((corners[0] as Record<string, unknown> | null)?.yaw);
    if (!Number.isFinite(anchor)) return null;
    const pts: ArtCorner[] = [];
    for (const corner of corners) {
      if (!corner || typeof corner !== 'object') return null;
      const { yaw, pitch } = corner as Record<string, unknown>;
      const y = Number(yaw);
      const p = Number(pitch);
      if (!Number.isFinite(y) || !Number.isFinite(p)) return null;
      pts.push({ yaw: y + 360 * Math.round((anchor - y) / 360), pitch: clamp(p, -90, 90) });
    }
    const yaws = pts.map((c) => c.yaw);
    const pitches = pts.map((c) => c.pitch);
    // A canvas covers at most 120° of wall — not half the room.
    if (Math.max(...yaws) - Math.min(...yaws) > 120) return null;
    if (Math.max(...pitches) - Math.min(...pitches) > 120) return null;

    clean.push({
      id,
      label: label.trim().slice(0, 60),
      corners: pts.map((c) => ({ yaw: round1(wrap180(c.yaw)), pitch: round1(c.pitch) })) as ArtRegion['corners']
    });
  }
  return { room, art: clean };
}

function wrap180(yaw: number) {
  return (((yaw + 180) % 360) + 360) % 360 - 180;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
