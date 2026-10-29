// How finished pieces spread across a room's art regions.
//   Wall regions hang exactly one piece, sized to the quad.
//   Lean regions (freeform floor/furniture areas) hold as many pieces as fit:
// the area's shape decides — two skinny tall canvases side by side in front
// of the boombox, but only one landscape canvas in the same spot.
// Pure math on quad corners (yaw/pitch degrees), so it is unit-tested and
// identical on every screen.

import type { ArtCorner, ArtRegion } from '@ptc/shared';

export type HangMode = 'walls-then-lean' | 'walls' | 'lean';

export interface GalleryPiece {
  seed: string; // which painting this is (also the placeholder generator's seed)
  aspect: number; // width ÷ height of the painted piece
}

/** One piece placed in the room: which region, which slice of it, which piece. */
export interface Placement {
  regionId: string;
  regionLabel: string;
  role: 'wall' | 'lean';
  quad: ArtCorner[]; // the exact corners this piece occupies (a sub-quad for lean)
  pieceIndex: number;
}

/** Average angular width ÷ height of a quad, unwrapped around the back seam. */
export function areaAspect(corners: ArtCorner[]): number {
  const anchor = corners[0]!.yaw;
  const unwrap = (yaw: number) => yaw + 360 * Math.round((anchor - yaw) / 360);
  const [tl, tr, , bl] = corners;
  const top = Math.abs(unwrap(tr!.yaw) - unwrap(tl!.yaw));
  const bottom = Math.abs(unwrap(corners[2]!.yaw) - unwrap(bl!.yaw));
  const width = (top + bottom) / 2;
  const height = Math.abs((tl!.pitch + tr!.pitch) / 2 - (bl!.pitch + corners[2]!.pitch) / 2);
  return height > 0.01 ? width / height : 1;
}

/**
 * How many pieces of `pieceAspect` stand in a lean area of `areaAspect`:
 * columns of roughly the piece's own shape. A 2:1 area fits two tall
 * (1:1.5) canvases; a landscape canvas takes the whole area.
 */
export function leanColumns(areaAspect: number, pieceAspect: number): number {
  if (!Number.isFinite(areaAspect) || !Number.isFinite(pieceAspect) || pieceAspect <= 0) return 1;
  return Math.max(1, Math.min(4, Math.floor(areaAspect / pieceAspect + 0.15)));
}

/** A horizontal slice of a quad, keeping its warp: corners lerp along the edges. */
export function subQuad(corners: ArtCorner[], u0: number, u1: number): ArtCorner[] {
  const [tl, tr, br, bl] = corners;
  const lerp = (a: ArtCorner, b: ArtCorner, t: number): ArtCorner => ({
    yaw: a.yaw + (b.yaw - a.yaw) * t,
    pitch: a.pitch + (b.pitch - a.pitch) * t
  });
  return [
    lerp(tl!, tr!, u0),
    lerp(tl!, tr!, u1),
    lerp(bl!, br!, u1),
    lerp(bl!, br!, u0)
  ];
}

const LEAN_INSET = 0.07; // pieces stand a little apart inside a lean area

/**
 * Decide where every piece goes. Walls fill first (one per wall region, in
 * art.json order); leftover pieces flow into lean areas, packed by shape.
 * Pieces that run out of regions are dropped — the room only has so many spots.
 */
export function planGallery(art: ArtRegion[], pieces: GalleryPiece[], mode: HangMode): Placement[] {
  const walls = art.filter((r) => r.role !== 'lean');
  const leans = art.filter((r) => r.role === 'lean');
  const placements: Placement[] = [];

  const wallBudget = mode === 'lean' ? 0 : Math.min(walls.length, pieces.length);
  for (let i = 0; i < wallBudget && i < pieces.length; i++) {
    placements.push({
      regionId: walls[i]!.id,
      regionLabel: walls[i]!.label,
      role: 'wall',
      quad: walls[i]!.corners,
      pieceIndex: i
    });
  }

  let next = wallBudget;
  if (mode !== 'walls') {
    for (const area of leans) {
      if (next >= pieces.length) break;
      const aspect = areaAspect(area.corners);
      const count = leanColumns(aspect, pieces[next]!.aspect);
      const usable = 1 - LEAN_INSET * 2;
      for (let slot = 0; slot < count && next < pieces.length; slot++) {
        const u0 = LEAN_INSET + (usable * slot) / count + usable * 0.03;
        const u1 = LEAN_INSET + (usable * (slot + 1)) / count - usable * 0.03;
        placements.push({
          regionId: area.id,
          regionLabel: area.label,
          role: 'lean',
          quad: subQuad(area.corners, u0, u1),
          pieceIndex: next
        });
        next++;
      }
    }
  }
  return placements;
}
