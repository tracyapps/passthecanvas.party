<!--
  The 360° room. A panorama (Blender render or composite) wraps around the
  viewer. Spots from spots.json become seats: guests sit at them with their
  camera or an initials card, and free seats say "Sit here".
  The "Jump to" list gives keyboard and screen-reader users the same room.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Viewer, events } from '@photo-sphere-viewer/core';
  import { MarkersPlugin, events as markerEvents } from '@photo-sphere-viewer/markers-plugin';
  import type { MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
  import { attachTrack, type GuestVideo } from '../call/call.svelte';
  import type { Member, Spot } from '@ptc/shared';
  import '@photo-sphere-viewer/core/index.css';
  import '@photo-sphere-viewer/markers-plugin/index.css';

  interface Props {
    panorama: string; // URL of the equirectangular image
    spotsUrl: string; // URL of spots.json
    /** The party, so seats can show who is where. Optional: the room also works stand-alone. */
    members?: Member[];
    youId?: string | null;
    videos?: GuestVideo[];
    onTakeSpot?: (spotId: string) => void;
  }
  let { panorama, spotsUrl, members = [], youId = null, videos = [], onTakeSpot }: Props = $props();

  let container: HTMLDivElement;
  let viewer: Viewer | null = null;
  let markersPlugin: MarkersPlugin | null = null;
  let viewerReady = $state(false);
  let spots = $state<Spot[]>([]);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Who sits at each spot (null = free seat). */
  let seats = $derived(
    spots.map((spot) => {
      const member = members.find((m) => m.spotId === spot.id) ?? null;
      const track = member ? videos.find((v) => v.identity === member.id)?.track ?? null : null;
      return { spot, member, track };
    })
  );

  onMount(async () => {
    const response = await fetch(spotsUrl);
    spots = (await response.json()).spots ?? [];

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
      plugins: [[MarkersPlugin, { markers: [] }]]
    });
    markersPlugin = viewer.getPlugin(MarkersPlugin);

    // Sitting down by clicking a free seat in the room.
    markersPlugin.addEventListener(markerEvents.SelectMarkerEvent.type, (event) => {
      const marker = (event as markerEvents.SelectMarkerEvent).marker;
      if (onTakeSpot && marker.id.startsWith('seat_')) onTakeSpot(marker.id.slice('seat_'.length));
    });

    container.addEventListener('focusin', () => viewer?.startKeyboardControl());
    container.addEventListener('focusout', () => viewer?.stopKeyboardControl());

    // Markers set before the panorama is loaded get wiped by the plugin's
    // own init, so wait for the viewer to be ready first.
    viewer.addEventListener(events.ReadyEvent.type, () => (viewerReady = true));
  });

  onDestroy(() => viewer?.destroy());

  // Rebuild markers when seats change (who sits where, cameras on/off).
  // The key string skips rebuilds for unrelated state changes (timer ticks).
  let lastKey = '';
  $effect(() => {
    if (!viewerReady || !markersPlugin) return;
    const key = seats.map((s) => `${s.spot.id}:${s.member?.id ?? ''}:${s.track ? 'cam' : 'av'}`).join('|');
    if (key === lastKey) return;
    lastKey = key;
    markersPlugin.setMarkers(seats.map((seat) => markerFor(seat)));

    // The viewer just recreated the marker elements; attach the live videos.
    requestAnimationFrame(() => {
      for (const seat of seats) {
        if (!seat.track || !seat.member) continue;
        const el = container.querySelector<HTMLVideoElement>(`[data-seat="${seat.member.id}"] video`);
        if (el) attachTrack(el, seat.track);
      }
    });
  });

  function markerFor(seat: { spot: Spot; member: Member | null; track: MediaStreamTrack | null }): MarkerConfig {
    const { spot, member, track } = seat;
    if (!member) {
      return {
        id: `seat_${spot.id}`,
        position: { yaw: `${spot.yaw}deg`, pitch: `${spot.pitch}deg` },
        html: `<span class="spot-marker">${escapeHtml(spot.label)} · Sit here</span>`,
        anchor: 'center center',
        tooltip: `Sit at ${spot.label}`
      };
    }
    const initials = escapeHtml(member.name.trim().split(/\s+/).map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase() || '?');
    const media = track ? '<video muted autoplay playsinline></video>' : `<span class="seat-avatar">${initials}</span>`;
    return {
      id: `seat_${spot.id}`,
      position: { yaw: `${spot.yaw}deg`, pitch: `${spot.pitch}deg` },
      html: `<figure class="seat" data-seat="${member.id}">${media}<figcaption>${escapeHtml(member.name)}</figcaption></figure>`,
      anchor: 'center bottom',
      size: { width: 180, height: 168 }
    };
  }

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

  <nav class="jump" aria-label="Places in the room">
    <h2>Jump to</h2>
    <ul>
      {#each seats as seat (seat.spot.id)}
        <li>
          <button type="button" onclick={() => lookAt(seat.spot)}>{seat.spot.label}</button>
          {#if seat.member}
            <span class="who">{seat.member.name}{seat.member.id === youId ? ' (you)' : ''}</span>
          {:else if onTakeSpot}
            <button type="button" class="sit" onclick={() => onTakeSpot?.(seat.spot.id)}>
              {members.find((m) => m.id === youId)?.spotId ? 'Move here' : 'Sit here'}
            </button>
          {/if}
        </li>
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
      gap: 0.5rem;
    }
    li {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
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

      &:focus-visible {
        outline: 3px solid $focus;
        outline-offset: 2px;
      }
    }
    .sit {
      min-height: 2.5rem;
      font-size: 0.875rem;
      color: $cadmium-orange;
      border-color: rgb(232 116 42 / 0.5);
    }
    .who {
      padding-left: 0.5rem;
      font-size: 0.875rem;
      color: $cream-muted;
    }
  }

  // Seat look (rendered by the viewer, so it needs :global)
  :global(.spot-marker) {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: $radius-pill;
    background: rgb(24 16 11 / 0.85);
    color: $cream;
    font-size: 0.875rem;
    white-space: nowrap;
    cursor: pointer;
  }

  // A seated guest: their camera in a paper frame, or initials when the
  // camera is off — same seat either way.
  :global(.seat) {
    margin: 0;
    width: 180px;
    text-align: center;
  }
  :global(.seat video) {
    display: block;
    width: 180px;
    height: 135px;
    object-fit: cover;
    border-radius: $radius-sm;
    border: 4px solid $paper;
    box-shadow: 0 8px 20px rgb(0 0 0 / 0.45);
    background: rgb(24 16 11 / 0.6);
  }
  :global(.seat-avatar) {
    display: grid;
    place-items: center;
    width: 180px;
    height: 135px;
    border-radius: $radius-sm;
    border: 4px solid $paper;
    background: $paper;
    color: $walnut-900;
    font-family: $font-display;
    font-weight: 800;
    font-size: 3rem;
    box-shadow: 0 8px 20px rgb(0 0 0 / 0.45);
  }
  :global(.seat figcaption) {
    @include tape-label;
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 1.125rem;
  }
</style>
