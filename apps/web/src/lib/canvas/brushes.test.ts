import { describe, expect, it } from 'vitest';
import { TOOLS } from './brushes';

describe('TOOLS', () => {
  it('has the five studio tools in jar order', () => {
    expect(TOOLS.map((t) => t.id)).toEqual(['pencil', 'round', 'flat', 'wash', 'eraser']);
  });
  it('gives every tool a spoken label', () => {
    for (const tool of TOOLS) expect(tool.label.length).toBeGreaterThan(0);
  });
});
