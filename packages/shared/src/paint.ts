// The painting table's vocabulary, shared by the browser and the party server.
//
// A painter holds one TOOL (the object in your hand) and it may carry a LOAD
// (the paint on it). Brushes can also be WET (dipped in water). The rules for
// which tool takes which paint live here so the server can refuse a stroke
// that no real table could produce.

/** The objects on the table. */
export type ToolId =
  | 'round' | 'flat' | 'detail' | 'fan' | 'foam' // brushes
  | 'knife' | 'airbrush' // acrylic-only tools
  | 'pencil' | 'charcoal' | 'pastel' // dry media: the tool IS the material
  | 'sponge' | 'burnisher' | 'eraser'; // work the paint already there

/** The paint sets. */
export type MediumId = 'acrylic' | 'watercolor' | 'pencil' | 'charcoal' | 'pastel';

/** What a tool is carrying. Several colors = a streaked "multicolor" load. */
export interface PaintLoad {
  medium: MediumId;
  name: string; // spoken name, e.g. "Bright blue" or "Tray: even mix, 3 colors"
  colors: string[]; // 1–9 hex colors
}

export const TOOL_IDS: ToolId[] = ['round', 'flat', 'detail', 'fan', 'foam', 'knife', 'airbrush', 'pencil', 'charcoal', 'pastel', 'sponge', 'burnisher', 'eraser'];
export const MEDIUM_IDS: MediumId[] = ['acrylic', 'watercolor', 'pencil', 'charcoal', 'pastel'];
export const MAX_LOAD_COLORS = 9;

export function isBrush(tool: ToolId | null): boolean {
  return tool !== null && ['round', 'flat', 'detail', 'fan', 'foam'].includes(tool);
}

/** Tools that work without any paint loaded. */
export function worksDry(tool: ToolId | null): boolean {
  return tool === 'sponge' || tool === 'burnisher' || tool === 'eraser';
}

/** Why a tool can't take this paint, in plain words. Empty string = it can. */
export function unavailability(tool: ToolId | null, medium: MediumId, toolName = 'This tool'): string {
  if (!tool) return 'Choose a tool first.';
  if (worksDry(tool)) return 'This tool works without added paint.';
  if (tool === 'knife' || tool === 'airbrush') return medium === 'acrylic' ? '' : `${toolName} uses acrylic.`;
  if (isBrush(tool)) return medium === 'acrylic' || medium === 'watercolor' ? '' : 'Choose this material directly from its tray.';
  return tool === medium ? '' : `${toolName} uses its own material.`;
}

// ---------- canvas shapes ----------

export interface CanvasSize {
  width: number;
  height: number;
}

/** The canvas shapes a host can choose in the lobby. Units are canvas pixels. */
export const CANVAS_SHAPES = {
  classic: { name: 'Classic landscape', width: 1600, height: 1200 },
  landscape: { name: 'Wide landscape', width: 1600, height: 850 },
  portrait: { name: 'Tall portrait', width: 850, height: 1600 },
  square: { name: 'Square', width: 1200, height: 1200 }
} as const;
export type CanvasShape = keyof typeof CANVAS_SHAPES;
export const DEFAULT_CANVAS_SHAPE: CanvasShape = 'classic';

// ---------- strokes ----------

/**
 * One dab of the tool on the canvas. The browser spaces stamps along the
 * drag (and keeps spraying while an airbrush is held still), then sends the
 * stamps themselves, so every screen draws exactly the same marks.
 */
export interface Stamp {
  x: number;
  y: number;
  pressure: number; // 0–1 (0.5 for a mouse)
  angle: number; // direction of travel, radians
}

/** A batch of stamps from one continuous drag, plus what the painter was holding. */
export interface Stroke {
  id: string;
  tool: ToolId;
  load: PaintLoad | null;
  wet: boolean;
  size: number; // 2–80
  intensity: number; // 0–1; airbrush and burnisher only, 0.5 elsewhere
  /** Index of this batch's first stamp within the whole drag (seeds the grain). */
  first: number;
  stamps: Stamp[];
  /** true on the last batch of a drag (pointer lifted) */
  done: boolean;
}

/** A stroke as the server relays it: stamped with who painted it, and in which turn. */
export interface PaintedStroke extends Stroke {
  painterId: string;
  round: number;
}

/** Could a real table produce this? Used by the server before relaying. */
export function strokeIsPossible(stroke: Pick<Stroke, 'tool' | 'load' | 'wet'>): boolean {
  if (stroke.wet && !isBrush(stroke.tool)) return false;
  if (stroke.load && unavailability(stroke.tool, stroke.load.medium)) return false;
  return Boolean(stroke.load) || stroke.wet || worksDry(stroke.tool);
}

const MAX_STAMPS_PER_BATCH = 4000;

/** Clamp a stroke from the network to sane values; null if it's junk or impossible. */
export function sanitizeStroke(input: unknown, canvas: CanvasSize): Stroke | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<Stroke>;
  if (!TOOL_IDS.includes(raw.tool as ToolId)) return null;
  if (!Array.isArray(raw.stamps) || raw.stamps.length > MAX_STAMPS_PER_BATCH) return null;

  let load: PaintLoad | null = null;
  if (raw.load) {
    const colors = Array.isArray(raw.load.colors) ? raw.load.colors : [];
    if (!MEDIUM_IDS.includes(raw.load.medium as MediumId)) return null;
    if (colors.length < 1 || colors.length > MAX_LOAD_COLORS) return null;
    if (!colors.every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) return null;
    load = { medium: raw.load.medium as MediumId, name: String(raw.load.name ?? '').slice(0, 80), colors: [...colors] };
  }

  const clamp = (n: unknown, lo: number, hi: number) => {
    const value = Number(n);
    return Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : lo;
  };
  const stroke: Stroke = {
    id: String(raw.id ?? '').slice(0, 64),
    tool: raw.tool as ToolId,
    load,
    wet: Boolean(raw.wet),
    size: clamp(raw.size, 1, 120),
    intensity: clamp(raw.intensity ?? 0.5, 0, 1),
    first: Math.floor(clamp(raw.first, 0, 10_000_000)),
    done: Boolean(raw.done),
    stamps: raw.stamps.map((stamp) => ({
      x: clamp(stamp?.x, -50, canvas.width + 50),
      y: clamp(stamp?.y, -50, canvas.height + 50),
      pressure: clamp(stamp?.pressure, 0, 1),
      angle: clamp(stamp?.angle, -Math.PI, Math.PI)
    }))
  };
  if (!stroke.id || !strokeIsPossible(stroke)) return null;
  return stroke;
}
