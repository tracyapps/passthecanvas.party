<!--
  The 360° room. A panorama (Blender render or composite) wraps around the
  viewer. Spots from spots.json become seats: guests sit at them with their
  camera or an initials card, and free seats say "Sit here".
  The "Jump to" list gives keyboard and screen-reader users the same room.
-->
<script lang="ts">
  import { onDestroy, onMount, type Snippet } from 'svelte';
  import { Viewer, events } from '@photo-sphere-viewer/core';
  import { MarkersPlugin, events as markerEvents } from '@photo-sphere-viewer/markers-plugin';
  import type { MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
  import { attachTrack, type GuestVideo } from '../call/call.svelte';
  import { INITIALS_COLORS, initialsOf, type Member, type Spot } from '@ptc/shared';
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
    /** Room tool: spots given directly (live edits) instead of fetched from spotsUrl. */
    spots?: Spot[];
    /** Room tool: a click on the panorama itself (not a marker), in degrees. */
    onPanoramaClick?: (yaw: number, pitch: number) => void;
    /** Room tool: the seat being edited gets a highlight ring. */
    selectedId?: string | null;
    /** Extra layers inside the panorama (artwork), given the live viewer. */
    overlay?: Snippet<[Viewer]>;
    /** Avatar pictures by member id (cutouts or photos), shown when someone is in avatar mode. */
    looks?: Record<string, string>;
    /** Room tool: hide the jump list (the tool has its own seat list). */
    showJump?: boolean;
  }
  let { panorama, spotsUrl, members = [], youId = null, videos = [], onTakeSpot, spots: givenSpots, onPanoramaClick, selectedId = null, overlay, showJump = true, looks = {} }: Props = $props();

  let container: HTMLDivElement;
  // $state.raw: the overlay snippet needs the viewer reactively, but PSV breaks behind a deep proxy.
  let viewer = $state.raw<Viewer | null>(null);
  let markersPlugin: MarkersPlugin | null = null;
  let viewerReady = $state(false);
  let fetchedSpots = $state<Spot[]>([]);
  let spots = $derived(givenSpots ?? fetchedSpots);
  /** Ignore the panorama click that fires together with a marker click. */
  let markerClickedAt = 0;
  const RAD = 180 / Math.PI;
  // Seat frames are portrait 3:4 (135 px tall, like before): cameras are
  // center-cropped left and right; cut-out avatars fit the shape. The marker
  // box is a little wider than the frame so name tags have room.
  const SEAT_WIDTH = 140;

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
    if (!givenSpots) {
      const response = await fetch(spotsUrl);
      fetchedSpots = (await response.json()).spots ?? [];
    }

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
      markerClickedAt = Date.now();
      if (onTakeSpot && marker.id.startsWith('seat_')) onTakeSpot(marker.id.slice('seat_'.length));
    });

    viewer.addEventListener(events.ClickEvent.type, (event) => {
      if (!onPanoramaClick || Date.now() - markerClickedAt < 150) return;
      const click = (event as events.ClickEvent).data;
      // PSV reports radians, yaw 0–2π; spots speak degrees, yaw -180–180.
      onPanoramaClick(Math.round(((((click.yaw * RAD) + 180) % 360 + 360) % 360 - 180) * 10) / 10, Math.round(click.pitch * RAD * 10) / 10);
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
    const key = seats.map((s) => `${s.spot.id}:${s.spot.yaw},${s.spot.pitch}:${s.member?.id ?? ''}:${s.track ? 'cam' : 'av'}:${s.member?.initialsColor ?? ''}:${s.member ? (looks[s.member.id] ?? '').length : 0}:${s.spot.id === selectedId ? 'sel' : ''}`).join('|');
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
    const selected = spot.id === selectedId ? ' is-selected' : '';
    if (!member) {
      return {
        id: `seat_${spot.id}`,
        position: { yaw: `${spot.yaw}deg`, pitch: `${spot.pitch}deg` },
        html: `<span class="spot-marker${selected}">${escapeHtml(spot.label)} · Sit here</span>`,
        anchor: 'center center',
        tooltip: `Sit at ${spot.label}`
      };
    }
    const initials = escapeHtml(initialsOf(member.name));
    const look = looks[member.id];
    // Camera on: their video. Off: their cutout avatar or photo, else initials on their color.
    // Look images were checked by the server (a png/jpeg/webp data URL), and are escaped here too.
    const fill = INITIALS_COLORS[member.initialsColor]?.fill ?? INITIALS_COLORS.teal.fill;
    const media = track
      ? '<video muted autoplay playsinline></video>'
      : look && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(look)
        ? `<img class="seat-look" src="${escapeHtml(look)}" alt="" />`
        : `<span class="seat-avatar" style="background:${fill}">${initials}</span>`;
    return {
      id: `seat_${spot.id}`,
      position: { yaw: `${spot.yaw}deg`, pitch: `${spot.pitch}deg` },
      html: `<figure class="seat${selected}" data-seat="${member.id}">${media}<figcaption>${escapeHtml(member.name)}</figcaption></figure>`,
      anchor: 'center bottom',
      size: { width: SEAT_WIDTH, height: 168 }
    };
  }

  /** Turn to face a spot by id (the room tool uses this when a seat is chosen). */
  export function lookAtSpot(id: string) {
    const spot = spots.find((s) => s.id === id);
    if (spot) lookAt(spot);
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

<section class="room" class:solo={!showJump} aria-label="The studio, 360 degree view">
  <!-- tabindex makes the room itself a keyboard stop; focus here to pan with arrow keys. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- the panorama is a custom interactive widget (drag or arrow keys), so it must be a tab stop -->
  <div
    class="viewer"
    bind:this={container}
    tabindex="0"
    role="application"
    aria-label="Studio room. Use the arrow keys to look around."
  >
    {#if viewer && viewerReady && overlay}
      <!-- Above the panorama (z 0), below the seat markers (z 10): guests stand in front of the art. -->
      <div class="overlay">{@render overlay(viewer)}</div>
    {/if}
  </div>

  {#if showJump}
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
  {/if}
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
    &.solo {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .viewer {
    position: relative;
    min-height: 60vh;
    border-radius: $radius-sm;
    overflow: hidden;

    // The viewer sets tabindex itself so arrow keys pan; keep focus visible.
    &:focus-visible {
      outline: 3px solid $focus;
      outline-offset: -3px;
    }
  }

  .overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
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
    width: 140px;
    text-align: center;
  }
  :global(.seat video) {
    display: block;
    width: 101px; // 3:4 portrait; object-fit: cover crops the camera's sides evenly
    height: 135px;
    margin-inline: auto;
    object-fit: cover;
    border-radius: $radius-sm;
    border: 4px solid $paper;
    box-shadow: 0 8px 20px rgb(0 0 0 / 0.45);
    background: rgb(24 16 11 / 0.6);
  }
  :global(.seat-avatar) {
    display: grid;
    place-items: center;
    width: 101px;
    height: 135px;
    margin-inline: auto;
    border-radius: $radius-sm;
    border: 4px solid $paper;
    background: $paper;
    color: #fff; // on their chosen color (inline), each 4.5:1 or better
    font-family: $font-display;
    font-weight: 800;
    font-size: 3rem;
    box-shadow: 0 8px 20px rgb(0 0 0 / 0.45);
  }
  // Room tool: the seat being placed.
  :global(.spot-marker.is-selected),
  :global(.seat.is-selected video),
  :global(.seat.is-selected .seat-avatar) {
    outline: 4px solid $focus;
    outline-offset: 3px;
  }
  /* A cutout or photo: no paper frame (cutouts have their own edge), just a soft shadow. */
  :global(.seat-look) {
    display: block;
    width: 101px;
    height: 135px;
    margin-inline: auto;
    object-fit: contain;
    filter: drop-shadow(0 8px 10px rgb(0 0 0 / 0.45));
  }
  :global(.seat figcaption) {
    @include tape-label;
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 1.125rem;
  }
</style>
