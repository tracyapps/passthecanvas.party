export interface CanvasCamera { zoom: number; x: number; y: number; rotation: number }
export interface CanvasWindow { width: number; height: number; documentWidth: number; documentHeight: number; scale: number }
export function rotateVector(x: number, y: number, turns: number) {
  switch ((turns % 4 + 4) % 4) {
    case 1: return { x: -y, y: x };
    case 2: return { x: -x, y: -y };
    case 3: return { x: y, y: -x };
    default: return { x, y };
  }
}
export function screenToCanvas(x: number, y: number, camera: CanvasCamera, frame: CanvasWindow) {
  const local = rotateVector(x - frame.width / 2 - camera.x, y - frame.height / 2 - camera.y, -camera.rotation);
  const scale = frame.scale * camera.zoom;
  return { x: local.x / scale + frame.documentWidth / 2, y: local.y / scale + frame.documentHeight / 2 };
}
export function fitCamera(camera: CanvasCamera, frame: CanvasWindow): CanvasCamera {
  const rotated = camera.rotation % 2;
  const width = rotated ? frame.documentHeight : frame.documentWidth;
  const height = rotated ? frame.documentWidth : frame.documentHeight;
  return { ...camera, zoom: Math.max(0.1, Math.min(6, Math.min((frame.width - 32) / width, (frame.height - 32) / height) / frame.scale)), x: 0, y: 0 };
}
export function zoomCamera(camera: CanvasCamera, zoom: number, frame: CanvasWindow, x = frame.width / 2, y = frame.height / 2): CanvasCamera {
  const next = Math.max(0.1, Math.min(6, zoom));
  const ratio = next / camera.zoom;
  return { ...camera, zoom: next, x: x - frame.width / 2 - (x - frame.width / 2 - camera.x) * ratio, y: y - frame.height / 2 - (y - frame.height / 2 - camera.y) * ratio };
}
