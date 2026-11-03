import { describe, expect, it } from 'vitest';
import { addPart, decodeMixes, expand, mixColor, recipeText, rememberMix, removePart, totalParts } from './recipes';

const blue = { name: 'Blue', hex: '#0000ff' };
const red = { name: 'Red', hex: '#ff0000' };

describe('tray recipes', () => {
  it('counts parts the way painters say them', () => {
    const recipe = addPart(addPart(addPart([], blue), blue), red);
    expect(recipe).toEqual([{ ...blue, parts: 2 }, { ...red, parts: 1 }]);
    expect(recipeText(recipe)).toBe('2 parts Blue, 1 part Red');
    expect(expand(recipe).map((c) => c.hex)).toEqual(['#0000ff', '#0000ff', '#ff0000']);
  });
  it('weights the even mix by parts', () => {
    expect(mixColor([{ ...blue, parts: 2 }, { ...red, parts: 1 }])).toBe('#5500aa');
  });
  it('never holds more than nine parts, and drops a color at zero', () => {
    let recipe = [{ ...blue, parts: 9 }];
    expect(addPart(recipe, red)).toBe(recipe);
    recipe = removePart([{ ...blue, parts: 1 }, { ...red, parts: 2 }], blue.hex);
    expect(recipe).toEqual([{ ...red, parts: 2 }]);
    expect(totalParts(recipe)).toBe(2);
  });
  it('reads saved mixes safely and keeps the newest first without duplicates', () => {
    expect(decodeMixes('not json')).toEqual([]);
    expect(decodeMixes(JSON.stringify([{ id: 'x', recipe: [{ name: 'Bad', hex: 'red', parts: 1 }] }]))).toEqual([]);
    const a = { id: 'a', recipe: [{ ...blue, parts: 1 }], mode: 'solid' as const };
    const b = { id: 'b', recipe: [{ ...red, parts: 1 }], mode: 'solid' as const };
    expect(rememberMix([a, b], { ...a, id: 'a2' }).map((m) => m.id)).toEqual(['a2', 'b']);
  });
});
