// The palette. Names are spoken to screen readers, so use real paint names.
// Keep in sync with $paints in styles/_tokens.scss.
export const PAINTS: { name: string; hex: string }[] = [
  { name: 'Titanium white', hex: '#f6f3ea' },
  { name: 'Ivory black', hex: '#1b1a19' },
  { name: 'Cadmium yellow', hex: '#f2c230' },
  { name: 'Cadmium orange', hex: '#e8742a' },
  { name: 'Alizarin crimson', hex: '#b3242f' },
  { name: 'Quinacridone magenta', hex: '#c23a83' },
  { name: 'Ultramarine', hex: '#2c3f9e' },
  { name: 'Cerulean', hex: '#2f8fd0' },
  { name: 'Sap green', hex: '#4f7a2a' },
  { name: 'Yellow ochre', hex: '#c99635' },
  { name: 'Burnt sienna', hex: '#8e4a24' },
  { name: "Payne's grey", hex: '#3c4a57' }
];

/**
 * Mix two paints on the palette. Real pigment is subtractive (blue + yellow
 * drift green); a weighted average is the honest first approximation, nudged
 * slightly darker because paint rarely mixes brighter than its parts.
 */
export function mixPaint(aHex: string, bHex: string, t = 0.5): string {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  const mixChannel = (x: number, y: number) => Math.round((x * (1 - t) + y * t) * 0.98);
  return rgbToHex(mixChannel(a.r, b.r), mixChannel(a.g, b.g), mixChannel(a.b, b.b));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}
