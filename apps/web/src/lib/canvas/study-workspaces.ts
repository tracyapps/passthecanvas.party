// Browser-only saved views. Account persistence can later store the same layout
// behind an authenticated API; no canvas image or painting identity lives here.
export type ToolDock = 'surround' | 'left' | 'right' | 'both';
export interface WorkspaceLayout {
  positions: Record<string, { x: number; y: number }>;
  order: string[];
  dock: ToolDock;
  frame: { width: number; height: number } | null;
  rotation: number;
}
export interface SavedWorkspace { id: string; name: string; layout: WorkspaceLayout }
export interface WorkspaceState { version: 1; current: WorkspaceLayout; views: SavedWorkspace[]; selected: string }
export const WORKSPACE_KEY = 'ptc-painting-workspaces-v1';
export function defaultLayout(ids: string[]): WorkspaceLayout {
  return { positions: {}, order: [...ids], dock: 'surround', frame: null, rotation: 0 };
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
    layout.frame = { ...source.frame };
  }
  layout.dock = source.dock; layout.rotation = source.rotation;
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
  return { version: 1, current: readLayout(value.current, ids), views, selected: typeof value.selected === 'string' && used.has(value.selected) ? value.selected : '' };
}
