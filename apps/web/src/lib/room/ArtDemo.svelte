<!--
  Wall gallery preview (?demo=art): shows the room with placeholder artwork
  corner-pinned into every canvas quad from art.json — a way to judge how
  finished pieces will sit on the walls before the hang-and-export feature
  exists. Nothing is saved and no party is involved.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Viewer, events } from '@photo-sphere-viewer/core';
  import type { ArtFile, ArtRegion } from '@ptc/shared';
  import ArtLayer from './ArtLayer.svelte';
  import '@photo-sphere-viewer/core/index.css';

  const PANORAMA = '/studio/cream-city/panorama.webp';
  const ART_URL = '/studio/cream-city/art.json';

  let container: HTMLDivElement;
  // $state.raw: reactive reference without deep-proxying the viewer —
  // Photo Sphere Viewer's internals break behind a $state proxy.
  let viewer = $state.raw<Viewer | null>(null);
  let viewerReady = $state(false);
  let art = $state<ArtRegion[]>([]);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  onMount(async () => {
    const response = await fetch(ART_URL);
    const file: ArtFile = await response.json();
    art = file.art ?? [];

    viewer = new Viewer({
      container,
      panorama: PANORAMA,
      defaultYaw: 0,
      defaultPitch: '-5deg',
      navbar: false,
      keyboard: 'fullscreen',
      moveInertia: !reducedMotion
    });
    viewer.addEventListener(events.ReadyEvent.type, () => (viewerReady = true));
  });

  onDestroy(() => viewer?.destroy());
</script>

<main class="demo">
  <p class="tape">Wall gallery preview</p>
  <p class="status">
    {art.length} canvas {art.length === 1 ? 'box' : 'boxes'} from art.json, each holding a generated placeholder
    painting. Look around — the pieces stay pinned to their walls. Nothing is saved.
  </p>

  <div class="stage">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex — the panorama is a custom interactive widget (drag or arrow keys), so it must be a tab stop -->
    <div
      class="viewer"
      bind:this={container}
      tabindex="0"
      role="application"
      aria-label="Studio room with placeholder artwork on the walls. Use the arrow keys to look around."
    ></div>
    {#if viewerReady && viewer}
      <ArtLayer {viewer} {art} />
    {/if}
  </div>
</main>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .demo {
    @include walnut-table;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    color: $cream;
  }

  .tape {
    @include tape-label;
    margin: 0;
    font-size: 1.25rem;
  }

  .status {
    margin: 0;
    font-size: 0.875rem;
    color: $cream-muted;
  }

  .stage {
    position: relative; // the art layer overlays the viewer
    flex: 1;
    min-height: 70vh;
    border-radius: $radius-sm;
    overflow: hidden;
  }

  .viewer {
    position: absolute;
    inset: 0;

    &:focus-visible {
      outline: 3px solid $focus;
      outline-offset: -3px;
    }
  }
</style>
