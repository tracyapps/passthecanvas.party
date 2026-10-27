<!--
  The 360° room. A panorama (rendered in Blender, or a Poly Haven HDRI as a
  placeholder) wraps around the viewer. Spots from spots.json become markers.
  A "Jump to" list gives keyboard and screen-reader users the same room.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Viewer } from '@photo-sphere-viewer/core';
  import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
  import '@photo-sphere-viewer/core/index.css';
  import '@photo-sphere-viewer/markers-plugin/index.css';

  export interface Spot {
    id: string; // e.g. "spot_couch_left"
    zone: string; // e.g. "couch"
    label: string; // e.g. "Couch, left cushion"
    yaw: number; // degrees, 0 = straight ahead
    pitch: number; // degrees, negative = looking down
  }

  interface Props {
    panorama: string; // URL of the equirectangular image
    spotsUrl: string; // URL of spots.json
  }
  let { panorama, spotsUrl }: Props = $props();

  let container: HTMLDivElement;
  let viewer: Viewer | null = null;
  let spots = $state<Spot[]>([]);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  onMount(async () => {
    const response = await fetch(spotsUrl);
    spots = (await response.json()).spots ?? [];

    viewer = new Viewer({
      container,
      panorama,
      defaultYaw: 0,
      defaultPitch: '-5deg',
      navbar: false, // our own controls live in the dock
      keyboard: 'always', // arrow keys pan (TODO phase 1: confirm behaviour + focus handling)
      moveInertia: !reducedMotion,
      plugins: [
        [
          MarkersPlugin,
          {
            markers: spots.map((spot) => ({
              id: spot.id,
              position: { yaw: `${spot.yaw}deg`, pitch: `${spot.pitch}deg` },
              html: `<span class="spot-marker">${escapeHtml(spot.label)}</span>`,
              anchor: 'center center',
              tooltip: spot.label
            }))
          }
        ]
      ]
    });
  });

  onDestroy(() => viewer?.destroy());

  /** Turn to face a spot. Instant under reduced motion, a short glide otherwise. */
  function lookAt(spot: Spot) {
    if (!viewer) return;
    const position = { yaw: `${spot.yaw}deg`, pitch: `${spot.pitch}deg` };
    if (reducedMotion) viewer.rotate(position);
    else viewer.animate({ ...position, speed: '4rpm' });
  }

  function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }
</script>

<section class="room" aria-label="The studio, 360 degree view">
  <div class="viewer" bind:this={container}></div>

  <nav class="jump" aria-label="Jump to a spot in the room">
    <h2>Jump to</h2>
    <ul>
      {#each spots as spot (spot.id)}
        <li><button type="button" onclick={() => lookAt(spot)}>{spot.label}</button></li>
      {/each}
    </ul>
  </nav>
</section>

<style lang="scss">
  @use '../../styles/tokens' as *;

  .room {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 15rem;
    gap: 1rem;
    height: 100%;

    @media (max-width: 760px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .viewer {
    min-height: 60vh;
    border-radius: $radius-sm;
    overflow: hidden;
  }

  .jump {
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    button {
      width: 100%;
      min-height: $tap-min;
      text-align: left;
      padding: 0 0.75rem;
      border-radius: $radius-sm;
      border: 1px solid rgb(255 230 200 / 0.2);
      background: rgb(243 234 217 / 0.06);
      color: $cream;
    }
  }

  // Marker look (rendered by the viewer, so it needs :global)
  :global(.spot-marker) {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: $radius-pill;
    background: rgb(24 16 11 / 0.85);
    color: $cream;
    font-size: 0.875rem;
    white-space: nowrap;
  }
</style>
