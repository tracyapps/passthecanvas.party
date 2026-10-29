<!--
  Artwork pinned to the room's wall canvases. Each art.json quad gets an
  image corner-pinned to it: on every camera move, the four corners are
  projected to screen points and a CSS matrix3d homography maps the image
  onto them — so the piece appears painted onto the wall and stays put as
  you look around. Overlay only: pointer-events none, nothing clickable.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { events, type Viewer } from '@photo-sphere-viewer/core';
  import type { ArtRegion } from '@ptc/shared';
  import { homography3d, type Point } from './homography';
  import { paintPlaceholder } from './placeholderArt';

  let {
    viewer,
    art,
    /** Paintings to show, keyed by region id. Missing ids get a generated placeholder. */
    works = new Map<string, HTMLCanvasElement>()
  }: {
    viewer: Viewer;
    art: ArtRegion[];
    works?: Map<string, HTMLCanvasElement>;
  } = $props();

  const DEG = Math.PI / 180;

  /** One prepared painting per region: pixels sized from the quad's angular bounds. */
  let pieces = $derived(
    art.map((region) => {
      // Big canvases get more pixels so they stay crisp up close. The
      // fallback keeps one bad quad from taking the whole layer down.
      const ys = region.corners.map((c) => c.yaw);
      const ps = region.corners.map((c) => c.pitch);
      const width = Math.max(...ys) - Math.min(...ys);
      const height = Math.max(...ps) - Math.min(...ps);
      const w = Number.isFinite(width) ? Math.max(48, Math.round(width * 24)) : 48;
      const h = Number.isFinite(height) ? Math.max(48, Math.round(height * 24)) : 48;
      let painting = works.get(region.id);
      if (!painting) {
        painting = document.createElement('canvas');
        painting.width = w;
        painting.height = h;
        paintPlaceholder(painting, region.id);
      }
      return { region, painting, w, h };
    })
  );

  /** Screen-space transforms, recomputed on every camera move. */
  let transforms = $state<(string | null)[]>([]);

  // Copy each painting into its on-screen canvas once it exists.
  let shown = $state<HTMLCanvasElement[]>([]);
  $effect(() => {
    shown.forEach((el, i) => {
      el.getContext('2d')?.drawImage(pieces[i].painting, 0, 0);
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

  function update() {
    const viewYaw = viewer.getPosition().yaw / DEG;
    transforms = pieces.map(({ region, painting }) => {
      // Unwrap yaws relative to the first corner, so a quad crossing the
      // back seam (yaw ±180) stays one connected shape.
      const anchor = region.corners[0].yaw;
      const unwrap = (yaw: number) => yaw + 360 * Math.round((anchor - yaw) / 360);

      // Hide pieces round the back, where the projection wraps wildly.
      const a = unwrap(region.corners[0].yaw);
      const c = unwrap(region.corners[2].yaw);
      const centerYaw = (a + c) / 2;
      const dYaw = Math.abs((((centerYaw - viewYaw) % 360) + 540) % 360 - 180);
      if (dYaw > 100) return null;

      const pts: Point[] = region.corners.map((corner) =>
        viewer.dataHelper.sphericalCoordsToViewerCoords({
          yaw: unwrap(corner.yaw) * DEG,
          pitch: corner.pitch * DEG
        })
      );
      const src: Point[] = [
        { x: 0, y: 0 },
        { x: painting.width, y: 0 },
        { x: painting.width, y: painting.height },
        { x: 0, y: painting.height }
      ];
      const m = homography3d(src, pts);
      return m ? `matrix3d(${m.join(',')})` : null;
    });
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions — a purely visual overlay -->
<div class="art-layer" aria-hidden="true">
  {#each pieces as piece, i (piece.region.id)}
    {#if transforms[i]}
      <canvas
        bind:this={shown[i]}
        class="piece"
        data-art={piece.region.id}
        width={piece.w}
        height={piece.h}
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
