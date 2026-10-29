<!--
  Artwork pinned into the 360° room. Each hang is an image plus four
  yaw/pitch corners: on every camera move, the corners are projected to
  screen points and a CSS matrix3d homography maps the image onto them — so
  the piece appears painted onto the wall (or leaning where it was placed)
  and stays put as you look around. Overlay only: pointer-events none.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { events, type Viewer } from '@photo-sphere-viewer/core';
  import type { ArtCorner } from '@ptc/shared';
  import { homography3d, type Point } from './homography';

  export interface Hang {
    id: string; // unique per piece placement (region + piece index)
    corners: ArtCorner[]; // TL, TR, BR, BL
    painting: HTMLCanvasElement; // the image, sized to the quad's shape
  }

  let { viewer, hangs = [] }: { viewer: Viewer; hangs?: Hang[] } = $props();

  const DEG = Math.PI / 180;

  /** Screen-space transforms, recomputed on every camera move. */
  let transforms = $state<(string | null)[]>([]);

  /** The last projected corners per hang, for the export renderer. */
  let screenCorners = new Map<string, Point[] | null>();

  // Copy each painting into its on-screen canvas once it exists.
  let shown = $state<HTMLCanvasElement[]>([]);
  $effect(() => {
    shown.forEach((el, i) => {
      el.getContext('2d')?.drawImage(hangs[i].painting, 0, 0);
    });
  });

  $effect(() => {
    update();
    viewer.addEventListener(events.PositionUpdatedEvent.type, update);
    viewer.addEventListener(events.ZoomUpdatedEvent.type, update);
    viewer.addEventListener(events.SizeUpdatedEvent.type, update);
    return () => {
      viewer.removeEventListener(events.PositionUpdatedEvent.type, update);
      viewer.removeEventListener(events.ZoomUpdatedEvent.type, update);
      viewer.removeEventListener(events.SizeUpdatedEvent.type, update);
    };
  });

  onDestroy(() => {
    /* the effect cleanup removes the listeners */
  });

  /** What the export renderer needs: each visible hang's painting + screen corners. */
  export function getScreenPieces(): { id: string; painting: HTMLCanvasElement; pts: Point[] }[] {
    const out: { id: string; painting: HTMLCanvasElement; pts: Point[] }[] = [];
    for (const hang of hangs) {
      const pts = screenCorners.get(hang.id);
      if (pts) out.push({ id: hang.id, painting: hang.painting, pts });
    }
    return out;
  }

  function update() {
    const viewYaw = viewer.getPosition().yaw / DEG;
    const next: (string | null)[] = [];
    screenCorners = new Map();
    for (const hang of hangs) {
      // Unwrap yaws relative to the first corner, so a quad crossing the
      // back seam (yaw ±180) stays one connected shape.
      const anchor = hang.corners[0].yaw;
      const unwrap = (yaw: number) => yaw + 360 * Math.round((anchor - yaw) / 360);

      // Hide pieces round the back, where the projection wraps wildly.
      const a = unwrap(hang.corners[0].yaw);
      const c = unwrap(hang.corners[2].yaw);
      const centerYaw = (a + c) / 2;
      const dYaw = Math.abs((((centerYaw - viewYaw) % 360) + 540) % 360 - 180);
      if (dYaw > 100) {
        next.push(null);
        screenCorners.set(hang.id, null);
        continue;
      }

      const pts: Point[] = hang.corners.map((corner) =>
        viewer.dataHelper.sphericalCoordsToViewerCoords({
          yaw: unwrap(corner.yaw) * DEG,
          pitch: corner.pitch * DEG
        })
      );
      const src: Point[] = [
        { x: 0, y: 0 },
        { x: hang.painting.width, y: 0 },
        { x: hang.painting.width, y: hang.painting.height },
        { x: 0, y: hang.painting.height }
      ];
      const m = homography3d(src, pts);
      next.push(m ? `matrix3d(${m.join(',')})` : null);
      screenCorners.set(hang.id, m ? pts : null);
    }
    transforms = next;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions — a purely visual overlay -->
<div class="art-layer" aria-hidden="true">
  {#each hangs as hang, i (hang.id)}
    {#if transforms[i]}
      <canvas
        bind:this={shown[i]}
        class="piece"
        data-art={hang.id}
        width={hang.painting.width}
        height={hang.painting.height}
        style="transform: {transforms[i]};"
      ></canvas>
    {/if}
  {/each}
</div>

<style lang="scss">
  .art-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .piece {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    display: block;
    // A soft contact shadow where the piece meets the wall, so it reads as
    // a real object rather than a sticker.
    filter: drop-shadow(0 2px 6px rgb(0 0 0 / 0.35));
  }
</style>
