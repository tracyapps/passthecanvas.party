<!--
  The room tool (?seats=<room>): check and fix where seats show up, from
  every viewpoint, on the real panoramas.

  - Pick a viewpoint: the middle of the room, or any seat with a rendered view.
  - "Fill every seat" puts a placeholder guest at every seat (a random mix of
    fake cameras and initials cards), so overlaps are easy to spot. Nothing is
    sent anywhere; the fake cameras are painted canvases.
  - "Sample artwork" hangs placeholder paintings in the middle-of-the-room
    view, exactly as a finished party would (art.json + the gallery layout).
  - To move a seat: choose it, then click where its head should be in the
    current view (or use the nudge buttons). Every other view follows,
    because all views are computed from one 3D seat map (seats/geometry.json).
  - "Hidden from here" drops a seat from one seat view (it's behind a wall).
  - Save writes spots.json and geometry.json; the server rewrites every seat
    view's spots.json from them. No re-render needed.

  Works for a new room with only panorama.webp + spots.json (middle view only)
  until seat_views.py has made seat views for it.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { INITIALS_COLOR_KEYS, anglesFrom, placeFromView, sanitizeArt, sanitizeGeometry, sanitizeSpots, spotsForView, type ArtRegion, type Member, type SeatGeometry, type Spot, type SpotsFile } from '@ptc/shared';
  import type { GuestVideo } from '../call/call.svelte';
  import { makeFakeVideoTrack } from './demoVideo';
  import RoomView from './RoomView.svelte';
  import ArtLayer from './ArtLayer.svelte';
  import { planGallery, type GalleryPiece } from './leanLayout';
  import { hangsFor } from './hangs';

  let { room }: { room: string } = $props();

  const NAMES = ['Ada', 'Bo', 'Cleo', 'Dex', 'Efi', 'Gus', 'Hana', 'Iggy', 'Jo', 'Kit', 'Lu', 'Mo', 'Nia', 'Oz', 'Pia', 'Quin', 'Rae', 'Sol', 'Tam', 'Uma', 'Vic', 'Wren', 'Xan', 'Yui', 'Zed'];
  const ASPECTS = [0.66, 1, 1.5];
  const NUDGE = 0.5; // degrees per nudge button press

  let file = $state<SpotsFile | null>(null);
  let geometry = $state<SeatGeometry | null>(null);
  let views = $state<{ id: string; label: string }[]>([]);
  let art = $state<ArtRegion[]>([]);
  let loadError = $state('');

  let viewId = $state('center');
  let selectedId = $state<string | null>(null);
  let fill = $state(true);
  let cameraShare = $state(50); // percent of filled seats shown as a camera
  let showArt = $state(true);
  let pieceCount = $state(6);
  let shuffle = $state(0);
  let dirty = $state(false);
  let status = $state('');

  let spots = $derived(file?.spots ?? []);
  let isCenter = $derived(viewId === 'center');
  let panorama = $derived(isCenter ? `/studio/${room}/panorama.webp` : `/studio/${room}/seats/${viewId}/panorama.webp`);
  /** What this viewpoint shows: the middle view's spots, or every other visible seat re-aimed from this seat. */
  let viewSpots = $derived(isCenter ? spots : geometry ? spotsForView(geometry, viewId, spots) : []);
  let hiddenHere = $derived(!isCenter && geometry?.views[viewId] ? geometry.views[viewId]!.hidden : []);
  let canPlace = $derived(isCenter || !!geometry?.views[viewId]);
  let selected = $derived(spots.find((s) => s.id === selectedId) ?? null);

  onMount(async () => {
    try {
      const response = await fetch(`/studio/${room}/spots.json`);
      file = response.ok ? sanitizeSpots(await response.json()) : null;
      if (!file) loadError = `No usable spots.json for "${room}" yet. Plot seats first with the spots editor (?spots=${room}).`;
    } catch {
      loadError = `Couldn't load /studio/${room}/spots.json.`;
    }
    // Optional pieces: a room without seat views or art still works.
    const [index, geo, artFile] = await Promise.all([
      fetch(`/studio/${room}/seats/index.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/studio/${room}/seats/geometry.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/studio/${room}/art.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    ]);
    views = (index?.seats ?? []).map((s: { id: string; label: string }) => ({ id: s.id, label: s.label }));
    geometry = sanitizeGeometry(geo);
    art = sanitizeArt(artFile)?.art ?? [];
  });

  // --- Placeholder guests ----------------------------------------------------
  let members = $state<Member[]>([]);
  let videos = $state<GuestVideo[]>([]);
  let liveTracks: MediaStreamTrack[] = [];
  onDestroy(() => liveTracks.forEach((t) => t.stop()));

  function populate() {
    liveTracks.forEach((t) => t.stop());
    liveTracks = [];
    if (!fill) {
      members = [];
      videos = [];
      return;
    }
    const nextMembers: Member[] = [];
    const nextVideos: GuestVideo[] = [];
    spots.forEach((spot, i) => {
      const name = NAMES[(i + shuffle * 7) % NAMES.length]!;
      const id = `demo-${i + 1}`;
      const onCamera = Math.random() * 100 < cameraShare;
      nextMembers.push({ id, name, presence: onCamera ? 'camera' : 'avatar', isHost: false, spotId: spot.id, canvasShape: 'classic', watching: false, initialsColor: INITIALS_COLOR_KEYS[i % INITIALS_COLOR_KEYS.length]!, hasLook: false, away: false });
      if (onCamera) {
        const track = makeFakeVideoTrack(name[0]!, i + shuffle);
        liveTracks.push(track);
        nextVideos.push({ identity: id, name, track, speaking: false });
      }
    });
    members = nextMembers;
    videos = nextVideos;
  }
  // Re-seat when the room loads, the fill is switched, or reshuffled; not on every edit.
  let seededFor = '';
  $effect(() => {
    const key = `${spots.length}:${fill}:${shuffle}:${cameraShare}`;
    if (!spots.length || key === seededFor) return;
    seededFor = key;
    populate();
  });

  // --- Sample artwork (middle view only) -------------------------------------
  let pieces = $derived<GalleryPiece[]>(Array.from({ length: pieceCount }, (_, i) => ({ seed: `tool-${shuffle}-${i + 1}`, aspect: ASPECTS[(i + shuffle) % ASPECTS.length]! })));
  let hangs = $derived(isCenter && showArt ? hangsFor(planGallery(art, pieces, 'walls-then-lean'), pieces) : []);

  // --- Editing ---------------------------------------------------------------
  function labelOf(id: string) {
    return spots.find((s) => s.id === id)?.label ?? id;
  }

  /** Put the chosen seat's marker at a yaw/pitch in the current view. */
  function place(yaw: number, pitch: number) {
    if (!file || !selected || !canPlace) return;
    const spot = selected;
    let nextYaw = yaw;
    let nextPitch = pitch;
    if (geometry && geometry.markers[spot.id]) {
      const placed = placeFromView(geometry, viewId, spot, yaw, pitch);
      if (placed) {
        geometry.markers[spot.id] = placed.marker;
        nextYaw = placed.yaw;
        nextPitch = placed.pitch;
      }
      // Placing a seat in a view means it's visible from there.
      const view = isCenter ? null : geometry.views[viewId];
      if (view && view.hidden.includes(spot.id)) view.hidden = view.hidden.filter((h) => h !== spot.id);
    } else if (!isCenter) {
      return; // seat views need the 3D seat map
    }
    file.spots = file.spots.map((s) => (s.id === spot.id ? { ...s, yaw: nextYaw, pitch: nextPitch } : s));
    dirty = true;
    status = `${spot.label} moved. Middle of the room: yaw ${nextYaw}°, pitch ${nextPitch}°.`;
  }

  /** Where the chosen seat sits in the current view, for the nudge buttons. */
  function currentAngles(): { yaw: number; pitch: number } | null {
    if (!selected) return null;
    if (isCenter) return { yaw: selected.yaw, pitch: selected.pitch };
    const view = geometry?.views[viewId];
    const marker = geometry?.markers[selected.id];
    return view && marker ? anglesFrom(view, marker) : null;
  }

  function nudge(dYaw: number, dPitch: number) {
    const now = currentAngles();
    if (now) place(Math.round((now.yaw + dYaw) * 10) / 10, Math.round((now.pitch + dPitch) * 10) / 10);
  }

  function toggleHidden(id: string, hidden: boolean) {
    const view = geometry?.views[viewId];
    if (!view) return;
    view.hidden = hidden ? [...new Set([...view.hidden, id])] : view.hidden.filter((h) => h !== id);
    dirty = true;
    status = `${labelOf(id)} ${hidden ? 'hidden from' : 'shown in'} this view.`;
  }

  async function save() {
    if (!file) return;
    status = 'Saving…';
    try {
      const put = (path: string, body: unknown) => fetch(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const spotsResponse = await put(`/api/spots/${room}`, $state.snapshot(file));
      if (!spotsResponse.ok) throw new Error(await spotsResponse.text());
      let views = 0;
      if (geometry) {
        const seatsResponse = await put(`/api/seats/${room}`, $state.snapshot(geometry));
        if (!seatsResponse.ok) throw new Error(await seatsResponse.text());
        views = (await seatsResponse.json()).saved ?? 0;
      }
      dirty = false;
      status = geometry ? `Saved. spots.json and the 3D seat map are updated, and ${views} seat views were rewritten.` : 'Saved spots.json.';
    } catch (error) {
      status = `Couldn't save: ${(error as Error).message}`;
    }
  }

  // svelte-ignore non_reactive_update — only called, never rendered
  let roomView: RoomView | null = null;

  function onKeyChoose(id: string) {
    selectedId = selectedId === id ? null : id;
    if (selectedId) roomView?.lookAtSpot(id);
    if (selectedId) status = `Placing ${labelOf(id)}. Click where their head should be, or use the nudge buttons.`;
  }
</script>

<main class="tool">
  <header class="bar">
    <p class="tape">Room tool · {room}</p>
    <label>
      <span>Viewpoint</span>
      <select bind:value={viewId}>
        <option value="center">Middle of the room</option>
        {#each views as view (view.id)}
          <option value={view.id}>From {view.label}</option>
        {/each}
      </select>
    </label>
    <label class="check"><input type="checkbox" bind:checked={fill} /> Fill every seat</label>
    <label>
      <span>On camera</span>
      <select bind:value={cameraShare} disabled={!fill}>
        <option value={0}>None</option>
        <option value={50}>About half</option>
        <option value={100}>Everyone</option>
      </select>
    </label>
    {#if isCenter}
      <label class="check"><input type="checkbox" bind:checked={showArt} /> Sample artwork</label>
      <label>
        <span>Pieces</span>
        <input type="number" min="1" max="24" bind:value={pieceCount} disabled={!showArt} />
      </label>
    {/if}
    <button type="button" class="quiet" onclick={() => shuffle++}>Reshuffle</button>
    <button type="button" onclick={save} disabled={!dirty}>Save</button>
  </header>

  <p class="status" role="status">{loadError || status || (isCenter ? 'Choose a seat, then click the panorama to move it.' : canPlace ? 'Seen from this seat. Choose a seat, then click where it should be.' : 'This view has no 3D seat map yet: run seat_views.py --data-only.')}</p>

  <div class="work">
    <div class="stage">
      {#key panorama}
        <RoomView bind:this={roomView} {panorama} spotsUrl="" spots={viewSpots} {members} youId={null} {videos} {selectedId} showJump={false}
          onTakeSpot={onKeyChoose} onPanoramaClick={selected ? place : undefined}>
          {#snippet overlay(viewer)}
            {#if hangs.length}<ArtLayer {viewer} {hangs} />{/if}
          {/snippet}
        </RoomView>
      {/key}
    </div>

    <aside class="side" aria-label="Seats">
      <fieldset>
        <legend>Seat to place</legend>
        <ul>
          {#each spots as spot (spot.id)}
            {@const hidden = hiddenHere.includes(spot.id)}
            {@const self = spot.id === viewId}
            <li class:muted={hidden || self}>
              <label class="choice">
                <input type="radio" name="seat" value={spot.id} checked={selectedId === spot.id} disabled={self} onchange={() => onKeyChoose(spot.id)} />
                {spot.label}{self ? ' (this viewpoint)' : ''}
              </label>
              {#if !isCenter && !self && geometry?.views[viewId]}
                <label class="hide"><input type="checkbox" checked={hidden} onchange={(e) => toggleHidden(spot.id, e.currentTarget.checked)} /> Hidden from here</label>
              {/if}
            </li>
          {/each}
        </ul>
      </fieldset>

      {#if selected && canPlace}
        <div class="nudge" role="group" aria-label={`Nudge ${selected.label}`}>
          <button type="button" class="up" onclick={() => nudge(0, NUDGE)}>Up</button>
          <button type="button" class="left" onclick={() => nudge(-NUDGE, 0)}>Left</button>
          <button type="button" class="right" onclick={() => nudge(NUDGE, 0)}>Right</button>
          <button type="button" class="down" onclick={() => nudge(0, -NUDGE)}>Down</button>
        </div>
      {/if}
    </aside>
  </div>
</main>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .tool {
    @include walnut-table;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    color: $cream;
  }

  .bar {
    display: flex;
    align-items: end;
    gap: 0.75rem 1rem;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    background: rgb(24 16 11 / 0.8);
    border-radius: $radius-sm;

    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: $cream-muted;
    }
    .check {
      flex-direction: row;
      align-items: center;
      min-height: $tap-min;
      color: $cream;
    }
    select,
    input[type='number'] {
      min-height: $tap-min;
      padding: 0 0.5rem;
      border-radius: $radius-sm;
      border: 1px solid rgb(255 230 200 / 0.25);
      background: rgb(0 0 0 / 0.3);
      color: $cream;
    }
    input[type='number'] {
      width: 4.5rem;
    }
  }

  button {
    min-height: $tap-min;
    padding: 0 1.25rem;
    border: 0;
    border-radius: $radius-pill;
    background: $cadmium-orange;
    color: rgb(24 16 11);
    font-weight: 700;

    &:disabled {
      opacity: 0.5;
    }
    &.quiet {
      background: transparent;
      color: $cream;
      border: 1px solid rgb(255 230 200 / 0.35);
    }
  }

  button,
  input,
  select {
    &:focus-visible {
      outline: 3px solid $focus;
      outline-offset: 2px;
    }
  }

  .tape {
    @include tape-label;
    margin: 0;
    align-self: center;
    font-size: 1.25rem;
  }

  .status {
    margin: 0;
    font-size: 0.9375rem;
    color: $cream-muted;
  }

  .work {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 18rem;
    gap: 1rem;
    min-height: 0;

    @media (max-width: 900px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .stage {
    min-height: 70vh;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 80vh;
    overflow: auto;

    fieldset {
      margin: 0;
      padding: 0.75rem;
      border: 1px solid rgb(255 230 200 / 0.2);
      border-radius: $radius-sm;
    }
    legend {
      font-weight: 700;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    li.muted .choice {
      color: $cream-muted;
    }
    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 2.75rem;
    }
    .hide {
      min-height: 2.25rem;
      padding-left: 1.75rem;
      font-size: 0.875rem;
      color: $cream-muted;
    }
  }

  .nudge {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.375rem;

    button {
      padding: 0;
    }
    .up { grid-area: 1 / 2; }
    .left { grid-area: 2 / 1; }
    .right { grid-area: 2 / 3; }
    .down { grid-area: 3 / 2; }
  }
</style>
