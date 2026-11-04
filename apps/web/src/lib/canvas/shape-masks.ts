/**
 * Click by shape, not by box. Each supply photo is boiled down once to a small
 * see-through/solid map (its outline). A click picks the topmost supply whose
 * outline is under the pointer, so the empty corners of a photo never steal a
 * click, and none of the object itself is a dead zone.
 *
 * Masks work in fractions of the photo (0–1 across and down), so they stay
 * right at any size: window resizes, the interface size setting, or a future
 * "icon size" slider. Nothing needs rebuilding when sizes change.
 */
export interface ShapeMask { width: number; height: number; solid: Uint8Array }

/** A small mask of where an image is painted (alpha above `threshold`). */
export async function buildMask(url: string, aspect: number, size = 128, threshold = 40): Promise<ShapeMask | null> {
  if (typeof document === 'undefined' || !url) return null;
  const image = new Image();
  image.src = url;
  try { await image.decode(); } catch { return null; }
  const width = aspect >= 1 ? size : Math.max(8, Math.round(size * aspect));
  const height = aspect >= 1 ? Math.max(8, Math.round(size / aspect)) : size;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  // Drawn stretched to the box, the same way the photo is shown (object-fit: fill).
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < solid.length; i++) solid[i] = pixels[i * 4 + 3]! > threshold ? 1 : 0;
  canvas.width = canvas.height = 0;
  return { width, height, solid };
}

/**
 * Is (u, v), in fractions of the photo, on the object? `reach` adds a little
 * forgiveness around the edge (as a fraction of the photo's size), so a near
 * miss on a thin brush handle still counts.
 */
export function maskHit(mask: ShapeMask, u: number, v: number, reach = 0.015): boolean {
  if (u < 0 || v < 0 || u > 1 || v > 1) return false;
  const cx = Math.min(mask.width - 1, Math.floor(u * mask.width));
  const cy = Math.min(mask.height - 1, Math.floor(v * mask.height));
  const r = Math.max(0, Math.round(reach * Math.max(mask.width, mask.height)));
  for (let y = Math.max(0, cy - r); y <= Math.min(mask.height - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(mask.width - 1, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && mask.solid[y * mask.width + x]) return true;
    }
  }
  return false;
}
