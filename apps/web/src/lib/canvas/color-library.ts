import { cleanColorPalette, type ColorPalette } from '@ptc/shared';

const presets = [
  ['studio-earth', 'Studio Earth', ['Chalk #f1e6ce', 'Ochre #c19340', 'Terracotta #aa5039', 'Umber #583c30', 'Olive #68704d', 'Charcoal #292521']],
  ['lake-morning', 'Lake Morning', ['Mist #eef0ea', 'Lake blue #4c849f', 'Reed #819267', 'Fog gray #a7adb2', 'Deep water #203d54']],
  ['night-studio', 'Night Studio', ['Paper #f3dab3', 'Lamp amber #e5a54b', 'Wine #793754', 'Ink blue #253159', 'Near black #191724']],
  ['botanical', 'Botanical', ['Cream #f4ead1', 'Moss #747949', 'Fern #487656', 'Pine #214c45', 'Petal #ba6e7d']],
  ['print-shop', 'Print Shop', ['Paper #ffefdb', 'Process blue #087d9c', 'Warm pink #d84378', 'Marigold #ffc437', 'Ink #282229']],
  ['graphite-study', 'Graphite Study', ['Paper #f8f5ef', 'Silver #c4c2c0', 'Ash #93908f', 'Graphite #59575a', 'Black #222125']],
] as const;

export const BUILT_IN_PALETTES: ColorPalette[] = presets.map(([id, name, swatches]) => ({
  id, name, hidden: false, favorite: false,
  colors: swatches.map((swatch) => ({ name: swatch.slice(0, -8), hex: swatch.slice(-7) })),
}));

export function colorLibrary(saved: ColorPalette[]): ColorPalette[] {
  const library = new Map(BUILT_IN_PALETTES.map((palette) => [palette.id, palette]));
  for (const palette of saved) library.set(palette.id, palette);
  return [...library.values()];
}

export function importPalette(json: string): ColorPalette | null {
  const file = JSON.parse(json);
  if (file?.format !== 'ptc-color-palette' || file.version !== 1) return null;
  return cleanColorPalette({ id: crypto.randomUUID(), name: file.name, colors: file.colors });
}
