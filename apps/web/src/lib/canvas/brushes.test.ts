import { describe, expect, it } from 'vitest';
import { drawMark, stampSpacing } from './brushes';
import { emptySelection, selectTool, loadPaint, dipInWater, type PaintingTool, type PaintingSelection } from './painting-selection';

// Record the renderer's public canvas operations, including restored paint state.
// Pixel appearance is reviewed in the browser; these checks protect layer and flow rules.
function recordingCanvas() {
  const marks: { method: string; args: unknown[]; alpha: number; operation: string }[] = [];
  const stack: { alpha: number; operation: string }[] = [];
  const canvas = { width: 1600, height: 850 };
  const context = {
    canvas, globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '' as unknown,
    save() { stack.push({ alpha: this.globalAlpha, operation: this.globalCompositeOperation }); },
    restore() { const state = stack.pop()!; this.globalAlpha = state.alpha; this.globalCompositeOperation = state.operation; },
    createRadialGradient(...args: number[]) {
      marks.push({ method: 'gradient', args, alpha: this.globalAlpha, operation: this.globalCompositeOperation });
      return { addColorStop(offset: number, color: string) { marks.push({ method: 'color', args: [offset, color], alpha: 1, operation: '' }); } };
    }
  };
  for (const method of ['translate', 'rotate', 'scale', 'beginPath', 'moveTo', 'arc', 'rect', 'clip', 'fill', 'fillRect', 'drawImage']) {
    Object.assign(context, { [method](...args: unknown[]) {
      marks.push({ method, args, alpha: context.globalAlpha, operation: context.globalCompositeOperation });
    } });
  }
  return { ctx: context as unknown as CanvasRenderingContext2D, marks, canvas };
}

function loaded(tool: PaintingTool, medium: 'acrylic' | 'watercolor' = 'acrylic'): PaintingSelection {
  return loadPaint(selectTool(emptySelection(), tool), { medium, name: 'Blue', colors: ['#1234ab'] });
}
const point = { x: 120, y: 80, pressure: 0.5 };

function render(selection: PaintingSelection, stamp = 7, intensity?: number) {
  const recording = recordingCanvas();
  drawMark(recording.ctx, selection, 30, point, 0.4, stamp, intensity);
  return recording;
}

