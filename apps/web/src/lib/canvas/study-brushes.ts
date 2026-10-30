// Local paint experiments stay separate from the party renderer so saved strokes
// keep their original appearance. Supply only the current painter's clear layer.
import type { StrokePoint } from '@ptc/shared';
import { canPaint, type PaintingSelection, type PaintingTool } from './painting-selection';

export function studySpacing(selection: PaintingSelection, size: number): number {
  if (selection.tool === 'airbrush') return Math.max(1, size * 0.12);
  if (selection.tool === 'sponge' || selection.tool === 'burnisher' || selection.tool === 'foam') return Math.max(1, size * 0.13);
  if (selection.tool === 'pencil' || selection.tool === 'detail') return Math.max(0.6, size * 0.035);
  return Math.max(0.8, size * 0.07);
}

export function drawStudyMark(
  ctx: CanvasRenderingContext2D, selection: PaintingSelection, size: number,
  point: StrokePoint, angle: number, stampIndex: number, intensity = 0.5
): void {
  if (!canPaint(selection) || !selection.tool) return;
  const tool = selection.tool;
  // Half strength retains the approved feel. Full strength doubles the deposit;
  // zero disables these two effects without affecting other tools.
  const strength = (Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0.5) * 2;
  if ((tool === 'airbrush' || tool === 'burnisher') && strength === 0) return;
  const pressure = Math.max(0.05, Math.min(1, point.pressure));
  const width = Math.max(1, size * (0.55 + pressure * 0.9));
  ctx.save();

  if (tool === 'burnisher') {
    burnishPaint(ctx, point, width, angle, strength);
    ctx.restore();
    return;
  }

  // These tools copy or lift only this layer. Never sample the paper or another
  // painter's flattened picture, even when it is visible underneath this canvas.
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    softDab(ctx, point.x, point.y, width * 0.65, width * 0.65, '#000', 0.7, 0.75);
    ctx.restore();
    return;
  }
  if (selection.wet || tool === 'sponge') {
    disturbPaint(ctx, point, width, angle, stampIndex, tool === 'sponge');
    if (!selection.load || tool === 'sponge') {
      ctx.restore();
      return;
    }
  }
  if (!selection.load?.colors.length) {
    ctx.restore();
    return;
  }

  const watercolor = selection.load.medium === 'watercolor';
  // Washes build gently over repeated passes; spray has a visible soft core
  // immediately, and the caller can keep stamping it while the pointer rests.
  const alpha = watercolor ? 0.022 : 0.24;
  const flow = selection.wet ? 0.55 : 1;
  ctx.translate(point.x, point.y);
  ctx.rotate(angle);
  const colors = selection.load.colors;
  colors.forEach((color, index) => {
    ctx.save();
    if (colors.length > 1) {
      // Each pigment occupies a strip across the same tip rather than a string
      // of dots along the stroke. Mixing remains a separate tray action.
      const band = width * 1.7 / colors.length;
      ctx.beginPath();
      ctx.rect(-width * 2, -width * 0.85 + index * band, width * 4, band);
      ctx.clip();
    }
    drawTip(ctx, tool, width, color, alpha * flow, stampIndex, watercolor, strength);
    ctx.restore();
  });
  ctx.restore();
}

function drawTip(ctx: CanvasRenderingContext2D, tool: PaintingTool, width: number, color: string, alpha: number, seed: number, wash: boolean, strength: number) {
  switch (tool) {
    case 'airbrush': {
      softDab(ctx, 0, 0, width * 0.66, width * 0.66, color, 0.19 * strength, 0.05);
      speckles(ctx, width * 0.66, color, 22, seed, 0.12 * strength, 0.8);
      break;
    }
    case 'fan': {
      // Separated bristle bundles leave a feathered comb rather than a solid bar.
      for (let i = 0; i < 13; i++) {
        const reach = (i / 12 - 0.5) * width * 1.4;
        const depth = Math.abs(reach) * 0.16;
        softDab(ctx, depth, reach, width * 0.12, width * 0.035, color, alpha * 0.8, 0.15);
      }
      break;
    }
    case 'flat': {
      softDab(ctx, 0, 0, width * 0.21, width * 0.6, color, alpha, 0.7);
      for (let i = 0; i < 16; i++) {
        const across = (i / 15 - 0.5) * width;
        softDab(ctx, 0, across, width * 0.25, width * 0.016, color, alpha * 0.5, 0.2);
      }
      break;
    }
    case 'detail':
      softDab(ctx, 0, 0, width * 0.12, width * 0.14, color, alpha * 1.8, 0.65);
      break;
    case 'foam':
      softDab(ctx, 0, 0, width * 0.2, width * 0.54, color, alpha * 0.5, 0.45);
      speckles(ctx, width * 0.55, color, 48, seed, alpha, Math.max(0.7, width * 0.04));
      break;
    case 'knife':
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.fillRect(-width * 0.09, -width * 0.7, width * 0.18, width * 1.4);
      break;
    case 'pencil':
      softDab(ctx, 0, 0, width * 0.09, width * 0.09, color, 0.3, 0.35);
      speckles(ctx, width * 0.14, color, 12, seed, 0.24, 0.8);
      break;
    case 'pastel':
    case 'charcoal':
      softDab(ctx, 0, 0, width * 0.35, width * 0.4, color, tool === 'pastel' ? 0.075 : 0.04, 0.15);
      speckles(ctx, width * 0.5, color, tool === 'pastel' ? 70 : 48, seed, tool === 'pastel' ? 0.3 : 0.2, Math.max(0.6, width * 0.025));
      break;
    default:
      softDab(ctx, 0, 0, width * 0.4, width * 0.47, color, alpha, wash ? 0.1 : 0.55);
      speckles(ctx, width * 0.47, color, 12, seed, alpha * 0.25, Math.max(0.5, width * 0.025));
  }
}

