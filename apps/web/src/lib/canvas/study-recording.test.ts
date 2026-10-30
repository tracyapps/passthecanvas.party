import { expect, it } from 'vitest';
import { newRecording, recordStamp } from './study-recording';
import { emptySelection, selectTool } from './painting-selection';
it('records original document coordinates, timing, owner, intensity and repeated spray independently of later edits', () => {
  const recording = newRecording(850, 1600);
  const selection = selectTool(emptySelection(), 'burnisher');
  const point = { x: 350, y: 700, pressure: .7 };
  const stamp = { at: 10, owner: 'artist-a', contribution: 2, selection, size: 30, intensity: .8, point, angle: 1, index: 1 };
  recordStamp(recording, stamp); recordStamp(recording, { ...stamp, at: 50, index: 2 });
  point.x = 5; selection.tool = 'eraser';
  const restored = JSON.parse(JSON.stringify(recording));
  expect(restored.stamps[0].point.x).toBe(350);
  expect(restored.stamps[0].selection.tool).toBe('burnisher');
  expect(restored.stamps.map((entry: { at: number }) => entry.at)).toEqual([10, 50]);
  expect(restored.width).toBe(850); expect(restored.height).toBe(1600);
  expect(restored.stamps[0].owner).toBe('artist-a'); expect(restored.stamps[0].intensity).toBe(.8);
});
