import { expect, it } from 'vitest';
import { screenToCanvas, zoomCamera, fitCamera } from './study-camera';
const frame = { width: 832, height: 432, documentWidth: 1600, documentHeight: 800, scale: 0.5 };
it('maps rotated and zoomed painting back into unchanged document coordinates', () => {
  const camera = { zoom: 2, x: 0, y: 0, rotation: 1 };
  expect(screenToCanvas(416, 316, camera, frame)).toEqual({ x: 900, y: 400 });
  const before = screenToCanvas(200, 100, camera, frame);
  const after = screenToCanvas(200, 100, zoomCamera(camera, 3, frame, 200, 100), frame);
  expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y);
});
it('fits portrait rotation and lets a larger window expose the table without changing zoom', () => {
  const camera = { zoom: 1, x: 0, y: 0, rotation: 1 };
  expect(fitCamera(camera, frame).zoom).toBe(0.5);
  const enlarged = { ...frame, width: 1200, height: 1000 };
  expect(screenToCanvas(600, 500, camera, enlarged)).toEqual({ x: 800, y: 400 });
  expect(screenToCanvas(0, 0, camera, enlarged).y).toBeGreaterThan(800);
});
