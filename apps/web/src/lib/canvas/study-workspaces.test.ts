import { expect, it } from 'vitest';
import { defaultLayout, decodeWorkspaces, gridDestination } from './study-workspaces';
it('moves vertically by actual grid rows, without wrapping left/right', () => {
  expect(gridDestination(1, 17, 3, 0, 1)).toBe(4);
  expect(gridDestination(4, 17, 3, 0, -1)).toBe(1);
  expect(gridDestination(2, 17, 3, 1, 0)).toBe(2);
  expect(gridDestination(3, 17, 3, -1, 0)).toBe(3);
  expect(gridDestination(16, 17, 3, 0, 1)).toBe(16);
});
it('round-trips named views, restores current layout and adds newly available tools', () => {
  const layout = defaultLayout(['brush', 'paint']); layout.dock = 'left'; layout.positions.brush = { x: 0.8, y: 0.6 };
  const saved = { version: 1, current: layout, views: [{ id: 'one', name: 'Detail table', layout }], selected: 'one' };
  const loaded = decodeWorkspaces(JSON.stringify(saved), ['brush', 'paint', 'pad']);
  expect(loaded.current.order).toEqual(['brush', 'paint', 'pad']);
  expect(loaded.current.positions.brush).toEqual({ x: 0.8, y: 0.6 });
  expect(loaded.views[0].name).toBe('Detail table'); expect(loaded.selected).toBe('one');
});
it('rejects malformed or future storage instead of silently overwriting it', () => {
  expect(() => decodeWorkspaces('{broken', ['brush'])).toThrow();
  expect(() => decodeWorkspaces(JSON.stringify({ version: 2 }), ['brush'])).toThrow();
  const layout = defaultLayout(['brush']); layout.positions.brush = { x: Infinity, y: 0 };
  expect(() => decodeWorkspaces(JSON.stringify({ version: 1, current: layout, views: [] }), ['brush'])).toThrow();
});
