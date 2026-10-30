import { expect, it } from 'vitest';
import { editOwnedLayers } from './study-layers';
it('only supplies the artist’s own surfaces to modifying tools, including their earlier layers', () => {
  const layers = [
    { owner: 'first', surface: { pigment: 80 } },
    { owner: 'second', surface: { pigment: 50 } },
    { owner: 'first', surface: { pigment: 20 } }
  ];
  editOwnedLayers(layers, 'first', surface => surface.pigment /= 2);
  expect(layers.map(layer => layer.surface.pigment)).toEqual([40, 50, 10]);
  editOwnedLayers(layers, 'missing', surface => surface.pigment = 0);
  expect(layers[1].surface.pigment).toBe(50);
});
