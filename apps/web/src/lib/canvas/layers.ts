// Each turn paints on its own clear layer. The picture everyone sees is all the
// layers stacked in the order the turns happened.
//
// Ownership is independent of the drawing tool: modifiers (water, sponge,
// burnisher, eraser) must never receive a different painter's layer, even when
// those pixels are visible in the stack. The party server says who painted a
// stroke and in which round, so every screen builds the same layers.
import type { PaintedStroke } from '@ptc/shared';
import { drawMark } from './brushes';
import type { PaintingSelection } from './painting-selection';

export interface OwnedLayer<T> { owner: string; surface: T }

export function editOwnedLayers<T>(layers: OwnedLayer<T>[], painter: string, edit: (surface: T) => void): void {
  for (const layer of layers) {
    if (layer.owner === painter) edit(layer.surface);
  }
}

/** True for tools that work the paint already on the canvas. */
export function modifiesExisting(stroke: Pick<PaintedStroke, 'tool' | 'wet'>): boolean {
  return stroke.wet || stroke.tool === 'sponge' || stroke.tool === 'burnisher' || stroke.tool === 'eraser';
}

/** The owner name of the protected picture used when a late joiner gets a snapshot. */
export const BASE_OWNER = '__snapshot__';

interface TurnLayer extends OwnedLayer<HTMLCanvasElement> { key: string }

export class TurnLayers {
  private layers: TurnLayer[] = [];

  constructor(public width: number, public height: number) {}

  /** Forget everything (new canvas shape, or rebuilding from history). */
  reset(width = this.width, height = this.height) {
    this.width = width;
    this.height = height;
    this.layers = [];
  }

  /** A flattened picture nobody can modify. Used only when history is unavailable. */
  setBase(image: CanvasImageSource) {
    const base = this.layerFor(BASE_OWNER, 0);
    const context = base.surface.getContext('2d')!;
    context.clearRect(0, 0, this.width, this.height);
    context.drawImage(image, 0, 0, this.width, this.height);
  }

  /** Draw one batch of stamps into the right layers. Same input, same pixels, on every screen. */
  apply(stroke: PaintedStroke) {
    const selection: PaintingSelection = { tool: stroke.tool, load: stroke.load, remembered: stroke.load, wet: stroke.wet };
    const current = this.layerFor(stroke.painterId, stroke.round);
    const modifies = modifiesExisting(stroke);
    stroke.stamps.forEach((stamp, offset) => {
      const index = stroke.first + offset;
      if (!modifies) {
        drawMark(context(current.surface), selection, stroke.size, stamp, stamp.angle, index, stroke.intensity);
        return;
      }
      editOwnedLayers(this.layers, stroke.painterId, (surface) => {
        // Older turns by this artist may be worked, but only the current turn
        // receives new pigment. Other artists are never sampled.
        const state = surface === current.surface ? selection : { ...selection, load: null };
        drawMark(context(surface), state, stroke.size, stamp, stamp.angle, index, stroke.intensity);
      });
    });
  }

  /** Make sure a turn's layer exists (so it can be backed up before painting). */
  prepare(painter: string, round: number) {
    this.layerFor(painter, round);
  }

  /** Every layer this painter owns (used to undo a touch that became a pinch). */
  ownedSurfaces(painter: string): HTMLCanvasElement[] {
    return this.layers.filter((layer) => layer.owner === painter).map((layer) => layer.surface);
  }

  /** Stack every layer onto a visible canvas. */
  composite(target: CanvasRenderingContext2D) {
    target.clearRect(0, 0, this.width, this.height);
    for (const layer of this.layers) target.drawImage(layer.surface, 0, 0);
  }

  private layerFor(owner: string, round: number): TurnLayer {
    const key = `${owner}:${round}`;
    let layer = this.layers.find((item) => item.key === key);
    if (!layer) {
      const surface = document.createElement('canvas');
      surface.width = this.width;
      surface.height = this.height;
      layer = { key, owner, surface };
      // The snapshot base always sits underneath; turns stack in arrival order.
      if (owner === BASE_OWNER) this.layers.unshift(layer);
      else this.layers.push(layer);
    }
    return layer;
  }
}

function context(surface: HTMLCanvasElement) {
  // No willReadFrequently: that forces slow CPU drawing (very noticeable on tablets).
  // Nothing reads these layers back pixel by pixel.
  return surface.getContext('2d')!;
}
