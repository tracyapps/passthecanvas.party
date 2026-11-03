// What the painter is holding: the object in your hand (tool), what it carries
// (load) and whether it is wet. The tool/paint rules themselves are shared with
// the party server in @ptc/shared, so the server refuses impossible strokes.
import { isBrush, unavailability as sharedUnavailability, worksDry, type MediumId, type PaintLoad, type ToolId } from '@ptc/shared';

export type PaintingTool = ToolId;
export type PaintingMedium = MediumId;
export type { PaintLoad };
export { isBrush };
export interface PaintingSelection {
  tool: PaintingTool | null;
  load: PaintLoad | null;
  remembered: PaintLoad | null;
  wet: boolean;
}
export const TOOL_NAMES: Record<PaintingTool, string> = {
  round: 'Round brush', flat: 'Flat brush', detail: 'Detail brush', fan: 'Fan brush',
  foam: 'Foam brush', knife: 'Palette knife', airbrush: 'Airbrush', pencil: 'Pencil',
  charcoal: 'Charcoal', pastel: 'Pastel', sponge: 'Texture sponge', burnisher: 'Burnishing pad', eraser: 'Eraser'
};
export const MEDIUM_NAMES: Record<PaintingMedium, string> = {
  acrylic: 'Acrylic', watercolor: 'Watercolor', pencil: 'Pencil', charcoal: 'Charcoal', pastel: 'Pastel'
};
export function emptySelection(): PaintingSelection {
  return { tool: null, load: null, remembered: null, wet: false };
}
export function unavailability(tool: PaintingTool | null, medium: PaintingMedium): string {
  return sharedUnavailability(tool, medium, tool ? TOOL_NAMES[tool] : undefined);
}
export function selectTool(selection: PaintingSelection, tool: PaintingTool): PaintingSelection {
  const remembered = selection.remembered;
  const load = remembered && !unavailability(tool, remembered.medium) ? remembered : null;
  return { tool, load, remembered, wet: false };
}
export function loadPaint(selection: PaintingSelection, load: PaintLoad): PaintingSelection {
  if (unavailability(selection.tool, load.medium)) return selection;
  return { ...selection, load, remembered: load, wet: false };
}
export function dipInWater(selection: PaintingSelection): PaintingSelection {
  if (!isBrush(selection.tool)) return selection;
  return { ...selection, wet: true };
}
export function canPaint(selection: PaintingSelection): boolean {
  if (!selection.tool) return false;
  return !!selection.load || selection.wet || worksDry(selection.tool);
}
