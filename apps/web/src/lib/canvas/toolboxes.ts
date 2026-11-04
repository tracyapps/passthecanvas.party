/**
 * Toolboxes: named sets of supplies to show on the painting table, like
 * custom dashboards ("Drawing": charcoal, pencils, pastels, eraser).
 *
 * A toolbox only decides what's *shown*. Every supply is still one tool with
 * one state: the brush in your hand, its paint and size are the same whichever
 * toolbox (or, later, window or device) shows it. That's what lets a tool
 * appear in several toolboxes and stay in sync.
 */
export interface Toolbox { id: string; name: string; supplies: string[] }

export const EVERYTHING = 'everything';
export const BUILT_IN_TOOLBOXES: Toolbox[] = [
  { id: EVERYTHING, name: 'Everything', supplies: [] }, // empty = every supply
  { id: 'drawing', name: 'Drawing', supplies: ['charcoal', 'pencil', 'pastel', 'eraser'] },
  { id: 'drawing-plus', name: 'Drawing +', supplies: ['charcoal', 'pencil', 'pastel', 'eraser', 'water', 'sponge'] },
  { id: 'painting', name: 'Painting', supplies: ['acrylic', 'tray', 'watercolor', 'water', 'round', 'flat', 'fan', 'detail', 'foam', 'knife', 'sponge', 'eraser'] }
];
export const MAX_TOOLBOXES = 20;

export function isBuiltIn(id: string): boolean {
  return BUILT_IN_TOOLBOXES.some((box) => box.id === id);
}
export function allToolboxes(custom: Toolbox[]): Toolbox[] {
  return [...BUILT_IN_TOOLBOXES, ...custom];
}
export function findToolbox(id: string, custom: Toolbox[]): Toolbox {
  return allToolboxes(custom).find((box) => box.id === id) ?? BUILT_IN_TOOLBOXES[0]!;
}
/** The supplies a toolbox shows, in the table's current order. */
export function shownSupplies(order: string[], box: Toolbox): string[] {
  if (box.id === EVERYTHING || !box.supplies.length) return [...order];
  return order.filter((id) => box.supplies.includes(id));
}
/** A new custom toolbox, starting from another one's supplies. */
export function makeToolbox(name: string, from: Toolbox, all: string[], id: string = crypto.randomUUID()): Toolbox {
  const supplies = from.id === EVERYTHING || !from.supplies.length ? [...all] : from.supplies.filter((s) => all.includes(s));
  return { id, name: name.trim().slice(0, 40) || 'My toolbox', supplies };
}
/** A name nobody else is using: "Drawing copy", "Drawing copy 2"… */
export function freshName(base: string, custom: Toolbox[]): string {
  const taken = new Set(allToolboxes(custom).map((box) => box.name.toLowerCase()));
  const stem = base.slice(0, 34);
  if (!taken.has(stem.toLowerCase())) return stem;
  for (let n = 2; ; n++) if (!taken.has(`${stem} ${n}`.toLowerCase())) return `${stem} ${n}`;
}
/** Custom toolboxes from storage: only known supplies, sensible names, no duplicates. Throws on junk. */
export function readToolboxes(value: unknown, ids: string[]): Toolbox[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_TOOLBOXES) throw new Error('Invalid toolboxes.');
  const used = new Set(BUILT_IN_TOOLBOXES.map((box) => box.id));
  return value.map((raw) => {
    const box = raw as Toolbox;
    if (!box || typeof box.id !== 'string' || !box.id || box.id.length > 80 || used.has(box.id) || typeof box.name !== 'string' || !box.name.trim() || box.name.length > 40 || !Array.isArray(box.supplies) || box.supplies.length > 32) throw new Error('Invalid toolbox.');
    used.add(box.id);
    return { id: box.id, name: box.name, supplies: [...new Set(box.supplies.filter((s): s is string => typeof s === 'string' && ids.includes(s)))] };
  });
}
