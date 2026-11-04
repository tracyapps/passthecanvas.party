/**
 * Hand a file to the person: the share sheet on phones and tablets (so an
 * image can go straight to Photos), a normal download everywhere else.
 * iPad and iPhone Safari ignore `download` on data: links, which is why the
 * old "Download PNG" did nothing there; a Blob URL or the share sheet works.
 *
 * Call it straight from a click or tap: the share sheet needs that gesture.
 * Resolves to what happened, so the page can say so honestly.
 */
export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

export async function saveFile(blob: Blob, filename: string, title = filename): Promise<SaveOutcome> {
  const touch = matchMedia('(pointer: coarse)').matches || /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (touch && typeof navigator.share === 'function' && typeof File === 'function') {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return 'cancelled';
        // Sharing refused for another reason: fall through to a download.
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link); // Safari only follows links that are in the page
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}

/** A data: URL (from canvas.toDataURL) as a Blob, synchronously, so a tap's gesture isn't lost. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',', 2);
  const type = /data:([^;]+)/.exec(head ?? '')?.[1] ?? 'application/octet-stream';
  const binary = atob(body ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** A safe file name from a title: "My Sunset!" → "my-sunset". */
export function fileSlug(title: string, fallback: string): string {
  return title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || fallback;
}
