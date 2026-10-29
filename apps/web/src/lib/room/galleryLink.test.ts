import { describe, expect, it } from 'vitest';
import { decodeGallery, encodeGallery } from './galleryLink';

const gallery = {
  v: 1 as const,
  mode: 'walls-then-lean' as const,
  pieces: [
    { seed: 'piece-1', aspect: 0.66 },
    { seed: 'piece-2', aspect: 1.6 }
  ]
};

describe('gallery links', () => {
  it('round-trips an arrangement', () => {
    expect(decodeGallery(encodeGallery(gallery))).toEqual(gallery);
  });

  it('produces URL-safe fragments (no +, / or =)', () => {
    expect(encodeGallery(gallery)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns null for junk, wrong versions and bad shapes', () => {
    expect(decodeGallery('')).toBeNull();
    expect(decodeGallery('!!!')).toBeNull();
    expect(decodeGallery(encodeGallery({ ...gallery, mode: 'ceiling' as never }))).toBeNull();
    expect(decodeGallery(encodeGallery({ ...gallery, pieces: [] }))).toBeNull();
    // A link chopped in half is just broken, not half a gallery.
    const whole = encodeGallery(gallery);
    expect(decodeGallery(whole.slice(0, Math.floor(whole.length / 2)))).toBeNull();
  });
});
