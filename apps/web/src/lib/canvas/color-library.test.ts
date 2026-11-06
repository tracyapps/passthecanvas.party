import { describe, expect, it } from 'vitest';
import { cleanPreferences } from '@ptc/shared';
import { BUILT_IN_PALETTES, colorLibrary, importPalette } from './color-library';

describe('color palette preferences', () => {
  it('keeps an artist’s edits to a preset and drops malformed palettes', () => {
    const preset = { ...BUILT_IN_PALETTES[0], name: 'My earth colors', hidden: true, favorite: true };
    const saved = cleanPreferences({ toolView: 'grid', colorPalettes: [preset, { id: 'bad', name: 'Bad', colors: [{}] }] });
    expect(saved.toolView).toBe('grid');
    expect(saved.colorPalettes).toEqual([preset]);
    expect(colorLibrary(saved.colorPalettes)).toHaveLength(BUILT_IN_PALETTES.length);
    expect(colorLibrary(saved.colorPalettes)[0]).toEqual(preset);
  });

  it('imports an independent palette with normalized swatches', () => {
    const file = { format: 'ptc-color-palette', version: 1, id: 'studio-earth', hidden: true, name: 'Imported', colors: [{ name: ' Chalk ', hex: '#ABCDEF' }] };
    const palette = importPalette(JSON.stringify(file));
    expect(palette?.id).not.toBe(file.id);
    expect(palette).toMatchObject({ name: 'Imported', hidden: false, colors: [{ name: 'Chalk', hex: '#abcdef' }] });
    expect(importPalette(JSON.stringify({ ...file, version: 2 }))).toBeNull();
    expect(importPalette(JSON.stringify({ ...file, colors: [{ name: 'Invalid', hex: 'url(test)' }] }))).toBeNull();
  });
});
