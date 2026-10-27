// The media engine. Ported from the design-canvas prototype and grown into
// the studio's full paint box: wet brushes, dry media, and blenders.
//
// Everything here works in canvas units (1600×1200), so local painting and
// replaying someone else's strokes draw exactly the same marks.
//
// Two rules keep every screen identical:
// 1. All grain, spray and speckle is seeded from the position (never
//    Math.random()), so a replay on another screen looks the same.
// 2. The wet tools (water, finger) work on the pixels already on the canvas,
//    so "dilute the paint below" replays correctly everywhere: every screen
//    has the same pixels at that moment.

import type { Stroke, StrokePoint, ToolId } from '@ptc/shared';

export interface BrushSettings {
  tool: ToolId;
  color: string;
  size: number; // 2–80
  flow: number; // 0.1–1
  viscosity: number; // 0–1, acrylic only
}

export const TOOLS: { id: ToolId; label: string; hint: string }[] = [
  { id: 'round', label: 'Round brush', hint: 'Pressure-shaped stroke' },
  { id: 'flat', label: 'Flat brush', hint: 'Angled, chisel edge' },
  { id: 'watercolor', label: 'Watercolor', hint: 'Transparent glazes, builds to opaque' },
  { id: 'acrylic', label: 'Acrylic', hint: 'Opaque paint; viscosity sets how it moves' },
  { id: 'airbrush', label: 'Airbrush', hint: 'Fine transparent spray' },
  { id: 'pencil', label: 'Pencil', hint: 'Fine, grainy line' },
  { id: 'charcoal', label: 'Charcoal', hint: 'Chalky black that builds and smears' },
  { id: 'pastel', label: 'Pastel', hint: 'Colored chalk build' },
  { id: 'water', label: 'Water brush', hint: 'Wets paint: dilutes and smears' },
  { id: 'finger', label: 'Finger', hint: 'Blends and smears what is there' },
  { id: 'sponge', label: 'Sponge', hint: 'Textured dabs' },
  { id: 'knife', label: 'Palette knife', hint: 'Hard opaque scrape of paint' },
  { id: 'eraser', label: 'Eraser', hint: 'Lifts paint' }
];

/** How the tools are grouped in the sidebar, the way they sit on the table. */
export const TOOL_GROUPS: { label: string; tools: ToolId[] }[] = [
  { label: 'Wet brushes', tools: ['round', 'flat', 'watercolor', 'acrylic', 'airbrush'] },
  { label: 'Dry media', tools: ['pencil', 'charcoal', 'pastel'] },
  { label: 'Blenders and tools', tools: ['water', 'finger', 'sponge', 'knife', 'eraser'] }
];

