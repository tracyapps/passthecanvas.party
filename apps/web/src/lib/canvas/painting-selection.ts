// This local study separates the object in your hand from what it carries.
// It deliberately does not change the party's shared stroke protocol.
export type PaintingTool = 'round' | 'flat' | 'detail' | 'fan' | 'foam' | 'knife' | 'airbrush' | 'pencil' | 'charcoal' | 'pastel' | 'sponge' | 'burnisher' | 'eraser';
export type PaintingMedium = 'acrylic' | 'watercolor' | 'pencil' | 'charcoal' | 'pastel';
export interface PaintLoad {
  medium: PaintingMedium;
  name: string;
  colors: string[];
}
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
export function isBrush(tool: PaintingTool | null): boolean {
  return tool !== null && ['round', 'flat', 'detail', 'fan', 'foam'].includes(tool);
}
export function unavailability(tool: PaintingTool | null, medium: PaintingMedium): string {
  if (!tool) return 'Choose a tool first.';
  if (tool === 'sponge' || tool === 'burnisher' || tool === 'eraser') return 'This tool works without added paint.';
  if (tool === 'knife' || tool === 'airbrush') return medium === 'acrylic' ? '' : `${TOOL_NAMES[tool]} uses acrylic.`;
  if (isBrush(tool)) return ['acrylic', 'watercolor'].includes(medium) ? '' : 'Choose this material directly from its tray.';
  return tool === medium ? '' : `${TOOL_NAMES[tool]} uses its own material.`;
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
  return !!selection.load || selection.wet || selection.tool === 'eraser' || selection.tool === 'sponge' || selection.tool === 'burnisher';
}
