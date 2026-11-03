// A guest's look for avatar mode: a small image the party can show in their
// seat. Made here in the browser from a cutout avatar or a profile photo, so
// the party server only ever sees a plain PNG/WebP/JPEG (never SVG markup).

import { cutoutSvg, MAX_LOOK_CHARS, type AvatarDesign } from '@ptc/shared';

/** Seat frames are 3:4 portrait (see RoomView); looks are drawn a little bigger than shown. */
const W = 165;
const H = 220;

function encode(canvas: HTMLCanvasElement): string {
  for (const quality of [0.9, 0.75, 0.6]) {
    const url = canvas.toDataURL('image/webp', quality);
    if (url.startsWith('data:image/webp') && url.length <= MAX_LOOK_CHARS) return url;
  }
  const png = canvas.toDataURL('image/png');
  if (png.length <= MAX_LOOK_CHARS) return png;
  return canvas.toDataURL('image/jpeg', 0.7);
}

async function load(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

/** A cutout avatar as a transparent image that fits the seat frame. */
export async function cutoutLook(design: AvatarDesign): Promise<string> {
  const url = URL.createObjectURL(new Blob([cutoutSvg(design, { id: 'look', shadow: true })], { type: 'image/svg+xml' }));
  try {
    const image = await load(url);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    // The 130 × 180 sheet, centred in the 3:4 frame.
    const scale = Math.min(W / 130, H / 180);
    const w = 130 * scale, h = 180 * scale;
    canvas.getContext('2d')!.drawImage(image, (W - w) / 2, H - h, w, h);
    return encode(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A photo, center-cropped to the 3:4 seat frame. */
export async function photoLook(src: string): Promise<string> {
  const image = await load(src);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  canvas.getContext('2d')!.drawImage(image, (W - w) / 2, (H - h) / 2, w, h);
  return encode(canvas);
}
