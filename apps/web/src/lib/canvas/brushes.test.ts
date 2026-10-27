import { describe, expect, it } from 'vitest';
import { TOOLS, TOOL_GROUPS, drawSegment, type BrushSettings } from './brushes';
import { mixPaint } from './paints';

describe('TOOLS', () => {
  it('has the full studio kit', () => {
    expect(TOOLS.map((t) => t.id)).toEqual([
      'round',
      'flat',
      'watercolor',
      'acrylic',
      'airbrush',
      'pencil',
      'charcoal',
      'pastel',
      'water',
      'finger',
      'sponge',
      'knife',
      'eraser'
    ]);
  });

  it('gives every tool a spoken label and hint', () => {
    for (const tool of TOOLS) {
      expect(tool.label.length).toBeGreaterThan(0);
      expect(tool.hint.length).toBeGreaterThan(0);
    }
  });

  it('groups every tool exactly once', () => {
    const grouped = TOOL_GROUPS.flatMap((g) => g.tools).sort();
    const all = TOOLS.map((t) => t.id).sort();
    expect(grouped).toEqual(all);
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});

describe('mixPaint', () => {
  it('mixing a paint with itself stays that paint (a touch darker, like real pigment)', () => {
    expect(mixPaint('#2c3f9e', '#2c3f9e')).toBe('#2b3e9b');
  });

  it('white lightens ultramarine', () => {
    const mixed = mixPaint('#2c3f9e', '#f6f3ea');
    // Every channel should land between the two parents.
    expect(mixed).toMatch(/^#[0-9a-f]{6}$/);
    expect(parseInt(mixed.slice(1, 3), 16)).toBeGreaterThan(0x2c);
    expect(parseInt(mixed.slice(1, 3), 16)).toBeLessThan(0xf6);
  });
});

describe('replay determinism', () => {
  // A fake 2D context that records every call and setting, so we can prove
  // two runs of the same segment produce the identical instruction stream.
  function recordingContext() {
    const calls: string[] = [];
    const ctx = new Proxy(
      { canvas: {} },
      {
        get: (target, prop) => {
          if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
          return (...args: unknown[]) => {
            calls.push(`${String(prop)}(${args.map((a) => JSON.stringify(a)).join(',')})`);
          };
        },
        set: (target, prop, value) => {
          calls.push(`.${String(prop)}=${JSON.stringify(value)}`);
          return Reflect.set(target, prop, value);
        }
      }
    ) as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  }

  const brush: BrushSettings = { tool: 'charcoal', color: '#1b1a19', size: 20, flow: 0.8, viscosity: 0.6 };
  const a = { x: 100.5, y: 120.25, pressure: 0.5 };
  const b = { x: 130.75, y: 140.5, pressure: 0.7 };

  it('grain and spray draw identical instruction streams every run (no Math.random)', () => {
    for (const tool of ['charcoal', 'pastel', 'airbrush', 'sponge'] as const) {
      const first = recordingContext();
      const second = recordingContext();
      drawSegment(first.ctx, { ...brush, tool }, a, b);
      drawSegment(second.ctx, { ...brush, tool }, a, b);
      expect(first.calls.length).toBeGreaterThan(0);
      expect(first.calls).toEqual(second.calls);
    }
  });
});