/**
 * Draw one short segment from a to b with the chosen medium.
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
    case 'watercolor': {
      // A glaze: barely-there paint that deepens every time you cross it.
      ctx.globalAlpha = 0.06 * flow;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.8;
      line(size * 1.8 * (0.6 + pressure));
      break;
    }

    case 'acrylic': {
      // Runny paint (low viscosity) spreads wide and sheer; buttery paint
      // (high viscosity) holds its shape and covers in one pass.
      const thick = brush.viscosity;
      ctx.globalAlpha = (0.3 + 0.65 * thick) * flow;
      line(size * (1.25 - 0.45 * thick) * (0.5 + pressure * 0.7));
      break;
    }

    case 'airbrush': {
      // A cone of specks: watercolor transparency with charcoal-style grain.
      ctx.globalAlpha = 0.05 * flow;
      const specks = 8 + Math.round(pressure * 12);
      for (let i = 0; i < specks; i++) {
        const ox = (pseudoRandom(b.x + i * 7, b.y) - 0.5) * size;
        const oy = (pseudoRandom(b.y + i * 13, b.x) - 0.5) * size;
        ctx.fillRect(b.x + ox, b.y + oy, 1.2, 1.2);
      }
      break;
    }

    case 'charcoal': {
      // A soft dark core, then heavy grain around it. Repeated passes build.
      ctx.globalAlpha = 0.22 * flow;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.25;
      line(size * 0.9 * (0.5 + pressure * 0.7));
      grain(ctx, b, size, color, 7, 1.8, 0.18 * flow);
      break;
    }

    case 'pastel': {
      // Like charcoal but creamier: more color, slightly larger chalk specks.
      ctx.globalAlpha = 0.3 * flow;
      line(size * (0.5 + pressure * 0.6));
      grain(ctx, b, size, color, 6, 2.4, 0.25 * flow);
      break;
    }

    case 'water': {
      // Wet the paint that's already there: drag it around (smear), then
      // thin it (dilute). Clearing alpha makes pigment lighter, not gone.
      smudge(ctx, a, b, size * 1.1, 0.15 * flow);
      dilute(ctx, b, size, 0.045 * flow);
      break;
    }

    case 'finger': {
      // A fingertip drags the paint below it — the blender.
      smudge(ctx, a, b, size * 0.8, 0.3 + 0.4 * pressure);
      break;
    }

    case 'sponge': {
      // A porous dab: holes come from seeded specks, so it repeats exactly.
      ctx.globalAlpha = 0.2 * flow;
      for (let i = 0; i < 12; i++) {
        const angle = pseudoRandom(b.x + i, b.y) * Math.PI * 2;
        const reach = size * (0.25 + 0.7 * pseudoRandom(b.y + i, b.x));
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(angle) * reach, b.y + Math.sin(angle) * reach, 1.5 + 1.5 * pseudoRandom(b.x, b.y + i), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'knife': {
      // A hard chisel of opaque paint that follows the direction of the drag.
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(distance / 1.5));
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.globalAlpha = 0.85 * flow;
      const w = size * 1.6 * (0.6 + pressure * 0.6);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        ctx.save();
        ctx.translate(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        ctx.rotate(angle);
        ctx.fillRect(-w / 2, -size * 0.09, w, size * 0.18);
        ctx.restore();
      }
      break;
    }

    case 'pencil': {
      ctx.globalAlpha = 0.75 * flow;
      line(Math.max(1.2, size * 0.22 * (0.5 + pressure)));
      // A little graphite grain, seeded so replays match.
      grain(ctx, b, size, color, 3, 1.5, 0.25 * flow);
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
    // Older strokes may not carry viscosity; give them the studio default.
    const brush: BrushSettings = { ...stroke, viscosity: stroke.viscosity ?? 0.6 };
    for (const point of stroke.points) {
      drawSegment(this.ctx, brush, previous, point);
      previous = point;
    }
    if (stroke.done) this.lastPoint.delete(stroke.id);
    else this.lastPoint.set(stroke.id, previous);
  }
}

// ---------- shared bits ----------

/**
 * Speckle around a point: the chalk of charcoal, pastel and pencil.
 * Offsets are seeded from the position so every screen draws the same specks.
 */
function grain(ctx: CanvasRenderingContext2D, at: StrokePoint, size: number, color: string, count: number, speck: number, alpha: number) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < count; i++) {
    const jx = (pseudoRandom(at.x + i, at.y) - 0.5) * size * 0.4;
    const jy = (pseudoRandom(at.y + i, at.x) - 0.5) * size * 0.4;
    ctx.fillRect(at.x + jx, at.y + jy, speck, speck);
  }
  ctx.restore();
}

/**
 * Smudge: drag a copy of the pixels around `from` on top of `to`.
 * Drawing the canvas onto itself with low alpha is the cheap, smooth smear —
 * it is what makes the finger blend paint and water push pigment around.
 */
function smudge(ctx: CanvasRenderingContext2D, from: StrokePoint, to: StrokePoint, radius: number, strength: number) {
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, Math.max(0, strength));
  ctx.beginPath();
  ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
  ctx.clip();
  const d = radius * 2;
  ctx.drawImage(ctx.canvas, from.x - radius, from.y - radius, d, d, to.x - radius, to.y - radius, d, d);
  ctx.restore();
}

/**
 * Dilute: take some pigment away, making the paint below more transparent
 * instead of erasing it — water lightening a wash. destination-out only
 * touches paint, never the paper behind the canvas.
 */
function dilute(ctx: CanvasRenderingContext2D, at: StrokePoint, radius: number, strength: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = Math.min(0.5, Math.max(0, strength));
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Tiny deterministic "random" number 0–1 from two numbers. */
function pseudoRandom(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}
