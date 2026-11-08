import type { PaintingTool, PaintingMedium } from './painting-selection';
const images = import.meta.glob('./supplies/{study-*,compact-*}.{svg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
export function supplyAsset(name: string, extension = 'svg'): string {
  return images[`./supplies/study-${name}.${extension}`] ?? '';
}
export const GRID_TILE = { width: 104, height: 144, gap: 8 };
export const SUPPLIES: {
  id: string;
  name: string;
  box: number[];
  hit?: number[];
  tip?: number[];
  tool?: PaintingTool;
  medium?: PaintingMedium;
}[] = [
  {
    id: 'acrylic',
    name: 'Acrylic paints',
    box: [0, 0, 320, 230],
    hit: [160, 12, 150, 140],
    medium: 'acrylic',
  },
  { id: 'tray', name: 'Color mixing tray', box: [0, 190, 200, 180] },
  { id: 'pastel', name: 'Pastels', box: [0, 460, 230, 200], tool: 'pastel', medium: 'pastel' },
  {
    id: 'charcoal',
    name: 'Charcoal',
    box: [0, 630, 240, 205],
    tool: 'charcoal',
    medium: 'charcoal',
  },
  { id: 'water', name: 'Water', box: [0, 800, 170, 220], hit: [0, 810, 125, 190] },
  {
    id: 'eraser',
    name: 'Eraser',
    box: [120, 895, 125, 125],
    hit: [125, 945, 85, 75],
    tool: 'eraser',
  },
  {
    id: 'sponge',
    name: 'Texture sponge',
    box: [175, 860, 170, 175],
    hit: [215, 880, 120, 140],
    tool: 'sponge',
  },
  { id: 'burnisher', name: 'Burnishing pad', box: [230, 730, 160, 115], tool: 'burnisher' },
  { id: 'watercolor', name: 'Watercolor paints', box: [350, 845, 430, 170], medium: 'watercolor' },
  {
    id: 'pencil',
    name: 'Pencils',
    box: [785, 810, 205, 280],
    tip: [0, 0, 205, 130],
    tool: 'pencil',
    medium: 'pencil',
  },
  {
    id: 'knife',
    name: 'Palette knives',
    box: [965, 805, 230, 290],
    tip: [20, 0, 190, 155],
    tool: 'knife',
  },
  {
    id: 'foam',
    name: 'Foam brushes',
    box: [1140, 855, 200, 240],
    tip: [0, 0, 180, 140],
    tool: 'foam',
  },
  {
    id: 'flat',
    name: 'Flat brushes',
    box: [1220, 740, 340, 340],
    tip: [0, 0, 260, 200],
    tool: 'flat',
  },
  {
    id: 'fan',
    name: 'Fan brush',
    box: [1280, 610, 250, 235],
    tip: [10, 10, 120, 110],
    tool: 'fan',
  },
  {
    id: 'round',
    name: 'Round brush',
    box: [1300, 485, 220, 205],
    tip: [0, 0, 105, 100],
    tool: 'round',
  },
  {
    id: 'detail',
    name: 'Detail brush',
    box: [1300, 370, 240, 230],
    tip: [0, 0, 90, 90],
    tool: 'detail',
  },
  {
    id: 'airbrush',
    name: 'Airbrush',
    box: [1280, 225, 255, 170],
    tip: [0, 35, 160, 130],
    tool: 'airbrush',
  },
];
export function supplyImage(id: string, view: 'cutouts' | 'grid' | 'tray' = 'cutouts'): string {
  if (view !== 'cutouts') {
    const preview =
      view === 'grid' && (id === 'acrylic' || id === 'watercolor') ? 'paint-chips' : id;
    return images[`./supplies/compact-${preview}.webp`];
  }
  return supplyAsset(id, id === 'burnisher' ? 'webp' : 'svg');
}
