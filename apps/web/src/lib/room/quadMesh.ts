// Painting one image onto an arbitrary quad with the 2D canvas API. The
// canvas has no perspective transform, so the quad is subdivided into a grid
// of small cells and each cell is drawn with a plain affine transform — the
// classic texture-mapping trick. With a fine enough grid the eye can't tell
// it from a true perspective map (and the pieces are small on screen anyway).
// Used by the gallery export, where CSS transforms are no longer available.

import { homography8, type Point } from './homography';

/** Affine transform mapping the unit square's (0,0), (1,0), (0,1) to p0, p1, p3. */
export function affineFromUnitSquare(p0: Point, p1: Point, p3: Point): [number, number, number, number, number, number] {
  return [p1.x - p0.x, p1.y - p0.y, p3.x - p0.x, p3.y - p0.y, p0.x, p0.y];
}

/** Apply a raw homography (homography8's h0…h7) to a point. */
export function applyH(h: number[], p: Point): Point {
  const w = h[6]! * p.x + h[7]! * p.y + 1;
  return { x: (h[0]! * p.x + h[1]! * p.y + h[2]!) / w, y: (h[3]! * p.x + h[4]! * p.y + h[5]!) / w };
}

const UNIT: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 }
];

/**
 * Draw `src` onto ctx so its corners land exactly on the four dst points
 * (top-left, top-right, bottom-right, bottom-left order). Each cell is grown
 * by a small skirt of source pixels so no hairline seams show between cells.
 */
export function paintQuadMesh(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource & { width: number; height: number },
  dst: Point[],
  grid = 12
): void {
  const h = homography8(UNIT, dst);
  if (!h) return; // degenerate quad — draw nothing rather than garbage

  const cell = 1 / grid;
  const skirt = 0.4; // source pixels of overlap per cell edge
  const skirtU = skirt / (cell * src.width); // the same overlap in unit-cell units
  const skirtV = skirt / (cell * src.height);
  ctx.imageSmoothingQuality = 'high';
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const u0 = i * cell;
      const v0 = j * cell;
      const a = applyH(h, { x: u0, y: v0 });
      const b = applyH(h, { x: u0 + cell, y: v0 });
      const d = applyH(h, { x: u0, y: v0 + cell });
      ctx.save();
      ctx.transform(...affineFromUnitSquare(a, b, d));
      ctx.drawImage(
        src,
        u0 * src.width - skirt,
        v0 * src.height - skirt,
        cell * src.width + skirt * 2,
        cell * src.height + skirt * 2,
        -skirtU,
        -skirtV,
        1 + skirtU * 2,
        1 + skirtV * 2
      );
      ctx.restore();
    }
  }
}
