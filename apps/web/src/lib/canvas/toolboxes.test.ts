import { describe, expect, it } from 'vitest';
import { BUILT_IN_TOOLBOXES, EVERYTHING, findToolbox, freshName, makeToolbox, readToolboxes, shownSupplies, trayRows } from './toolboxes';
import { decodeWorkspaces, defaultLayout } from './workspaces';

const ids = ['acrylic', 'tray', 'pastel', 'charcoal', 'water', 'eraser', 'sponge', 'pencil', 'round'];
describe('toolboxes', () => {
  it('shows everything, or just a toolbox’s supplies in the table’s order', () => {
    expect(shownSupplies(ids, findToolbox(EVERYTHING, []))).toEqual(ids);
    expect(shownSupplies(ids, findToolbox('drawing', []))).toEqual(['pastel', 'charcoal', 'eraser', 'pencil']);
  });
  it('lets one supply live in several toolboxes', () => {
    const mine = makeToolbox('Quick', findToolbox('drawing', []), ids, 'q');
    expect(shownSupplies(ids, mine)).toContain('pencil');
    expect(shownSupplies(ids, findToolbox('drawing-plus', []))).toContain('pencil');
  });
  it('copies "everything" as every supply, and picks names that aren’t taken', () => {
    expect(makeToolbox('All mine', findToolbox(EVERYTHING, []), ids, 'a').supplies).toEqual(ids);
    expect(freshName('Drawing', [])).toBe('Drawing 2');
    expect(freshName('Mine', [{ id: 'x', name: 'Mine', supplies: [] }])).toBe('Mine 2');
  });
  it('falls back to everything for a toolbox that no longer exists', () => {
    expect(findToolbox('deleted', []).id).toBe(EVERYTHING);
  });
  it('cleans stored toolboxes and refuses junk or a built-in id', () => {
    expect(readToolboxes([{ id: 'm', name: 'Mine', supplies: ['pencil', 'pencil', 'laser'] }], ids)).toEqual([{ id: 'm', name: 'Mine', supplies: ['pencil'] }]);
    expect(() => readToolboxes([{ id: BUILT_IN_TOOLBOXES[1]!.id, name: 'x', supplies: [] }], ids)).toThrow();
    expect(() => readToolboxes('nope', ids)).toThrow();
  });
  it('round-trips toolboxes and each view’s toolbox through saved views', () => {
    const layout = { ...defaultLayout(ids), toolbox: 'm' };
    const state = { version: 1, current: layout, views: [{ id: 'v', name: 'Sketching', layout }], selected: 'v', toolboxes: [{ id: 'm', name: 'Mine', supplies: ['pencil'] }] };
    const back = decodeWorkspaces(JSON.stringify(state), ids);
    expect(back.toolboxes).toEqual(state.toolboxes);
    expect(back.views[0]!.layout.toolbox).toBe('m');
    const older = decodeWorkspaces(JSON.stringify({ version: 1, current: defaultLayout(ids), views: [], selected: '' }), ids);
    expect(older.current.toolbox).toBe(EVERYTHING);
    expect(older.toolboxes).toEqual([]);
  });
});

describe('toolbox tray storage', () => {
  it('balances starter rows without leaving gaps in shorter rows', () => {
    expect(trayRows(['a', 'b', 'c', 'd'])).toEqual([['a', 'b'], ['c', 'd']]);
    expect(trayRows(['a', 'b', 'c', 'd', 'e'])).toEqual([['a', 'b', 'c'], ['d', 'e']]);
  });
  it('keeps explicit empty trays empty and preserves palette shortcuts when copied', () => {
    const tray = { id: 'mine', name: 'Mine', supplies: [], rows: [[]], paletteIds: ['studio-earth'] };
    const stored = readToolboxes([tray], ids)[0];
    expect(shownSupplies(ids, stored)).toEqual([]);
    const copy = makeToolbox('Copy', stored, ids, 'copy');
    expect(copy).toMatchObject({ supplies: [], rows: [[]], paletteIds: ['studio-earth'] });
    copy.rows![0].push('round');
    expect(stored.rows).toEqual([[]]);
  });
  it('round-trips rows and palette links, removing unavailable and duplicate tools', () => {
    const tray = { id: 'mine', name: 'Mine', supplies: ['round', 'pencil'], rows: [['round', 'round'], ['pencil', 'laser']], paletteIds: ['studio-earth'] };
    expect(readToolboxes([tray], ids)[0]).toEqual({
      ...tray, rows: [['round'], ['pencil']]
    });
    expect(() => readToolboxes([{ ...tray, rows: [['round', 'pencil', 'eraser', 'water']] }], ids)).toThrow();
    expect(() => readToolboxes([{ ...tray, paletteIds: ['a', 'b', 'c', 'd'] }], ids)).toThrow();
  });
});
