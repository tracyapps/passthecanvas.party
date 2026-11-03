// The mixing tray's recipe: named colors and how many parts of each.
// "2 parts ultramarine, 1 part crimson" — the way painters say it.
//
// A recipe turns into a brush load two ways:
// - Mix evenly: one color, weighted by parts (an RGB average — approximate,
//   not a pigment model).
// - Keep colors separate: streaks across the tip, each color's band as wide
//   as its parts. On the wire that's simply the color repeated per part, so
//   the stroke protocol didn't change (up to 9 parts, the load limit).
import { MAX_LOAD_COLORS } from '@ptc/shared';

export interface RecipePart { name: string; hex: string; parts: number }
export type Recipe = RecipePart[];
export const MAX_PARTS = MAX_LOAD_COLORS;

export function totalParts(recipe: Recipe): number {
  return recipe.reduce((sum, item) => sum + item.parts, 0);
}

/** One more part of a color (added at the end if it's new). Ignored when the tray is full. */
export function addPart(recipe: Recipe, paint: { name: string; hex: string }): Recipe {
  if (totalParts(recipe) >= MAX_PARTS) return recipe;
  const found = recipe.find((item) => item.hex === paint.hex);
  if (found) return recipe.map((item) => (item === found ? { ...item, parts: item.parts + 1 } : item));
  return [...recipe, { name: paint.name, hex: paint.hex, parts: 1 }];
}

/** One less part; a color with no parts left leaves the tray. */
export function removePart(recipe: Recipe, hex: string): Recipe {
  return recipe
    .map((item) => (item.hex === hex ? { ...item, parts: item.parts - 1 } : item))
    .filter((item) => item.parts > 0);
}

export function removeColor(recipe: Recipe, hex: string): Recipe {
  return recipe.filter((item) => item.hex !== hex);
}

/** Every part as its own color, in recipe order: the streaked load. */
export function expand(recipe: Recipe): { name: string; hex: string }[] {
  return recipe.flatMap((item) => Array.from({ length: item.parts }, () => ({ name: item.name, hex: item.hex })));
}

/** The even mix: each color weighted by its parts. */
export function mixColor(recipe: Recipe): string {
  const total = totalParts(recipe);
  if (!total) return '#f6f3ea';
  let result = '#';
  for (const start of [1, 3, 5]) {
    let sum = 0;
    for (const item of recipe) sum += parseInt(item.hex.slice(start, start + 2), 16) * item.parts;
    result += Math.round(sum / total).toString(16).padStart(2, '0');
  }
  return result;
}

/** "2 parts Bright blue, 1 part Rose" */
export function recipeText(recipe: Recipe): string {
  if (!recipe.length) return 'Empty';
  return recipe.map((item) => `${item.parts} ${item.parts === 1 ? 'part' : 'parts'} ${item.name}`).join(', ');
}

// ---------- saved mixes (this browser only) ----------

export interface SavedMix { id: string; recipe: Recipe; mode: 'solid' | 'multicolor' }
export const SAVED_MIXES_KEY = 'ptc-tray-mixes-v1';
export const MAX_SAVED_MIXES = 12;

/** Read saved mixes, dropping anything malformed. Never throws. */
export function decodeMixes(raw: string | null): SavedMix[] {
  if (!raw || raw.length > 50_000) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const mixes: SavedMix[] = [];
    for (const mix of value.slice(0, MAX_SAVED_MIXES)) {
      if (!mix || typeof mix.id !== 'string' || !Array.isArray(mix.recipe)) continue;
      const recipe: Recipe = mix.recipe
        .filter((item: RecipePart) => item && typeof item.name === 'string' && /^#[0-9a-f]{6}$/i.test(item.hex) && Number.isInteger(item.parts) && item.parts > 0)
        .map((item: RecipePart) => ({ name: item.name.slice(0, 80), hex: item.hex, parts: item.parts }));
      if (!recipe.length || totalParts(recipe) > MAX_PARTS) continue;
      mixes.push({ id: mix.id.slice(0, 64), recipe, mode: mix.mode === 'solid' ? 'solid' : 'multicolor' });
    }
    return mixes;
  } catch {
    return [];
  }
}

/** Newest first; saving the same recipe again moves it to the front instead of duplicating it. */
export function rememberMix(mixes: SavedMix[], mix: SavedMix): SavedMix[] {
  const same = (a: SavedMix) => a.mode === mix.mode && JSON.stringify(a.recipe) === JSON.stringify(mix.recipe);
  return [mix, ...mixes.filter((item) => !same(item))].slice(0, MAX_SAVED_MIXES);
}
