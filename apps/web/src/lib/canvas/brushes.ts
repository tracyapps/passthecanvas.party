// The brush engine. Ported from the design-canvas prototype.
// Everything here works in canvas units (1600×1200), so local painting and
// replaying someone else's strokes draw exactly the same marks.

import type { Stroke, StrokePoint, ToolId } from '@ptc/shared';

export interface BrushSettings {
  tool: ToolId;
  color: string;
  size: number; // 2–80
  flow: number; // 0.1–1
}

export const TOOLS: { id: ToolId; label: string; hint: string }[] = [
  { id: 'pencil', label: 'Pencil', hint: 'Fine, grainy line' },
  { id: 'round', label: 'Round brush', hint: 'Pressure-shaped stroke' },
  { id: 'flat', label: 'Flat brush', hint: 'Angled, chisel edge' },
  { id: 'wash', label: 'Wash brush', hint: 'Soft, builds in layers' },
  { id: 'eraser', label: 'Eraser', hint: 'Lifts paint' }
];

/**
 * Draw one short segment from a to b with the given brush.
 * Called many times per second while painting, so keep it lean.
 */
export function drawSegment(ctx: CanvasRenderingContext2D, brush: BrushSettings, a: StrokePoint, b: StrokePoint) {
  const { size, flow, color } = brush;
  const pressure = (a.pressure + b.pressure) / 2;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  const line = (width: number) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  switch (brush.tool) {
    case 'pencil': {
      ctx.globalAlpha = 0.75 * flow;
      line(Math.max(1.2, size * 0.22 * (0.5 + pressure)));
      // A little graphite grain. Seeded from the position, NOT Math.random(),
      // so a replay on another screen looks identical.
      ctx.globalAlpha = 0.25 * flow;
      for (let i = 0; i < 3; i++) {
        const jx = (pseudoRandom(b.x + i, b.y) - 0.5) * size * 0.4;
        const jy = (pseudoRandom(b.y + i, b.x) - 0.5) * size * 0.4;
        ctx.fillRect(b.x + jx, b.y + jy, 1.5, 1.5);
      }
      break;
    }

    case 'flat': {
      // Stamp a thin rectangle at a fixed angle along the path: a chisel edge.
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(distance / 1.5));
      ctx.globalAlpha = 0.5 * flow;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        ctx.save();
        ctx.translate(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        ctx.rotate(-0.6);
        const w = size * 1.2 * (0.6 + pressure);
        ctx.fillRect(-w / 2, -size * 0.09, w, size * 0.18);
        ctx.restore();
      }
      break;
    }

    case 'wash': {
      // Very transparent and blurry; builds up as you go over it.
      ctx.globalAlpha = 0.07 * flow;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.7;
      line(size * 1.7 * (0.6 + pressure));
      break;
    }

    case 'eraser': {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      line(size * 1.3);
      break;
    }

    default: {
      // round brush
      ctx.globalAlpha = flow;
      line(size * (0.35 + pressure * 0.9));
    }
  }

  ctx.restore();
}

/**
 * Replays stroke batches that arrive from the network.
 * Remembers the last point of each stroke so batches join up seamlessly.
 */
export class StrokeReplayer {
  private lastPoint = new Map<string, StrokePoint>();

  constructor(private ctx: CanvasRenderingContext2D) {}

  draw(stroke: Stroke) {
    let previous = this.lastPoint.get(stroke.id) ?? stroke.points[0];
    if (!previous) return;
    for (const point of stroke.points) {
      drawSegment(this.ctx, stroke, previous, point);
      previous = point;
    }
    if (stroke.done) this.lastPoint.delete(stroke.id);
    else this.lastPoint.set(stroke.id, previous);
  }
}

/** Tiny deterministic "random" number 0–1 from two numbers. */
function pseudoRandom(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}
