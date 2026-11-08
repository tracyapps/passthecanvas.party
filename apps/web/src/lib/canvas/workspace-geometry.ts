import { constrainSupply, type SupplyRect } from './placement';
import { GRID_TILE, SUPPLIES } from './supplies';
import type { WorkspaceLayout, WorkspaceSurface } from './workspaces';

export function compactSurface(surface: WorkspaceSurface): boolean {
  return surface.width <= 1100 || surface.height <= 720 || surface.width / surface.height < 1.35;
}

/** Keep the canvas below the same controls in the desk and its editor. */
export function canvasTop(surface: WorkspaceSurface): number {
  return surface.headerHeight + surface.toolbarHeight + 8;
}

export function viewTransform(source: WorkspaceSurface, target: WorkspaceSurface) {
  const scale = Math.min(
    target.width / source.width,
    (target.height - target.headerHeight) / (source.height - source.headerHeight)
  );
  return {
    scale,
    x: (target.width - source.width * scale) / 2,
    y: target.headerHeight - source.headerHeight * scale,
  };
}

export function projectRect(
  rect: SupplyRect,
  source: WorkspaceSurface,
  target: WorkspaceSurface
): SupplyRect {
  const fit = viewTransform(source, target);
  return {
    x: rect.x * fit.scale + fit.x,
    y: rect.y * fit.scale + fit.y,
    width: rect.width * fit.scale,
    height: rect.height * fit.scale,
  };
}

export function designPoint(
  x: number,
  y: number,
  source: WorkspaceSurface,
  target: WorkspaceSurface
) {
  const fit = viewTransform(source, target);
  return { x: (x - fit.x) / fit.scale, y: (y - fit.y) / fit.scale };
}

export function workspaceGeometry(
  layout: WorkspaceLayout,
  target: WorkspaceSurface,
  aspect = 4 / 3
) {
  const source = layout.dock === 'surround' ? (layout.surface ?? target) : target;
  const compact = compactSurface(target);
  const surface = compact ? target : source;
  const { width, height, headerHeight, toolbarHeight } = surface;
  const ids = layout.order.filter((id) => layout.supplies?.includes(id) ?? true);
  const grid = layout.toolView === 'grid';
  const scale = Math.min(width / 1440, height / 1024);
  const rows = Math.max(
    1,
    Math.floor((height - headerHeight - 32) / (GRID_TILE.height + GRID_TILE.gap))
  );
  const gridWidth = 28 + Math.ceil(ids.length / rows) * (GRID_TILE.width + GRID_TILE.gap);
  const freeGrid = grid && layout.dock === 'surround';
  const left = freeGrid
    ? gridWidth
    : layout.dock === 'right'
      ? 24
      : layout.dock === 'left' || layout.dock === 'both'
        ? Math.min(360, width * 0.3)
        : Math.max(width * 0.18, 352 * scale);
  const right =
    layout.dock === 'right' || layout.dock === 'both'
      ? Math.min(360, width * 0.3)
      : layout.dock === 'left' || freeGrid
        ? 24
        : Math.max(width * 0.12, 260 * scale + 40);
  const available = Math.max(300, width - left - right);
  const bottom = freeGrid || layout.dock !== 'surround' ? 56 : 250 * scale + 20;
  const frameWidth = Math.min(
    available,
    Math.max(260, (height - headerHeight - toolbarHeight - 16 - bottom) * aspect)
  );
  let frame: SupplyRect = {
    x: left + (available - frameWidth) / 2,
    y: headerHeight + toolbarHeight + 16,
    width: frameWidth,
    height: frameWidth / aspect,
  };
  if (layout.frame)
    frame = {
      x: (layout.frame.x ?? frame.x / width) * width,
      y: (layout.frame.y ?? frame.y / height) * height,
      width: layout.frame.width * width,
      height: layout.frame.height * height,
    };
  if (compact) {
    const w = Math.min(width - 24, height * 0.58 * aspect);
    frame = {
      x: (width - w) / 2,
      y: headerHeight + toolbarHeight + 28,
      width: w,
      height: w / aspect,
    };
  }
  const boxes: Record<string, SupplyRect> = {};
  for (const id of ids) {
    const supply = SUPPLIES.find((supply) => supply.id === id);
    if (!supply) continue;
    const index = ids.indexOf(id);
    if (compact) {
      const minimum = Math.max(100, Math.min(168, width * 0.13));
      const columns = Math.max(1, Math.floor((width - 24 + 8) / (minimum + 8)));
      const w = (width - 24 - (columns - 1) * 8) / columns;
      boxes[id] = {
        x: 12 + (index % columns) * (w + 8),
        y:
          frame.y +
          frame.height +
          32 +
          Math.floor(index / columns) *
            ((grid ? 144 : Math.max(122, Math.min(170, width * 0.12))) + 12),
        width: w,
        height: grid ? 144 : Math.max(122, Math.min(170, width * 0.12)),
      };
      continue;
    }
    if (layout.dock !== 'surround') {
      const rail = Math.min(320, width * 0.27);
      const split = Math.ceil(ids.length / 2);
      const rightSide = layout.dock === 'right' || (layout.dock === 'both' && index >= split);
      const local = layout.dock === 'both' && index >= split ? index - split : index;
      const tileWidth = layout.dock === 'both' ? Math.min(140, width * 0.12) : (rail - 8) / 2;
      boxes[id] = {
        x: (rightSide ? width - 12 - (tileWidth * 2 + 8) : 12) + (local % 2) * (tileWidth + 8),
        y: headerHeight + 12 + Math.floor(local / 2) * ((grid ? 144 : 128) + 8),
        width: tileWidth,
        height: grid ? 144 : 128,
      };
      continue;
    }
    const saved = layout.positions[id];
    let box: SupplyRect;
    if (grid) {
      box = {
        x: saved ? saved.x * width : 12 + Math.floor(index / rows) * 112,
        y: saved ? saved.y * height : headerHeight + 12 + (index % rows) * 152,
        width: GRID_TILE.width,
        height: GRID_TILE.height,
      };
    } else {
      const w = supply.box[2] * scale,
        h = supply.box[3] * scale;
      box = {
        x: saved ? saved.x * width : (supply.box[0] / 1440) * width,
        y: saved ? saved.y * height : (supply.box[1] / 1024) * height,
        width: w,
        height: h,
      };
      if (!saved && supply.tip) {
        if (['pencil', 'knife', 'foam'].includes(id)) box.y = height - h * 0.78;
        else box.x = width - w * 0.78;
      }
      if (!saved && id === 'burnisher' && boxes.sponge) {
        box.x = boxes.sponge.x + boxes.sponge.width * 0.7;
        box.y = boxes.sponge.y + boxes.sponge.height * 0.57;
      }
    }
    const tip =
      !grid && supply.tip
        ? {
            x: supply.tip[0] * scale,
            y: supply.tip[1] * scale,
            width: supply.tip[2] * scale,
            height: supply.tip[3] * scale,
          }
        : undefined;
    const avoid =
      !saved && !grid
        ? {
            x: frame.x - 12,
            y: frame.y - toolbarHeight - 16,
            width: frame.width + 24,
            height: frame.height + toolbarHeight + 56,
          }
        : undefined;
    boxes[id] = constrainSupply(
      box,
      { x: 0, y: headerHeight, width, height: Math.max(200, height - headerHeight) },
      tip,
      avoid
    );
  }
  if (!compact && layout.surface && layout.dock === 'surround') {
    for (const id of Object.keys(boxes)) boxes[id] = projectRect(boxes[id], source, target);
    frame = projectRect(frame, source, target);
  }
  return { frame, boxes, compact };
}
