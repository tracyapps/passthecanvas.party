// Turn gallery placements into paintings for ArtLayer. Shared by the party
// gallery and the room tool (?seats=), so the tool previews artwork exactly
// as a finished party will hang it.

import type { Hang } from './ArtLayer.svelte';
import type { GalleryPiece, Placement } from './leanLayout';
import { paintPlaceholder } from './placeholderArt';

/** One painting per placement, pixel-sized from the quad it lands on. */
export function hangsFor(placements: Placement[], pieces: GalleryPiece[], images: Record<string, HTMLImageElement> = {}): Hang[] {
  return placements.map((p) => {
    const ys = p.quad.map((c) => c.yaw);
    const ps = p.quad.map((c) => c.pitch);
    const wDeg = Math.max(...ys) - Math.min(...ys);
    const hDeg = Math.max(...ps) - Math.min(...ps);
    // 24 px per degree keeps pieces crisp up close; guards keep one bad
    // quad from taking the layer down.
    const w = Number.isFinite(wDeg) ? Math.min(1024, Math.max(48, Math.round(wDeg * 24))) : 48;
    const h = Number.isFinite(hDeg) ? Math.min(1024, Math.max(48, Math.round(hDeg * 24))) : 48;
    const painting = document.createElement('canvas');
    painting.width = w;
    painting.height = h;
    const piece = pieces[p.pieceIndex]!;
    const image = piece.url ? images[piece.url] : undefined;
    if (piece.url) {
      // A real piece: fit it whole on a primed canvas, never stretched to the
      // wall's shape (plain primed canvas while it is still loading).
      const ctx = painting.getContext('2d')!;
      ctx.fillStyle = '#e1dfda';
      ctx.fillRect(0, 0, w, h);
      if (image) {
        const fit = Math.min(w / image.naturalWidth, h / image.naturalHeight);
        const dw = image.naturalWidth * fit;
        const dh = image.naturalHeight * fit;
        ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
    } else paintPlaceholder(painting, piece.seed);
    return { id: `${p.regionId}#${p.pieceIndex}`, corners: p.quad, painting } satisfies Hang;
  });
}
