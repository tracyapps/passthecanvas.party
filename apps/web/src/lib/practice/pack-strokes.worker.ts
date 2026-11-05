/**
 * Turns strokes into gzipped base64 off the main thread, so saving never
 * freezes the brush (iPad). Strokes never change once painted, so the worker
 * keeps the text it already made and only adds the new ones each time.
 */
let text = '';
self.onmessage = async (event: MessageEvent<{ id: number; reset: boolean; add: unknown[] }>) => {
  const { id, reset, add } = event.data;
  try {
    if (reset) text = '';
    if (add.length) {
      const more = add.map((stroke) => JSON.stringify(stroke)).join(',');
      text = text ? `${text},${more}` : more;
    }
    const gzipped = await new Response(new Blob([`[${text}]`]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    const bytes = new Uint8Array(await gzipped.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    self.postMessage({ id, packed: btoa(binary) });
  } catch (cause) {
    self.postMessage({ id, error: cause instanceof Error ? cause.message : 'Could not pack strokes.' });
  }
};
