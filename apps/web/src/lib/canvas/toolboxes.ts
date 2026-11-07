/**
 * Toolboxes: named sets of supplies to show on the painting table, like
 * custom dashboards ("Drawing": charcoal, pencils, pastels, eraser).
 *
 * A toolbox only decides what's *shown*. Every supply is still one tool with
 * one state: the brush in your hand, its paint and size are the same whichever
 * toolbox (or, later, window or device) shows it. That's what lets a tool
 * appear in several toolboxes and stay in sync.
 */
export interface Toolbox { id: string; name: string; supplies: string[]; rows?: string[][]; paletteIds?: string[] }

export const EVERYTHING = 'everything';
export const BUILT_IN_TOOLBOXES: Toolbox[] = [
  { id: EVERYTHING, name: 'Everything', supplies: [] }, // empty = every supply
  { id: 'drawing', name: 'Drawing', supplies: ['charcoal', 'pencil', 'pastel', 'eraser'] },
  { id: 'drawing-plus', name: 'Drawing +', supplies: ['charcoal', 'pencil', 'pastel', 'eraser', 'water', 'sponge'] },
  { id: 'painting', name: 'Painting', supplies: ['acrylic', 'tray', 'watercolor', 'water', 'round', 'flat', 'fan', 'detail', 'foam', 'knife', 'sponge', 'eraser'] }
];
export const MAX_TOOLBOXES = 20;
export const MAX_TRAY_ROWS = 8;
export const TOOLS_PER_ROW = 3;
export const PALETTES_PER_TRAY = 3;

/** Balanced starter rows. Four supplies become 2 + 2, five become 3 + 2. */
export function trayRows(supplies: string[]): string[][] {
  const count = Math.ceil(supplies.length / TOOLS_PER_ROW);
  const rows: string[][] = [];
  let offset = 0;
  for (let row = 0; row < count; row++) {
    const size = Math.ceil((supplies.length - offset) / (count - row));
    rows.push(supplies.slice(offset, offset + size));
    offset += size;
  }
  return rows;
}

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
  if (box.id === EVERYTHING || (!box.rows && !box.supplies.length)) return [...order];
  return order.filter((id) => box.supplies.includes(id));
}
/** A new custom toolbox, starting from another one's supplies. */
export function makeToolbox(name: string, from: Toolbox, all: string[], id: string = crypto.randomUUID()): Toolbox {
  const supplies = from.id === EVERYTHING || !from.supplies.length ? [...all] : from.supplies.filter((s) => all.includes(s));
  return {
    id, name: name.trim().slice(0, 40) || 'My toolbox', supplies,
    ...(from.rows ? { rows: from.rows.map(row => [...row]) } : {}),
    ...(from.paletteIds ? { paletteIds: [...from.paletteIds] } : {})
  };
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
    let rows: string[][] | undefined;
    if (box.rows !== undefined) {
      if (!Array.isArray(box.rows) || box.rows.length > MAX_TRAY_ROWS) throw new Error('Invalid toolbox rows.');
      const placed = new Set<string>();
      rows = box.rows.map(row => {
        if (!Array.isArray(row) || row.length > TOOLS_PER_ROW) throw new Error('Invalid toolbox row.');
        return row.filter((id): id is string => {
          if (typeof id !== 'string' || !ids.includes(id) || placed.has(id)) return false;
          placed.add(id);
          return true;
        });
      });
    }
    if (box.paletteIds !== undefined && (!Array.isArray(box.paletteIds) || box.paletteIds.length > PALETTES_PER_TRAY || !box.paletteIds.every(id => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id)))) throw new Error('Invalid toolbox palettes.');
    return {
      id: box.id, name: box.name,
      supplies: rows ? rows.flat() : [...new Set(box.supplies.filter((s): s is string => typeof s === 'string' && ids.includes(s)))],
      ...(rows ? { rows } : {}),
      ...(box.paletteIds ? { paletteIds: [...new Set(box.paletteIds)] } : {})
    };
  });
}