function softDab(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, alpha: number, core: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  fade.addColorStop(0, color);
  fade.addColorStop(core, color);
  fade.addColorStop(1, transparentColor(color));
  ctx.fillStyle = fade;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Gradients interpolate to the pigment's own transparent RGB, avoiding dark rims.
function transparentColor(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}00`;
  return 'rgba(0, 0, 0, 0)';
}

function speckles(ctx: CanvasRenderingContext2D, radius: number, color: string, count: number, seed: number, alpha: number, size: number) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const direction = noise(seed, i * 3) * Math.PI * 2;
    const reach = Math.sqrt(noise(seed, i * 3 + 1)) * radius;
    ctx.globalAlpha = alpha * (1 - reach / radius) * (0.5 + noise(seed, i * 3 + 2));
    ctx.fillRect(Math.cos(direction) * reach, Math.sin(direction) * reach, size, size);
  }
}

function disturbPaint(ctx: CanvasRenderingContext2D, point: StrokePoint, width: number, angle: number, seed: number, dry: boolean) {
  const radius = width * 0.6;
  const step = width * 0.08;
  ctx.save();
  // Source-atop blends pigment colors while keeping the existing alpha. A
  // source-over copy would add opacity faster than the water could remove it.
  ctx.globalCompositeOperation = 'source-atop';
  // Concentric bands taper the disturbance instead of leaving a hard circular
  // boundary. They reuse the active layer without allocating scratch canvases.
  for (let ring = 0; ring < 6; ring++) {
    const inner = radius * ring / 6;
    const outer = radius * (ring + 1) / 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, outer, 0, Math.PI * 2);
    if (inner > 0) {
      ctx.moveTo(point.x + inner, point.y);
      ctx.arc(point.x, point.y, inner, 0, Math.PI * 2);
    }
    ctx.clip('evenodd');
    ctx.globalAlpha = (dry ? 0.18 : 0.12) * (1 - ring / 6);
    ctx.drawImage(ctx.canvas, point.x - radius - Math.cos(angle) * step, point.y - radius - Math.sin(angle) * step,
      radius * 2, radius * 2, point.x - radius, point.y - radius, radius * 2, radius * 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'destination-out';
  if (dry) {
    ctx.translate(point.x, point.y);
    speckles(ctx, radius, '#000000', 30, seed, 0.12, Math.max(1, width * 0.05));
  } else {
    softDab(ctx, point.x, point.y, radius, radius, '#000000', 0.018, 0.2);
  }
  ctx.restore();
}

function burnishPaint(ctx: CanvasRenderingContext2D, point: StrokePoint, width: number, angle: number, strength: number) {
  const radius = width * 0.6;
  const step = width * 0.08;
  // Repeated source-over copies deliberately deepen the existing pigment while
  // pulling it along the stroke. This is the old sponge's intensifying effect,
  // isolated from water/texture and restricted to the supplied owned layer.
  ctx.globalCompositeOperation = 'source-over';
  for (let ring = 0; ring < 6; ring++) {
    const inner = radius * ring / 6;
    const outer = radius * (ring + 1) / 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, outer, 0, Math.PI * 2);
    if (inner > 0) {
      ctx.moveTo(point.x + inner, point.y);
      ctx.arc(point.x, point.y, inner, 0, Math.PI * 2);
    }
    ctx.clip('evenodd');
    ctx.globalAlpha = 0.22 * strength * (1 - ring / 6);
    ctx.drawImage(ctx.canvas, point.x - radius - Math.cos(angle) * step, point.y - radius - Math.sin(angle) * step,
      radius * 2, radius * 2, point.x - radius, point.y - radius, radius * 2, radius * 2);
    ctx.restore();
  }
}

function noise(seed: number, index: number): number {
  const value = Math.sin(seed * 19.19 + index * 73.37 + 11.7) * 43758.5453;
  return value - Math.floor(value);
}
