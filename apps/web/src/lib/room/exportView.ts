// The gallery export: compose what you see — panorama plus every hanging
// piece — into one flat PNG, the first draft of the "social-ready photo".
// The room itself renders on a WebGL canvas inside Photo Sphere Viewer; we
// try to copy that directly. Browsers that clear the WebGL buffer between
// frames (the default) hand us a blank copy, which we detect and fall back
// from: re-project the panorama per pixel through the viewer's own inverse
// mapping, at half resolution, then paint the pieces on top with quadMesh.

import type { Viewer } from '@photo-sphere-viewer/core';
import { paintQuadMesh } from './quadMesh';
import type { Point } from './homography';

export interface ExportPiece {
  painting: HTMLCanvasElement;
  pts: Point[]; // screen corners of the piece, in viewer pixels
}

export async function renderCurrentView(
  viewer: Viewer,
  container: HTMLElement,
  pano: HTMLImageElement | null,
  pieces: ExportPiece[]
): Promise<HTMLCanvasElement> {
  // Let the current frame finish drawing before we try to copy it.
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  const w = Math.max(2, container.clientWidth);
  const h = Math.max(2, container.clientHeight);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return out;

  if (!copyViewerCanvas(ctx, container, w, h)) {
    await renderPanorama(ctx, viewer, pano, w, h);
  }
  for (const piece of pieces) {
    if (piece.pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) continue;
    paintQuadMesh(ctx, piece.painting, piece.pts);
  }
  return out;
}

/** Try to copy the viewer's own canvas; true when the copy has real pixels. */
function copyViewerCanvas(ctx: CanvasRenderingContext2D, container: HTMLElement, w: number, h: number): boolean {
  const src = container.querySelector('canvas');
  if (!src) return false;
  try {
    ctx.drawImage(src, 0, 0, w, h);
    // A cleared WebGL buffer copies as fully transparent — detect that.
    const strip = ctx.getImageData(0, 0, w, Math.min(h, 32)).data;
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let i = 0; i < strip.length; i += 4) {
      const v = strip[i]! + strip[i + 1]! + strip[i + 2]! + strip[i + 3]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
    return n > 0 && sumSq / n - (sum / n) ** 2 > 1;
  } catch {
    return false;
  }
}

/** Fallback background: sample the panorama per pixel through the viewer's mapping. */
async function renderPanorama(ctx: CanvasRenderingContext2D, viewer: Viewer, pano: HTMLImageElement | null, w: number, h: number) {
  ctx.fillStyle = '#24100b';
  ctx.fillRect(0, 0, w, h);
  if (!pano || !pano.naturalWidth) return; // no image loaded: plain backdrop

  // Work at half resolution (it gets smoothed back up), sampling from a
  // downscaled copy of the panorama so ImageData stays a sane size.
  const lw = Math.max(2, Math.round(w / 2));
  const lh = Math.max(2, Math.round(h / 2));
  const pw = Math.min(pano.naturalWidth, 3072);
  const ph = Math.max(2, Math.round((pw * pano.naturalHeight) / pano.naturalWidth));
  const panoCopy = document.createElement('canvas');
  panoCopy.width = pw;
  panoCopy.height = ph;
  const pctx = panoCopy.getContext('2d');
  if (!pctx) return;
  pctx.drawImage(pano, 0, 0, pw, ph);
  const pdata = pctx.getImageData(0, 0, pw, ph).data;

  const low = document.createElement('canvas');
  low.width = lw;
  low.height = lh;
  const lctx = low.getContext('2d');
  if (!lctx) return;
  const img = lctx.createImageData(lw, lh);
  const data = img.data;
  const helper = viewer.dataHelper;

  let i = 0;
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      // Viewer pixels → sphere direction. Yaw 0 is the image's horizontal
      // center; pitch +90° the top.
      const coords = helper.viewerCoordsToSphericalCoords({ x: (x + 0.5) * 2, y: (y + 0.5) * 2 });
      const u = (((coords.yaw / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
      const v = Math.min(0.99999, Math.max(0, 0.5 - coords.pitch / Math.PI));
      sampleBilinear(pdata, pw, ph, u, v, data, i);
      data[i + 3] = 255;
      i += 4;
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(low, 0, 0, w, h);
}

/** Bilinear sample of an equirectangular RGBA buffer into `out` at byte offset. */
function sampleBilinear(src: Uint8ClampedArray, pw: number, ph: number, u: number, v: number, out: Uint8ClampedArray, outAt: number) {
  const fx = u * pw - 0.5;
  const fy = v * ph - 0.5;
  const x0 = Math.max(0, Math.min(pw - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(ph - 1, Math.floor(fy)));
  const x1 = Math.min(pw - 1, x0 + 1);
  const y1 = Math.min(ph - 1, y0 + 1);
  const dx = fx - x0;
  const dy = fy - y0;
  for (let c = 0; c < 3; c++) {
    const top = src[(y0 * pw + x0) * 4 + c]! * (1 - dx) + src[(y0 * pw + x1) * 4 + c]! * dx;
    const bottom = src[(y1 * pw + x0) * 4 + c]! * (1 - dx) + src[(y1 * pw + x1) * 4 + c]! * dx;
    out[outAt + c] = top * (1 - dy) + bottom * dy;
  }
}
