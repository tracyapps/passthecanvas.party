export interface SupplyRect { x: number; y: number; width: number; height: number }

function overlaps(a: SupplyRect, b: SupplyRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Keep the working end visible; the remainder of a long tool may overhang. */
export function constrainSupply(box: SupplyRect, bounds: SupplyRect, priority?: SupplyRect, canvas?: SupplyRect): SupplyRect {
  const keep = priority ?? { x: 0, y: 0, width: box.width, height: box.height };
  function clamp(x: number, y: number): SupplyRect {
    return { ...box,
      x: Math.max(bounds.x - keep.x, Math.min(bounds.x + bounds.width - keep.x - keep.width, x)),
      y: Math.max(bounds.y - keep.y, Math.min(bounds.y + bounds.height - keep.y - keep.height, y)) };
  }
  function workingEnd(candidate: SupplyRect): SupplyRect {
    return { ...keep, x: candidate.x + keep.x, y: candidate.y + keep.y };
  }
  const placed = clamp(box.x, box.y);
  if (!canvas || !overlaps(workingEnd(placed), canvas)) return placed;

  // Project onto the nearest clear edge, using the same rule for defaults,
  // pointer dragging, keyboard movement and viewport changes.
  const candidates = [
    clamp(canvas.x - keep.width - keep.x, placed.y),
    clamp(canvas.x + canvas.width - keep.x, placed.y),
    clamp(placed.x, canvas.y - keep.height - keep.y),
    clamp(placed.x, canvas.y + canvas.height - keep.y)
  ].filter(candidate => !overlaps(workingEnd(candidate), canvas));
  candidates.sort((a, b) => Math.hypot(a.x - box.x, a.y - box.y) - Math.hypot(b.x - box.x, b.y - box.y));
  return candidates[0] ?? placed;
}
