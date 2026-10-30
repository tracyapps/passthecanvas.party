export interface StudyView { zoom: number; x: number; y: number }
export const fitView = (): StudyView => ({ zoom: 1, x: 0, y: 0 });
export function clampView(view: StudyView): StudyView {
  const zoom = Math.max(1, Math.min(6, view.zoom));
  return { zoom, x: Math.max(0, Math.min(zoom - 1, view.x)), y: Math.max(0, Math.min(zoom - 1, view.y)) };
}
/** Keep the same point under the pointer when zooming. Offsets use viewport fractions. */
export function zoomView(view: StudyView, zoom: number, focalX = 0.5, focalY = 0.5): StudyView {
  const nextZoom = Math.max(1, Math.min(6, zoom));
  return clampView({ zoom: nextZoom, x: (view.x + focalX) / view.zoom * nextZoom - focalX, y: (view.y + focalY) / view.zoom * nextZoom - focalY });
}
export function panView(view: StudyView, dx: number, dy: number): StudyView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy });
}
