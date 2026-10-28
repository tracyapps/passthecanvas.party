<!--
  The spots editor — an owner tool for plotting seats and props in a room.
  Open it at /?spots=<room> (e.g. /?spots=cream-city). Click the panorama to
  aim, name the spot, save to the server. Existing spots can be edited,
  moved by typing new coordinates, or removed.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Viewer, events } from '@photo-sphere-viewer/core';
  import { MarkersPlugin, events as markerEvents, type MarkerConfig } from '@photo-sphere-viewer/markers-plugin';
  import { sanitizeSpots, type Spot } from '@ptc/shared';
  import '@photo-sphere-viewer/core/index.css';
  import '@photo-sphere-viewer/markers-plugin/index.css';

  let { room }: { room: string } = $props();

  let container: HTMLDivElement;
  let viewer: Viewer | null = null;
  let markers: MarkersPlugin | null = null;
  let viewerReady = $state(false);

  let spots = $state<Spot[]>([]);
  let dirty = $state(false);
  let status = $state('');

  /** The form for the spot being added or edited. Null = closed. */
  let form = $state<{ editingId: string | null; label: string; zone: string; yaw: number; pitch: number } | null>(null);
  /** Ignore the viewer click that fires together with a marker click. */
  let markerClickedAt = 0;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RAD = 180 / Math.PI; // PSV angles are radians; spots.json is degrees

  onMount(async () => {
    // A missing file just means the room has no spots yet — start clean.
    try {
      const response = await fetch(`/studio/${room}/spots.json`);
      if (response.ok) spots = sanitizeSpots(await response.json())?.spots ?? [];
    } catch {
      /* start with no spots */
    }

    viewer = new Viewer({
      container,
      panorama: `/studio/${room}/panorama.webp`,
      defaultYaw: 0,
      defaultPitch: '-5deg',
      navbar: false,
      keyboard: 'fullscreen', // arrow keys pan while the viewer is focused
      moveInertia: !reducedMotion,
      plugins: [[MarkersPlugin, { markers: [] }]]
    });
    markers = viewer.getPlugin(MarkersPlugin);

    // Click the panorama → open the form aimed at that direction. While the
    // form is open, each click re-aims it, so you can nudge by clicking.
    viewer.addEventListener(events.ClickEvent.type, (event) => {
      if (Date.now() - markerClickedAt < 150) return; // that click hit a marker
      const click = (event as events.ClickEvent).data;
      // PSV reports yaw in 0–360; spots.json speaks -180–180.
      const yaw = round1((((click.yaw * RAD) + 180) % 360 + 360) % 360 - 180);
      const pitch = round1(click.pitch * RAD);
      form = form
        ? { ...form, yaw, pitch }
        : { editingId: null, label: '', zone: lastZone(), yaw, pitch };
    });

    // Clicking an existing marker opens it for editing instead.
    markers.addEventListener(markerEvents.SelectMarkerEvent.type, (event) => {
      const marker = (event as markerEvents.SelectMarkerEvent).marker;
      markerClickedAt = Date.now();
      const spot = spots.find((s) => s.id === marker.id);
      if (spot) form = { editingId: spot.id, label: spot.label, zone: spot.zone, yaw: spot.yaw, pitch: spot.pitch };
    });

    container.addEventListener('focusin', () => viewer?.startKeyboardControl());
    container.addEventListener('focusout', () => viewer?.stopKeyboardControl());

    // Markers set before the panorama is loaded get wiped by the plugin's
    // own init, so wait for the viewer to be ready first.
    viewer.addEventListener(events.ReadyEvent.type, () => (viewerReady = true));
  });

  onDestroy(() => viewer?.destroy());

  // Keep the markers in step with the list and the open form.
  $effect(() => {
    if (!viewerReady || !markers) return;
    markers.setMarkers(spots.map((spot) => markerFor(spot)));
    // While editing, the marker follows the yaw/pitch fields live.
    if (form?.editingId) {
      markers.updateMarker(markerFor({ ...form, id: form.editingId, label: form.label || '…' } as Spot));
    }
  });

  function markerFor(spot: Spot): MarkerConfig {
    return {
      id: spot.id,
      position: { yaw: `${spot.yaw}deg`, pitch: `${spot.pitch}deg` },
      html: `<span class="spot-marker">${escapeHtml(spot.label)} · ${spot.yaw}° ${spot.pitch}°</span>`,
      anchor: 'center center',
      tooltip: spot.label
    };
  }

  function lastZone() {
    return spots.at(-1)?.zone ?? '';
  }

  function slug(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  }

  function saveForm() {
    if (!form || form.label.trim() === '') return;
    // Keep a plain copy: `form` is reactive and TS can't promise it stays
    // non-null across the statements below.
    const f = { ...form };
    const label = f.label.trim();
    if (f.editingId) {
      const spot = spots.find((s) => s.id === f.editingId);
      if (spot) Object.assign(spot, { label, zone: f.zone.trim() || 'general', yaw: f.yaw, pitch: f.pitch });
    } else {
      let id = `spot_${slug(label) || 'seat'}`;
      let n = 2;
      while (spots.some((s) => s.id === id)) id = `spot_${slug(label) || 'seat'}_${n++}`;
      spots.push({ id, label, zone: f.zone.trim() || 'general', yaw: f.yaw, pitch: f.pitch });
    }
    spots = spots; // reassign so the effect re-renders markers
    dirty = true;
    status = '';
    form = null;
  }

  function removeSpot(id: string) {
    const spot = spots.find((s) => s.id === id);
    if (spot && confirm(`Remove "${spot.label}"?`)) {
      spots = spots.filter((s) => s.id !== id);
      dirty = true;
      status = '';
      if (form?.editingId === id) form = null;
    }
  }

  async function saveToServer() {
    const file = sanitizeSpots({ room, spots });
    if (!file) {
      status = 'Nothing to save yet — add a spot first.';
      return;
    }
    try {
      const response = await fetch(`/api/spots/${room}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(file)
      });
      if (!response.ok) throw new Error(`server said ${response.status}`);
      dirty = false;
      status = `Saved ${spots.length} spots to studio/${room}/spots.json`;
    } catch (error) {
      status = `Could not save: ${error instanceof Error ? error.message : 'unknown error'} (is the party server running?)`;
    }
  }

  async function copyJson() {
    const file = sanitizeSpots({ room, spots });
    if (!file) {
      status = 'Nothing to copy yet — add a spot first.';
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(file, null, 2));
    status = 'JSON copied to the clipboard';
  }

  function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  function round1(n: number) {
    return Math.round(n * 10) / 10;
  }
</script>

<svelte:head>
  <title>Spots — {room} · Pass the Canvas</title>
</svelte:head>

<section class="editor" aria-label="Spot editor for {room}">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- the panorama is a custom interactive widget (click to aim, arrow keys to look), so it must be a tab stop -->
  <div class="viewer" bind:this={container} tabindex="0" role="application" aria-label="Room preview. Click to aim a new spot; arrow keys look around.">
  </div>

  <aside class="panel">
    <h1>Spots · {room}</h1>
    <p class="how">Click in the room to aim a spot, name it, then save. Click a marker to edit it.</p>

    {#if form}
      <form onsubmit={(e) => { e.preventDefault(); saveForm(); }}>
        <h2>{form.editingId ? 'Edit spot' : 'New spot'}</h2>
        <label>
          Label
          <input bind:value={form.label} placeholder="Couch, left cushion" required maxlength="60" />
        </label>
        <label>
          Zone
          <input bind:value={form.zone} placeholder="couch" list="zones" maxlength="30" />
        </label>
        <datalist id="zones">
          {#each [...new Set(spots.map((s) => s.zone))] as zone (zone)}
            <option value={zone}></option>
          {/each}
        </datalist>
        <div class="coords">
          <label>
            Yaw °
            <input type="number" step="0.1" min="-180" max="180" bind:value={form.yaw} />
          </label>
          <label>
            Pitch °
            <input type="number" step="0.1" min="-90" max="90" bind:value={form.pitch} />
          </label>
        </div>
        <div class="row">
          <button type="submit" class="primary">{form.editingId ? 'Save changes' : 'Add spot'}</button>
          <button type="button" onclick={() => (form = null)}>Cancel</button>
        </div>
      </form>
    {/if}

    <h2>Spots ({spots.length})</h2>
    {#if spots.length === 0}
      <p class="empty">No spots yet. Click in the room to add the first one.</p>
    {:else}
      <ul>
        {#each spots as spot (spot.id)}
          <li>
            <span class="label">{spot.label}</span>
            <span class="meta">{spot.zone} · {spot.yaw}° {spot.pitch}°</span>
            <span class="row">
              <button type="button" onclick={() => (form = { editingId: spot.id, label: spot.label, zone: spot.zone, yaw: spot.yaw, pitch: spot.pitch })}>Edit</button>
              <button type="button" class="danger" onclick={() => removeSpot(spot.id)}>Remove</button>
            </span>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="row actions">
      <button type="button" class="primary" onclick={saveToServer} disabled={spots.length === 0}>Save to server</button>
      <button type="button" onclick={copyJson} disabled={spots.length === 0}>Copy JSON</button>
    </div>
    <p class="status" role="status" class:dirty>{status}{dirty ? ' · unsaved changes' : ''}</p>
  </aside>
</section>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 22rem;
    gap: 1rem;
    height: 100dvh;
    padding: 1rem;
    background: $walnut-900;

    @media (max-width: 900px) {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: 50dvh auto;
    }
  }

  .viewer {
    border-radius: $radius-sm;
    overflow: hidden;

    &:focus-visible {
      outline: 3px solid $focus;
      outline-offset: -3px;
    }
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    border-radius: $radius-sm;
    background: rgb(24 16 11 / 0.6);
    color: $cream;
    overflow-y: auto;

    h1 {
      margin: 0;
      font-size: 1.375rem;
    }
    h2 {
      margin: 0.5rem 0 0;
      font-size: 1rem;
    }
    .how,
    .empty,
    .status {
      margin: 0;
      font-size: 0.875rem;
      color: $cream-muted;
    }
    .status.dirty {
      color: $cadmium-orange;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.875rem;
    border-radius: $radius-sm;
    background: rgb(243 234 217 / 0.08);

    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;

      input {
        min-height: $tap-min;
        padding: 0 0.625rem;
        border-radius: $radius-sm;
        border: 1px solid rgb(255 230 200 / 0.3);
        background: rgb(24 16 11 / 0.6);
        color: $cream;
      }
    }

    .coords {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    li {
      display: grid;
      gap: 0.25rem;
      padding: 0.625rem 0.75rem;
      border-radius: $radius-sm;
      background: rgb(243 234 217 / 0.06);

      .label {
        font-weight: 700;
      }
      .meta {
        font-size: 0.8125rem;
        color: $cream-muted;
      }
    }
  }

  .row {
    display: flex;
    gap: 0.5rem;

    button {
      min-height: 2.75rem;
      padding: 0 0.875rem;
      border: 1px solid rgb(255 230 200 / 0.25);
      border-radius: $radius-sm;
      background: rgb(243 234 217 / 0.12);
      color: $cream;
      font-weight: 700;

      &:focus-visible {
        outline: 3px solid $focus;
        outline-offset: 2px;
      }
    }

    .primary {
      background: $cream;
      color: $walnut-900;
      border: 0;
    }

    .danger {
      color: #ff9c9c;
    }

    button:disabled {
      opacity: 0.5;
    }
  }

  .actions {
    margin-top: auto;
  }

  :global(.spot-marker) {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: $radius-pill;
    background: rgb(24 16 11 / 0.85);
    color: $cream;
    font-size: 0.8125rem;
    white-space: nowrap;
    cursor: pointer;
  }
</style>
