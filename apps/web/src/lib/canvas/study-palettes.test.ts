import { describe, expect, it } from 'vitest';
import { PHOTO_PALETTES, STUDY_PALETTES } from './study-palettes';

describe('photo-based study palettes', () => {
  it('includes every visible bottle, well, pastel stick, and pencil', () => {
    // The acrylic filename says 24, but its photograph shows only 19 bottles.
    expect(STUDY_PALETTES.acrylic).toHaveLength(19);
    expect(STUDY_PALETTES.watercolor).toHaveLength(36);
    expect(STUDY_PALETTES.pastel).toHaveLength(40);
    expect(PHOTO_PALETTES.pencil).toHaveLength(9);
    expect(PHOTO_PALETTES.charcoal).toHaveLength(8);
  });

  it('extends pencils and charcoal without losing the photo colors, including a deep black', () => {
    expect(STUDY_PALETTES.pencil).toHaveLength(36);
    expect(STUDY_PALETTES.charcoal).toHaveLength(18);
    for (const medium of ['pencil', 'charcoal'] as const) {
      expect(STUDY_PALETTES[medium]).toEqual(expect.arrayContaining(PHOTO_PALETTES[medium]));
      const black = STUDY_PALETTES[medium].find(color => color.name === 'Deep black')!;
      expect(black).toBeDefined();
      expect(parseInt(black.hex.slice(1), 16)).toBeLessThan(0x101010);
    }
  });

  it('gives every selectable color a unique accessible name and valid color', () => {
    for (const colors of Object.values(STUDY_PALETTES)) {
      expect(new Set(colors.map(color => color.name)).size).toBe(colors.length);
      for (const color of colors) {
        expect(color.name.trim().length).toBeGreaterThan(0);
        expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(STUDY_PALETTES.acrylic).not.toEqual(STUDY_PALETTES.watercolor);
  });
});
