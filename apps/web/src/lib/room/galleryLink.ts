// Shareable gallery links. A finished party's arrangement (which pieces, how
// many, which hang mode) is serialized into the URL's #g= fragment —
// base64url of a tiny JSON blob. The link is self-contained: no server
// storage, nothing to clean up, and it keeps working as long as the page
// and the room's art.json exist. When parties become real, saved rooms can
// move server-side; the shape stays the same.

import type { HangMode } from './leanLayout';

export interface GalleryData {
  v: 1;
  mode: HangMode;
  pieces: { seed: string; aspect: number }[];
}

/** Serialize gallery data to the short URL-safe string that goes after #g=. */
export function encodeGallery(data: GalleryData): string {
  const json = JSON.stringify(data);
  // btoa is latin1; our payloads are ASCII (ids and numbers), but escape
  // anything unexpected just in case.
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Parse a #g= payload. Returns null for anything that isn't a gallery. */
export function decodeGallery(encoded: string): GalleryData | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (parsed.v !== 1) return null;
    const modes = ['walls-then-lean', 'walls', 'lean'];
    if (typeof parsed.mode !== 'string' || !modes.includes(parsed.mode)) return null;
    if (!Array.isArray(parsed.pieces) || parsed.pieces.length === 0 || parsed.pieces.length > 32) return null;
    const pieces = parsed.pieces.map((p) => {
      const piece = p as Record<string, unknown>;
      const seed = typeof piece.seed === 'string' ? piece.seed.slice(0, 40) : '';
      const aspect = Number(piece.aspect);
      return { seed, aspect: Number.isFinite(aspect) && aspect > 0 ? Math.min(aspect, 4) : 1 };
    });
    if (pieces.some((p) => p.seed === '')) return null;
    return { v: 1, mode: parsed.mode as HangMode, pieces };
  } catch {
    return null; // any malformed link just means "no gallery"
  }
}

/** The full shareable URL for a gallery arrangement of a room. */
export function galleryUrl(room: string, data: GalleryData): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}?gallery=${encodeURIComponent(room)}#g=${encodeGallery(data)}`;
}
