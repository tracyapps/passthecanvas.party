import { describe, expect, it } from 'vitest';
import { designPoint, projectRect, workspaceGeometry, layoutForSurface } from './workspace-geometry';
import { defaultLayout, decodeWorkspaces, mergeViewEdits, layoutMatches } from './workspaces';

const source = { width: 1440, height: 1000, headerHeight: 100, toolbarHeight: 80 };
const target = { width: 1920, height: 1080, headerHeight: 180, toolbarHeight: 80 };
const layout = {
  ...defaultLayout(['round', 'pencil']),
  toolView: 'cutouts' as const,
  supplies: ['round'],
  surface: source,
  positions: { round: { x: 0.1, y: 0.2 } },
  frame: { x: 0.35, y: 0.2, width: 0.5, height: 0.6 },
};

describe('workspace geometry and storage', () => {
  it('reopens retired toolbox-window views as cutouts with the saved tools intact', () => {
    const retired = { ...layout, toolView: 'tray' };
    const saved = { version: 1, current: retired, views: [{ id: 'old', name: 'Old', layout: retired }] };
    const decoded = decodeWorkspaces(JSON.stringify(saved), ['round', 'pencil']);
    expect(decoded.views[0].layout.toolView).toBe('cutouts');
    expect(decoded.views[0].layout.supplies).toEqual(['round']);
    expect(workspaceGeometry(decoded.views[0].layout, target).boxes.round).toBeDefined();
  });

  it('scales tool and canvas distances uniformly below the live header', () => {
    const original = workspaceGeometry(layout, source);
    const fitted = workspaceGeometry(layout, target);
    const tool = original.boxes.round;
    expect(fitted.boxes.round).toEqual(projectRect(tool, source, target));
    expect(fitted.frame).toEqual(projectRect(original.frame, source, target));
    expect(fitted.boxes.round.width / tool.width).toBeCloseTo(
      fitted.frame.width / original.frame.width
    );
    expect(designPoint(fitted.boxes.round.x, fitted.boxes.round.y, source, target)).toEqual({
      x: tool.x,
      y: tool.y,
    });
    expect(Object.keys(fitted.boxes)).toEqual(['round']);
  });

  it('keeps explicitly hidden tools and display mode across a save and reload', () => {
    const saved = {
      version: 1,
      current: layout,
      views: [{ id: 'custom', name: 'My desk', layout }],
      selected: 'custom',
    };
    const decoded = decodeWorkspaces(JSON.stringify(saved), ['round', 'pencil', 'knife']);
    expect(decoded.views[0].layout.surface).toEqual(source);
    expect(decoded.views[0].layout.supplies).toEqual(['round']);
    expect(decoded.views[0].layout.toolView).toBe('cutouts');
    expect(decoded.views[0].layout.order).toEqual(['round', 'pencil', 'knife']);
    const empty = { ...layout, supplies: [] };
    expect(workspaceGeometry(empty, source).boxes).toEqual({});
    expect(() =>
      decodeWorkspaces(
        JSON.stringify({ ...saved, current: { ...layout, surface: { ...source, height: 0 } } }),
        ['round']
      )
    ).toThrow();
  });

  it('merges account view edits without replacing a newer party desk or unrelated views', () => {
    const old = { id: 'one', name: 'Old name', layout };
    const other = { id: 'two', name: 'Other tab', layout };
    const current = { ...layout, positions: { round: { x: 0.5, y: 0.5 } } };
    const latest = { version: 1 as const, current, views: [old, other], selected: 'two' };
    const merged = mergeViewEdits(latest, [old], [{ ...old, name: 'Renamed' }]);
    expect(merged.current).toEqual(current);
    expect(merged.views.map((view) => view.name)).toEqual(['Renamed', 'Other tab']);
    expect(merged.selected).toBe('two');
    expect(mergeViewEdits(latest, [old], []).views).toEqual([other]);
  });
});

it('recognizes a restored view when storage changes the frame property order', () => {
  const saved = { ...layout, frame: { width: 0.5, height: 0.6, x: 0.35, y: 0.2 } };
  expect(layoutMatches(saved, layout)).toBe(true);
  expect(layoutMatches(saved, { ...layout, positions: { round: { x: 0.4, y: 0.3 } } })).toBe(false);
});


