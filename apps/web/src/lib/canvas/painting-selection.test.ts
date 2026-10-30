import { describe, expect, it } from 'vitest';
import { emptySelection, selectTool, loadPaint, dipInWater, canPaint, unavailability, type PaintLoad } from './painting-selection';

const blue: PaintLoad = { medium: 'watercolor', name: 'Ultramarine', colors: ['#2c3f9e'] };
const acrylic: PaintLoad = { medium: 'acrylic', name: 'Sap green', colors: ['#4f7a2a'] };

describe('photographic workspace selection', () => {
  it('starts with no tool or paint and cannot mark until both have been selected', () => {
    const initial = emptySelection();
    expect(canPaint(initial)).toBe(false);
    const brush = selectTool(initial, 'flat');
    expect(brush.load).toBeNull();
    expect(canPaint(brush)).toBe(false);
    expect(canPaint(loadPaint(brush, acrylic))).toBe(true);
  });

  it('preserves compatible paint across brushes but never converts watercolor for a knife', () => {
    const loaded = loadPaint(selectTool(emptySelection(), 'flat'), blue);
    expect(selectTool(loaded, 'round').load).toEqual(blue);
    const knife = selectTool(loaded, 'knife');
    expect(knife.load).toBeNull();
    expect(canPaint(knife)).toBe(false);
    expect(loadPaint(knife, blue)).toEqual(knife);
    expect(unavailability('knife', 'watercolor')).toContain('acrylic');
    expect(selectTool(knife, 'flat').load).toEqual(blue);
  });

  it('makes eraser, dry sponge and burnisher standalone without discarding remembered paint', () => {
    const loaded = loadPaint(selectTool(emptySelection(), 'flat'), acrylic);
    for (const tool of ['eraser', 'sponge', 'burnisher'] as const) {
      const standalone = selectTool(loaded, tool);
      expect(canPaint(standalone)).toBe(true);
      expect(standalone.load).toBeNull();
      expect(loadPaint(standalone, acrylic)).toEqual(standalone);
      expect(selectTool(standalone, 'round').load).toEqual(acrylic);
    }
  });

  it('allows a clean wet brush without a color and preserves a multicolor load', () => {
    const brush = selectTool(emptySelection(), 'flat');
    expect(canPaint(dipInWater(brush))).toBe(true);
    const striped = { ...acrylic, name: 'Blue and green', colors: ['#2c3f9e', '#4f7a2a'] };
    expect(loadPaint(brush, striped).load).toEqual(striped);
    expect(dipInWater(selectTool(emptySelection(), 'knife')).wet).toBe(false);
  });
});
