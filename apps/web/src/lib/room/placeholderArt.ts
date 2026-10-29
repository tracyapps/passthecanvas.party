// Placeholder artwork for the wall-canvas preview (?demo=art): little
// abstract paintings generated on a canvas so the owner can judge how real
// pieces will sit in the room. Deterministic per region id, so the same
// canvas always gets the same painting — no assets, no network.

/** Palette from the design tokens' neighbourhood (warm studio colours). */
const PALETTE = ['#c8552c', '#2f6f6a', '#d9a441', '#6d4e7c', '#3e5c5a', '#a63d40', '#e8d5a3'];

export function paintPlaceholder(canvas: HTMLCanvasElement, seed: string) {
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  let s = hash(seed);

  // Paper background with a slight warm tint.
  ctx.fillStyle = '#f3ead9';
  ctx.fillRect(0, 0, w, h);

  // A soft wash behind everything, like an underpainting.
  const wash = PALETTE[s % PALETTE.length]!;
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  // Three to six bold strokes: fat arcs and diagonals in palette colours.
  // (All seed shifts use >>> — plain >> sign-extends large seeds and once
  // produced a negative arc radius, which throws.)
  const strokes = 3 + (s % 4);
  for (let i = 0; i < strokes; i++) {
    s = next(s);
    ctx.strokeStyle = PALETTE[s % PALETTE.length]!;
    ctx.lineWidth = Math.max(1, h * (0.06 + ((s >>> 3) % 10) / 60));
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (s % 2 === 0) {
      // an arc
      const cx = w * (0.15 + ((s >>> 4) % 70) / 100);
      const cy = h * (0.2 + ((s >>> 6) % 60) / 100);
      const r = Math.max(2, h * (0.2 + ((s >>> 8) % 30) / 100));
      ctx.arc(cx, cy, r, (s % 360) * (Math.PI / 180), (s % 360) * (Math.PI / 180) + Math.PI * (0.6 + (s % 9) / 10));
    } else {
      // a diagonal slash
      ctx.moveTo(w * (0.1 + ((s >>> 4) % 70) / 100), h * (0.15 + ((s >>> 6) % 60) / 100));
      ctx.lineTo(w * (0.1 + ((s >>> 8) % 80) / 100), h * (0.2 + ((s >>> 10) % 65) / 100));
    }
    ctx.stroke();
  }

  // A pale pencil margin, like tape holding the sheet.
  ctx.strokeStyle = 'rgba(74 56 40 / 0.5)';
  ctx.lineWidth = Math.max(1, h * 0.012);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);

  // A signature scribble in the bottom-right corner.
  s = next(s);
  ctx.strokeStyle = 'rgba(40 26 18 / 0.7)';
  ctx.lineWidth = Math.max(1, h * 0.02);
  ctx.beginPath();
  const sx = w * 0.72;
  const sy = h * 0.9;
  ctx.moveTo(sx, sy);
  for (let i = 0; i < 4; i++) {
    s = next(s);
    ctx.lineTo(sx + (w * 0.05 * (i + 1)), sy + (s % 2 === 0 ? -h * 0.04 : h * 0.02));
  }
  ctx.stroke();
}

/** Small deterministic PRNG (mulberry-style) — same painting every time. */
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function next(s: number) {
  return (Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0;
}
