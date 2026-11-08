import { EVERYTHING, readToolboxes, type Toolbox } from './toolboxes';
// Saved arrangements contain interface geometry, never painting pixels or party state.
export type ToolDock = 'surround' | 'left' | 'right' | 'both';
export interface WorkspaceSurface { width: number; height: number; headerHeight: number; toolbarHeight: number }
export interface WorkspaceLayout {
  toolView?: 'cutouts' | 'grid' | 'tray';
  supplies?: string[];
  surface?: WorkspaceSurface;
  positions: Record<string, { x: number; y: number }>;
  order: string[];
  dock: ToolDock;
  /** The canvas window, as fractions of the screen. x/y are new; older views only kept the size. */
  frame: { x?: number; y?: number; width: number; height: number } | null;
  rotation: number;
  /** Which toolbox this view shows (missing in older views = everything). */
  toolbox?: string;
}
export interface SavedWorkspace { id: string; name: string; layout: WorkspaceLayout }
export interface WorkspaceState { version: 1; current: WorkspaceLayout; views: SavedWorkspace[]; selected: string; toolboxes?: Toolbox[] }
export const WORKSPACE_KEY = 'ptc-painting-workspaces-v1';
export function defaultLayout(ids: string[]): WorkspaceLayout {
  return { positions: {}, order: [...ids], dock: 'surround', frame: null, rotation: 0, toolbox: EVERYTHING };
}
export function gridDestination(index: number, count: number, columns: number, dx: number, dy: number): number {
  if (dy) {
    const next = index + Math.sign(dy) * columns;
    return next >= 0 && next < count ? next : index;
  }
  const next = index + Math.sign(dx);
  return next >= 0 && next < count && Math.floor(next / columns) === Math.floor(index / columns) ? next : index;
}
function readLayout(value: unknown, ids: string[]): WorkspaceLayout {
  if (!value || typeof value !== 'object') throw new Error('Invalid saved view.');
  const source = value as WorkspaceLayout;
  if (!Array.isArray(source.order) || !source.positions || typeof source.positions !== 'object' ||
    !['surround', 'left', 'right', 'both'].includes(source.dock) || !Number.isInteger(source.rotation) || source.rotation < 0 || source.rotation > 3) throw new Error('Invalid saved view.');
  const layout = defaultLayout(ids);
  layout.order = [...new Set(source.order.filter(id => typeof id === 'string' && ids.includes(id)))];
  layout.order.push(...ids.filter(id => !layout.order.includes(id)));
  for (const id of ids) {
    const point = source.positions[id];
    if (!point) continue;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 4 || Math.abs(point.y) > 4) throw new Error('Invalid tool position.');
    layout.positions[id] = { x: point.x, y: point.y };
  }
  if (source.frame !== null) {
    if (!source.frame || !Number.isFinite(source.frame.width) || !Number.isFinite(source.frame.height) || source.frame.width <= 0 || source.frame.height <= 0 || source.frame.width > 2 || source.frame.height > 2) throw new Error('Invalid window size.');
    const { x, y } = source.frame;
    const place = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 2;
    layout.frame = { width: source.frame.width, height: source.frame.height, ...(place(x) && place(y) ? { x: x as number, y: y as number } : {}) };
  }
  if (source.toolView !== undefined) {
    if (!['cutouts', 'grid', 'tray'].includes(source.toolView)) throw new Error('Invalid tool view.');
    // Retired toolbox-window views reopen as cutouts without discarding their layout.
    layout.toolView = source.toolView === 'tray' ? 'cutouts' : source.toolView;
  }
  if (source.supplies !== undefined) {
    if (!Array.isArray(source.supplies) || source.supplies.length > 32) throw new Error('Invalid view supplies.');
    layout.supplies = [...new Set(source.supplies.filter(id => typeof id === 'string' && ids.includes(id)))];
  }
  if (source.surface !== undefined) {
    const surface = source.surface;
    if (!surface || ![surface.width, surface.height].every(n => Number.isFinite(n) && n >= 1 && n <= 16384) ||
      !Number.isFinite(surface.headerHeight) || surface.headerHeight < 0 || surface.headerHeight >= surface.height ||
      !Number.isFinite(surface.toolbarHeight) || surface.toolbarHeight < 0 || surface.toolbarHeight > 600) throw new Error('Invalid view surface.');
    layout.surface = { width: surface.width, height: surface.height, headerHeight: surface.headerHeight, toolbarHeight: surface.toolbarHeight };
  }
  layout.dock = source.dock; layout.rotation = source.rotation;
  // Unknown toolboxes (one since deleted) fall back to everything when shown.
  layout.toolbox = typeof source.toolbox === 'string' && source.toolbox.length <= 80 ? source.toolbox : EVERYTHING;
  return layout;
}
export function decodeWorkspaces(raw: string, ids: string[]): WorkspaceState {
  if (raw.length > 100000) throw new Error('Saved views are too large.');
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.views) || value.views.length > 30) throw new Error('Unsupported saved views.');
  const used = new Set<string>();
  const views = value.views.map((view: SavedWorkspace) => {
    if (typeof view.id !== 'string' || typeof view.name !== 'string' || !view.name.trim() || view.name.length > 80 || used.has(view.id)) throw new Error('Invalid view name.');
    used.add(view.id);
    return { id: view.id, name: view.name, layout: readLayout(view.layout, ids) };
  });
  return { version: 1, current: readLayout(value.current, ids), views, selected: typeof value.selected === 'string' && used.has(value.selected) ? value.selected : '', toolboxes: readToolboxes(value.toolboxes, ids) };
}

/** Apply only the edited views to a newer workspace, preserving its active desk. */
export function mergeViewEdits(latest: WorkspaceState, before: SavedWorkspace[], after: SavedWorkspace[]): WorkspaceState {
  const removed = new Set(before.filter(view => !after.some(next => next.id === view.id)).map(view => view.id));
  const changed = after.filter(view => JSON.stringify(view) !== JSON.stringify(before.find(old => old.id === view.id)));
  const views = latest.views.filter(view => !removed.has(view.id)).map(view => changed.find(next => next.id === view.id) ?? view);
  views.push(...changed.filter(view => !views.some(existing => existing.id === view.id)));
  if (views.length > 30) throw new Error('Up to 30 views can be saved.');
  return { ...latest, views, selected: views.some(view => view.id === latest.selected) ? latest.selected : '' };
}

/** Stored JSON may reorder object properties. Compare values, preserving array order. */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  }
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => sameValue(a[key], b[key]));
}
export function layoutMatches(saved: WorkspaceLayout, current: WorkspaceLayout): boolean {
  return Object.entries(saved).every(([key, value]) => {
    if (key === 'frame' && value && current.frame) {
      return Object.entries(value).every(([field, number]) => number === current.frame![field as keyof NonNullable<WorkspaceLayout['frame']>]);
    }
    return sameValue(value, current[key as keyof WorkspaceLayout]);
  });
}