describe('brush marks', () => {
  it('scales airbrush and burnisher strength without changing their footprint or default feel', () => {
    for (const selection of [loaded('airbrush'), selectTool(emptySelection(), 'burnisher')]) {
      expect(render(selection).marks).toEqual(render(selection, 7, 0.5).marks);
      expect(render(selection, 7, 0).marks).toEqual([]);
      const effect = (intensity: number) => render(selection, 7, intensity).marks
        .filter(mark => ['fill', 'fillRect', 'drawImage'].includes(mark.method));
      const gentle = effect(0.2);
      const strong = effect(0.9);
      expect(gentle.length).toBeGreaterThan(0);
      expect(gentle.map(mark => mark.args)).toEqual(strong.map(mark => mark.args));
      gentle.forEach((mark, index) => expect(strong[index].alpha).toBeGreaterThan(mark.alpha));
      expect(render(selection, 7, -1).marks).toEqual([]);
      expect(render(selection, 7, 2).marks).toEqual(render(selection, 7, 1).marks);
    }
    expect(render(loaded('round'), 7, 0).marks).toEqual(render(loaded('round'), 7, 1).marks);
  });
  it('burnishes only supplied pigment with smearing opacity buildup, without lifting or adding color', () => {
    const { marks, canvas } = render(selectTool(emptySelection(), 'burnisher'));
    const copies = marks.filter(mark => mark.method === 'drawImage');
    expect(copies.length).toBeGreaterThan(0);
    expect(copies.every(mark => mark.args[0] === canvas)).toBe(true);
    expect(copies.every(mark => mark.operation === 'source-over' && mark.alpha > 0)).toBe(true);
    expect(copies.some(mark => mark.args[1] !== mark.args[5])).toBe(true);
    expect(marks.some(mark => mark.method === 'fill' || mark.method === 'fillRect')).toBe(false);
    expect(marks.some(mark => mark.operation === 'destination-out')).toBe(false);
  });
  it('draws nothing until a loaded or standalone tool is ready', () => {
    expect(render(emptySelection()).marks).toEqual([]);
    expect(render(selectTool(emptySelection(), 'round')).marks).toEqual([]);
  });

  it('uses repeatable grain and changes that grain as a stroke advances', () => {
    const selection = loaded('round');
    expect(render(selection).marks).toEqual(render(selection).marks);
    expect(render(selection, 8).marks).not.toEqual(render(selection, 7).marks);
  });

  it('makes watercolor a much lighter glaze than acrylic and the airbrush core', () => {
    const maximumPaintAlpha = (selection: PaintingSelection) => Math.max(...render(selection).marks
      .filter(mark => mark.method === 'fill' || mark.method === 'fillRect').map(mark => mark.alpha));
    expect(maximumPaintAlpha(loaded('round', 'watercolor'))).toBeLessThan(0.04);
    expect(maximumPaintAlpha(loaded('round'))).toBeGreaterThan(0.2);
    expect(maximumPaintAlpha(loaded('airbrush'))).toBeGreaterThan(0.15);
  });

  it('keeps watercolor bristles and texture as transparent as the brush core', () => {
    for (const tool of ['round', 'flat', 'fan', 'detail', 'foam'] as const) {
      const paint = (medium: 'watercolor' | 'acrylic') => render(loaded(tool, medium)).marks
        .filter(mark => mark.method === 'fill' || mark.method === 'fillRect');
      const wash = paint('watercolor');
      const acrylic = paint('acrylic');
      expect(wash.length).toBe(acrylic.length);
      // Fan bristles are thin and barely overlap, so each one carries more of a
      // wash to build up like the other brushes; it still stays translucent.
      const [limit, share] = tool === 'fan' ? [0.12, 0.6] : [0.04, 0.12];
      wash.forEach((mark, index) => {
        expect(mark.alpha).toBeLessThan(limit);
        expect(mark.alpha).toBeLessThan(acrylic[index].alpha * share);
      });
    }
  });

  it('gives round, detail, flat, fan, foam, and knife different tip footprints', () => {
    const tools: PaintingTool[] = ['round', 'detail', 'flat', 'fan', 'foam', 'knife'];
    const footprints = tools.map(tool => JSON.stringify(render(loaded(tool)).marks));
    expect(new Set(footprints).size).toBe(tools.length);
    const gradients = render(loaded('round')).marks.filter(mark => mark.method === 'color');
    expect(gradients.some(mark => mark.args[0] === 1 && mark.args[1] === '#1234ab00')).toBe(true);
  });

  it('clips separate colors across a shared tip', () => {
    const selection = loaded('flat');
    selection.load!.colors = ['#ff0000', '#0000ff', '#ffff00'];
    const marks = render(selection).marks;
    expect(marks.filter(mark => mark.method === 'clip')).toHaveLength(3);
    const bands = marks.filter(mark => mark.method === 'rect');
    expect(new Set(bands.map(mark => mark.args[1])).size).toBe(3);
  });

  it('water and the sponge, wet or dry, sample only their supplied painter layer', () => {
    const wetSponge = dipInWater(selectTool(emptySelection(), 'sponge'));
    for (const selection of [dipInWater(selectTool(emptySelection(), 'round')), selectTool(emptySelection(), 'sponge'), wetSponge]) {
      const { marks, canvas } = render(selection);
      const copies = marks.filter(mark => mark.method === 'drawImage');
      expect(copies.length).toBeGreaterThan(0);
      expect(copies.every(mark => mark.args[0] === canvas)).toBe(true);
      // Moves keep the paint's opacity (source-atop) or only fill in beneath it
      // (destination-over), so water never piles new pigment on top.
      expect(copies.every(mark => mark.operation === 'source-atop' || mark.operation === 'destination-over')).toBe(true);
      const fills = marks.filter(mark => mark.method === 'fill' || mark.method === 'fillRect');
      expect(fills.length).toBeGreaterThan(0);
      expect(fills.every(mark => mark.operation === 'destination-out')).toBe(true);
    }
  });

  it('makes water run and smear more than it lifts', () => {
    const { marks } = render(dipInWater(selectTool(emptySelection(), 'round')));
    const flow = marks.filter(mark => mark.method === 'drawImage' && mark.operation === 'source-atop');
    expect(flow.length).toBeGreaterThan(1);
    expect(flow.at(-1)!.alpha).toBeLessThan(flow[0].alpha / 3);
    const lifts = marks.filter(mark => mark.method === 'fill');
    expect(lifts.every(mark => mark.operation === 'destination-out' && mark.alpha > 0 && mark.alpha < 0.01)).toBe(true);
    const methods = marks.map(mark => mark.method);
    expect(methods.lastIndexOf('fill')).toBeGreaterThan(methods.lastIndexOf('drawImage'));
  });

  it('gives the wet sponge a textured (pored) run, different from a wet brush', () => {
    const sponge = render(dipInWater(selectTool(emptySelection(), 'sponge'))).marks;
    const brush = render(dipInWater(selectTool(emptySelection(), 'round'))).marks;
    expect(sponge.filter(mark => mark.method === 'arc').length).toBeGreaterThan(brush.filter(mark => mark.method === 'arc').length);
    expect(JSON.stringify(sponge)).not.toEqual(JSON.stringify(brush));
  });

  it('eraser lifts paint without sampling or filling new pigment', () => {
    const marks = render(selectTool(emptySelection(), 'eraser')).marks;
    expect(marks.some(mark => mark.method === 'drawImage')).toBe(false);
    expect(marks.filter(mark => mark.method === 'fill').every(mark => mark.operation === 'destination-out')).toBe(true);
  });

  it('keeps stamp gaps small enough for a continuous detail line', () => {
    expect(stampSpacing(loaded('detail'), 30)).toBeLessThan(2);
    expect(stampSpacing(loaded('airbrush'), 30)).toBeLessThan(5);
  });
});

