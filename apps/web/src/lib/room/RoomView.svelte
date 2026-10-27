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
    /** Your own camera track, shown live at your seat. Null while the camera is off. */
    previewTrack?: MediaStreamTrack | null;
  }
  let { panorama, spotsUrl, previewTrack = null }: Props = $props();

  let container: HTMLDivElement;
  let viewer: Viewer | null = null;
  let viewerReady = $state(false);
  let spots = $state<Spot[]>([]);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  onMount(async () => {
    const response = await fetch(spotsUrl);
    spots = (await response.json()).spots ?? [];

    // Phase-1 spike: your own webcam hangs at the first spot (the painting
    // table) until spot picking exists in phase 3.
    const youSpot = spots[0];
    const youMarker = youSpot
      ? {
          id: 'you',
          position: { yaw: `${youSpot.yaw}deg`, pitch: `${youSpot.pitch + 8}deg` },
          html: `<figure class="you-marker"><video muted autoplay playsinline></video><figcaption>You</figcaption></figure>`,
          anchor: 'center bottom' as const,
          size: { width: 180, height: 148 }
        }
      : null;

    viewer = new Viewer({
      container,
      panorama,
      defaultYaw: 0,
      defaultPitch: '-5deg',
      navbar: false, // our own controls live in the dock
      // PSV listens for arrow keys on the window, but only acts while keyboard
      // control is enabled. We enable it while the room is focused (see the
      // focusin/focusout listeners below), so arrows never fight the rest of
      // the page.
      keyboard: 'fullscreen',
      moveInertia: !reducedMotion,
      plugins: [
        [
          MarkersPlugin,
          {
            markers: [
              ...spots.map((spot) => ({
                id: spot.id,
                position: { yaw: `${spot.yaw}deg`, pitch: `${spot.pitch}deg` },
                html: `<span class="spot-marker">${escapeHtml(spot.label)}</span>`,
                anchor: 'center center' as const,
                tooltip: spot.label
              })),
              ...(youMarker ? [youMarker] : [])
            ]
          }
        ]
      ]
    });
    viewerReady = true;

    // Arrow keys pan the room while it is focused (Tab reaches it below),
    // and give them back when focus leaves.
    container.addEventListener('focusin', () => viewer?.startKeyboardControl());
    container.addEventListener('focusout', () => viewer?.stopKeyboardControl());
  });

  onDestroy(() => viewer?.destroy());

  // The marker's <video> lives inside the viewer, so it may be a frame away
  // when the track first arrives. Point it at the camera when it shows up.
  $effect(() => {
    const track = previewTrack;
    if (!track || !viewerReady) return;
    requestAnimationFrame(() => {
      const el = container.querySelector<HTMLVideoElement>('.you-marker video');
      if (!el) return;
      el.srcObject = new MediaStream([track]);
      void el.play().catch(() => {});
    });
  });

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
  <!-- tabindex makes the room itself a keyboard stop; focus here to pan with arrow keys. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- the panorama is a custom interactive widget (drag or arrow keys), so it must be a tab stop -->
  <div
    class="viewer"
    bind:this={container}
    tabindex="0"
    role="application"
    aria-label="Studio room. Use the arrow keys to look around."
  ></div>

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
  @use '../../styles/mixins' as *;

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

    // The viewer sets tabindex itself so arrow keys pan; keep focus visible.
    &:focus-visible {
      outline: 3px solid $focus;
      outline-offset: -3px;
    }
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

  // Your own seat: a live camera in a paper frame, tape label underneath.
  :global(.you-marker) {
    margin: 0;
    width: 180px;
    text-align: center;
  }
  :global(.you-marker video) {
    display: block;
    width: 180px;
    height: 135px;
    object-fit: cover;
    border-radius: $radius-sm;
    border: 4px solid $paper;
    box-shadow: 0 8px 20px rgb(0 0 0 / 0.45);
    background: rgb(24 16 11 / 0.6);
  }
  :global(.you-marker figcaption) {
    @include tape-label;
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 1.125rem;
  }
</style>
