// A fake camera feed for the demo seating mode (?demo=seats). We paint a
// still "video screenshot" onto a canvas and capture it as a real
// MediaStreamTrack — so the room renders demo guests through the exact same
// video path a LiveKit camera will use later. No assets, no network.

const WIDTH = 320;
const HEIGHT = 240;

/** Warm, studio-ish backdrop colours so the fakes sit in the room, not on it. */
const BACKDROPS = ['#7a5c3e', '#5c6e46', '#8a6d3b', '#4e5d6b', '#6d4e5d', '#3e5c5a', '#7b4e42', '#57524a'];

export function makeFakeVideoTrack(initial: string, index: number): MediaStreamTrack {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const backdrop = BACKDROPS[index % BACKDROPS.length]!;

  drawFrame(ctx, backdrop, initial);
  // A gentle brightness drift makes it read as "live camera" instead of a
  // static image. Under reduced motion we keep it a true still frame.
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) {
    const timer = setInterval(() => drawFrame(ctx, backdrop, initial), 400);
    // Stop repainting once nobody is watching the track.
    const stream = canvas.captureStream(4);
    stream.getVideoTracks()[0]!.addEventListener('ended', () => clearInterval(timer));
    return stream.getVideoTracks()[0]!;
  }
  return canvas.captureStream(1).getVideoTracks()[0]!;
}

let frameCount = 0;

function drawFrame(ctx: CanvasRenderingContext2D, backdrop: string, initial: string) {
  frameCount++;
  // Soft light from one side, like a window: two overlapping gradients.
  const light = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  light.addColorStop(0, 'rgba(255 244 220 / 0.35)');
  light.addColorStop(1, 'rgba(0 0 0 / 0.25)');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // The guest's initial, as if they're sitting slightly off-center.
  ctx.fillStyle = 'rgba(243 234 217 / 0.9)';
  ctx.font = '700 110px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial.toUpperCase(), WIDTH / 2 + 18, HEIGHT / 2 + 8);

  // Webcam-ish grain: a few dozen semi-transparent flecks that move each
  // frame — the only part of the "photo" that changes.
  ctx.globalAlpha = frameCount % 2 === 0 ? 0.05 : 0.04;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) {
    const x = (i * 53 + frameCount * 17) % WIDTH;
    const y = (i * 97 + frameCount * 29) % HEIGHT;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Vignette so the rectangle feels like a lens, not a colored box.
  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT / 3, WIDTH / 2, HEIGHT / 2, HEIGHT);
  vignette.addColorStop(0, 'rgba(0 0 0 / 0)');
  vignette.addColorStop(1, 'rgba(0 0 0 / 0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}