describe('pressure curves', () => {
  it('leave mouse painting (pressure 0.5) exactly as it was', async () => {
    const { PRESSURE, pressureFactor } = await import('./brushes');
    for (const curve of Object.values(PRESSURE)) {
      expect(pressureFactor(curve.width, 0.5)).toBe(1);
      expect(pressureFactor(curve.ink, 0.5)).toBe(1);
    }
  });
  it('make pencils darker rather than wider, and never vanish at a light touch', async () => {
    const { PRESSURE, pressureFactor } = await import('./brushes');
    expect(PRESSURE.pencil.ink).toBeGreaterThan(PRESSURE.pencil.width);
    expect(PRESSURE.airbrush.width).toBe(0);
    expect(pressureFactor(PRESSURE.round.width, 0.05, 0.15)).toBeGreaterThan(0.15 - 1e-9);
    expect(pressureFactor(PRESSURE.round.width, 1)).toBeGreaterThan(pressureFactor(PRESSURE.detail.width, 1));
  });
});

it('keeps drawing work bounded for representative strokes', () => {
  // Allow roughly 25% growth over the recorded Nov 2026 baseline.
  const fixtures = [
    ['round acrylic', loaded('round'), 1400],
    ['flat watercolor', loaded('flat', 'watercolor'), 6400],
    ['airbrush', loaded('airbrush'), 1250],
    ['wet sponge', dipInWater(selectTool(emptySelection(), 'sponge')), 3500],
    ['burnisher', selectTool(emptySelection(), 'burnisher'), 1350],
  ] as const;

  for (const [name, selection, budget] of fixtures) {
    const { ctx, marks } = recordingCanvas();
    const size = 30;
    const spacing = stampSpacing(selection, size);
    expect(spacing, name).toBeGreaterThanOrEqual(0.5);
    // A 120-unit stroke with a fixed seed sequence and varied pressure.
    for (let index = 0; index * spacing <= 120; index++) {
      const distance = index * spacing;
      const pressure = 0.2 + (distance / 120) * 0.7;
      drawMark(ctx, selection, size, { x: 120 + distance, y: 80, pressure }, 0, index);
    }
    expect(marks.length, `${name} recorded Canvas 2D operations`).toBeLessThanOrEqual(budget);
  }
});
