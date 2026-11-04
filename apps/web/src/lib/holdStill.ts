/**
 * For drawing surfaces on touch screens: a finger or pencil moving here never
 * scrolls the page or starts a text selection. `touch-action: none` alone isn't
 * always honored by iPad Safari/Chrome (and not at all on the margins around a
 * drawing), so this also cancels the browser's own touch scrolling.
 * Use as `use:holdStill` on the element that wraps the drawing.
 */
export function holdStill(node: Element) {
  const stop = (event: Event) => { if (event.cancelable) event.preventDefault(); };
  node.addEventListener('touchmove', stop, { passive: false });
  // Holding a finger still (before drawing) mustn't pop up iOS's select/copy menu.
  node.addEventListener('selectstart', stop);
  node.addEventListener('contextmenu', stop);
  return { destroy() { node.removeEventListener('touchmove', stop); node.removeEventListener('selectstart', stop); node.removeEventListener('contextmenu', stop); } };
}