it('uses saved compact canvas dimensions and tool order without letting a desktop view overflow a phone', () => {
  const phone = { width: 360, height: 800, headerHeight: 160, toolbarHeight: 80 };
  const compact = { ...layout, surface: phone, supplies: ['pencil', 'round'], order: ['pencil', 'round'], frame: { width: 0.8, height: 0.3 } };
  const geometry = workspaceGeometry(compact, phone);
  expect(geometry.frame.width).toBe(288);
  expect(geometry.frame.height).toBe(240);
  expect(geometry.boxes.pencil.x).toBeLessThan(geometry.boxes.round.x);
  expect(geometry.boxes.pencil.y).toBeGreaterThan(geometry.frame.y + geometry.frame.height);
  expect(workspaceGeometry(layout, phone).frame.width).toBe(336);
  expect(workspaceGeometry({ ...compact, frame: { width: 2, height: 2 } }, phone).frame.width).toBe(336);
});


it('turns a phone design into a separately editable tablet design without changing its source', () => {
  const phone = { width: 360, height: 800, headerHeight: 160, toolbarHeight: 80 };
  const tablet = { width: 1024, height: 768, headerHeight: 120, toolbarHeight: 80 };
  const original = { ...layout, surface: phone, frame: { width: 0.8, height: 0.3 } };
  const copy = layoutForSurface(original, tablet);
  const stored = decodeWorkspaces(JSON.stringify({ version: 1, current: copy, views: [{ id: 'phone', name: 'Phone', layout: original }, { id: 'tablet', name: 'Tablet', layout: copy }] }), ['round', 'pencil']);
  expect(stored.views[0].layout.surface).toEqual(phone);
  expect(stored.views[1].layout.surface).toEqual(tablet);
  expect(workspaceGeometry(stored.views[1].layout, tablet).frame.width).toBeCloseTo(819.2);
  expect(workspaceGeometry(stored.views[1].layout, tablet).frame.height).toBeCloseTo(230.4);
  expect(original.frame).toEqual({ width: 0.8, height: 0.3 });
});

it('does not mark an applied view modified because its visibility list follows the tool order', () => {
  const saved = { ...layout, supplies: ['round', 'pencil'], order: ['pencil', 'round'] };
  expect(layoutMatches(saved, { ...saved, supplies: ['pencil', 'round'] })).toBe(true);
  expect(layoutMatches(saved, { ...saved, supplies: ['pencil'] })).toBe(false);
  expect(layoutMatches(saved, { ...saved, order: ['round', 'pencil'] })).toBe(false);
});

import { keepFrameOnSurface } from './workspace-geometry';
describe('keepFrameOnSurface', () => {
  const surface = { width: 1024, height: 768, headerHeight: 80, toolbarHeight: 60 };
  it('brings a frame dragged past the edges back on screen', () => {
    const frame = keepFrameOnSurface({ x: 900, y: 700, width: 600, height: 400 }, surface);
    expect(frame.x + frame.width).toBeLessThanOrEqual(1024);
    expect(frame.y + frame.height).toBeLessThanOrEqual(768);
    expect(frame.width).toBe(600);
  });
  it('shrinks a frame bigger than the screen, and keeps a usable minimum', () => {
    const big = keepFrameOnSurface({ x: -50, y: 0, width: 3000, height: 2000 }, surface);
    expect(big).toMatchObject({ x: 0, width: 1024 });
    expect(big.y).toBe(80 + 60 + 8);
    expect(big.y + big.height).toBe(768 - 8);
    const tiny = keepFrameOnSurface({ x: 10, y: 200, width: 20, height: 20 }, surface);
    expect(tiny).toMatchObject({ width: 260, height: 200 });
  });
  it('saved views can no longer put the frame off screen', () => {
    const wide = { width: 1440, height: 900, headerHeight: 80, toolbarHeight: 60 };
    const layout = { ...defaultLayout(['round', 'pencil']), surface: wide, frame: { x: 0.8, y: 0.8, width: 0.9, height: 0.9 } };
    const { frame } = workspaceGeometry(layout, wide);
    expect(frame.x + frame.width).toBeLessThanOrEqual(1440 + 0.01);
    expect(frame.y + frame.height).toBeLessThanOrEqual(900 + 0.01);
    // A tablet design (compact) keeps its frame inside the screen too.
    const tablet = { ...defaultLayout(['round', 'pencil']), surface, frame: { x: 0, y: 0, width: 2, height: 2 } };
    const fitted = workspaceGeometry(tablet, surface).frame;
    expect(fitted.x + fitted.width).toBeLessThanOrEqual(1024);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(768);
  });
});
