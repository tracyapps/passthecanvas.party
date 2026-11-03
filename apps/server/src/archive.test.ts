import { describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import type { PaintedStroke, Piece } from '@ptc/shared';
import { buildArchive } from './archive.ts';

const piece = (id: string): Piece => ({
  id, ownerId: 'a', ownerName: 'Ada', shape: 'classic', width: 1600, height: 1200,
  turns: [
    { round: 1, painterId: 'a', painterName: 'Ada', url: `/snapshots/p-1/${id}-r1.png` },
    { round: 2, painterId: 'b', painterName: 'Bo', url: `/snapshots/p-1/${id}-r2.png` },
    { round: 3, painterId: 'a', painterName: 'Ada', url: null }
  ]
});
const stroke = { id: 's1', canvasId: 'c1', painterId: 'a', round: 1 } as unknown as PaintedStroke;

describe('party archive', () => {
  it('keeps the finished image and strokes when the history is whole', async () => {
    const read: string[] = [];
    const built = await buildArchive([piece('c1')], () => [stroke], async (url) => (read.push(url), Buffer.from(url)));
    expect(read).toEqual(['/snapshots/p-1/c1-r2.png']); // only the latest saved picture
    expect(built.files.map((f) => f.name)).toEqual(['c1.png', 'c1-strokes.json.gz']);
    expect(JSON.parse(gunzipSync(built.files[1]!.bytes).toString())).toEqual([stroke]);
    expect(built.pieces[0]).toMatchObject({ image: 'c1.png', strokes: 'c1-strokes.json.gz' });
    expect(built.pieces[0]!.turns.map((t) => t.painterName)).toEqual(['Ada', 'Bo', 'Ada']);
  });

  it('keeps every turn image when the strokes were too big to keep', async () => {
    const built = await buildArchive([piece('c2')], () => null, async (url) => Buffer.from(url));
    expect(built.files.map((f) => f.name)).toEqual(['c2-r1.png', 'c2.png']);
    expect(built.pieces[0]!.strokes).toBeNull();
    expect(built.pieces[0]!.turns[0]!.image).toBe('c2-r1.png');
  });
});
