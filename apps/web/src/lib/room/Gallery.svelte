<!--
  The party gallery: the room with the party's finished artwork in place.
  Opened from the reveal at the end of a party (real round images), or from a
  shared link (?gallery=<room>#g=…). The host panel sets how pieces hang —
  walls first with lean overflow, walls only, or lean spaces only — and how
  many pieces the party finished. "Preview export" composes the current view
  into a PNG (first draft of the social photo); the share link packs the
  whole arrangement into the URL, no server storage. Placeholder paintings
  stand in only when a link carries no real art.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { partyUrl } from '../party/origin';
  import { Viewer, events } from '@photo-sphere-viewer/core';
  import type { ArtFile, ArtRegion } from '@ptc/shared';
  import ArtLayer from './ArtLayer.svelte';
  import { planGallery, type GalleryPiece, type HangMode } from './leanLayout';
  import { hangsFor } from './hangs';
  import { renderCurrentView } from './exportView';
  import { decodeGallery, galleryUrl, type GalleryData } from './galleryLink';
  import '@photo-sphere-viewer/core/index.css';

  interface Props {
    room?: string;
    /** The party's real pieces (finished piece first). Without them, placeholders. */
    artwork?: GalleryPiece[];
    /** Back to the party's reveal, when opened from a party. */
    onback?: () => void;
    /** In a party, the host's hang mode; every guest follows it. */
    partyMode?: HangMode;
    /** Set for the host only: send a new hang mode to the party. */
    onpartymode?: (mode: HangMode) => void;
  }
  let { room = 'cream-city', artwork, onback, partyMode, onpartymode }: Props = $props();
  /** Guests at a party see the host's choice but can't change it. */
  let locked = $derived(partyMode !== undefined && !onpartymode);

  // svelte-ignore state_referenced_locally — fixed for this page's lifetime
  const PANORAMA = `/studio/${room}/panorama.webp`;
  // svelte-ignore state_referenced_locally
  const ART_URL = `/studio/${room}/art.json`;

  // A plausible party mix of canvas shapes: tall, square, landscape.
  const ASPECTS = [0.66, 1, 1.5];

  let container: HTMLDivElement;
  // $state.raw: reactive reference without deep-proxying the viewer —
  // Photo Sphere Viewer's internals break behind a $state proxy.
  let viewer = $state.raw<Viewer | null>(null);
  let viewerReady = $state(false);
  let art = $state<ArtRegion[]>([]);
  // svelte-ignore non_reactive_update — read only at click time (export), never rendered
  let layer: ArtLayer | null = null;

  // --- Host settings ---------------------------------------------------------
  let mode = $state<HangMode>('walls-then-lean');
  // Follow the host's choice whenever it changes.
  $effect(() => {
    if (partyMode) mode = partyMode;
  });
  function chooseMode(next: HangMode) {
    if (!realArt) linkPieces = null;
    onpartymode?.(next);
  }
  let pieceCount = $state(6);
  let shuffle = $state(0); // reshuffle paints fresh placeholders
  /** Pieces loaded from a shared link, reproduced exactly. */
  // svelte-ignore state_referenced_locally — the party's art is fixed once the party is over
  let linkPieces = $state<GalleryPiece[] | null>(artwork?.length ? artwork : null);
  /** Real party images, loaded once; hangs repaint when each one arrives. */
  let images = $state<Record<string, HTMLImageElement>>({});
  let realArt = $derived(!!linkPieces?.some((piece) => piece.url));
  $effect(() => {
    for (const piece of linkPieces ?? []) {
      if (!piece.url || images[piece.url]) continue;
      const url = piece.url;
      const image = new Image();
      image.crossOrigin = 'anonymous'; // drawn onto canvases (hangs, export)
      image.src = partyUrl(url);
      image.decode().then(() => (images = { ...images, [url]: image })).catch(() => {});
    }
  });

  // --- Export + share ----------------------------------------------------------
  let dialog: HTMLDialogElement | null = null;
  let exporting = $state(false);
  let exportUrl = $state('');
  let linkStatus = $state('');
  let panoImg: HTMLImageElement | null = null;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** The party's pieces: from the link when shared, else generated from the controls. */
  let pieces = $derived<GalleryPiece[]>(
    linkPieces ??
      Array.from({ length: pieceCount }, (_, i) => ({
        seed: `piece-${shuffle}-${i + 1}`,
        aspect: ASPECTS[(i + shuffle) % ASPECTS.length]!
      }))
  );

  let placements = $derived(planGallery(art, pieces, mode));

  let hangs = $derived(hangsFor(placements, pieces, images));

  let countsText = $derived(() => {
    const leaning = placements.filter((p) => p.role === 'lean').length;
    const dropped = pieces.length - placements.length;
    const parts = [`${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}`, `${placements.length - leaning} on walls`, `${leaning} leaning`];
    if (dropped > 0) parts.push(`${dropped} with nowhere to go — draw more lean areas in the editor`);
    return parts.join(', ').replace(/,([^,]*)$/, ' and$1');
  });

  const shareUrl = $derived(galleryUrl(room, { v: 1, mode, pieces: pieces.map(({ seed, aspect, url, caption }) => (url ? { seed, aspect, url, caption } : { seed, aspect })) }));

  onMount(async () => {
    // A shared arrangement arrives in the hash (#g=…).
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const shared = hash.get('g');
    if (shared) {
      const data: GalleryData | null = decodeGallery(shared);
      if (data) {
        mode = data.mode;
        linkPieces = data.pieces;
        pieceCount = data.pieces.length;
      }
    }

    // The export's fallback renderer needs the raw panorama image.
    const img = new Image();
    img.src = PANORAMA;
    img.decode().catch(() => {});
    panoImg = img;

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

  const DEG = Math.PI / 180;

  // Keep the first piece in frame: when the arrangement changes to something
  // around the corner (lean spaces by the music corner, say), swing the view
  // to it — but never yank the camera while she's looking around nearby.
  $effect(() => {
    if (!viewer || !viewerReady || placements.length === 0) return;
    const first = placements[0]!;
    void first.regionId; // track the arrangement, not the camera
    const anchor = first.quad[0]!.yaw;
    const unwrap = (yaw: number) => yaw + 360 * Math.round((anchor - yaw) / 360);
    const centerYaw = (unwrap(first.quad[0]!.yaw) + unwrap(first.quad[2]!.yaw)) / 2;
    // Aim a touch above the area's middle so its lower half isn't clipped by
    // the bottom of the frame (floor areas sit low in the view).
    const centerPitch = Math.max(-40, Math.min(20, (first.quad[0]!.pitch + first.quad[2]!.pitch) / 2 + 4));
    const viewYaw = viewer.getPosition().yaw / DEG;
    const dYaw = Math.abs((((centerYaw - viewYaw) % 360) + 540) % 360 - 180);
    if (dYaw > 50) {
      const target = { yaw: centerYaw * DEG, pitch: centerPitch * DEG };
      if (reducedMotion) viewer.rotate(target);
      else viewer.animate({ ...target, speed: '6rpm' });
    }
  });

  async function previewExport() {
    if (!viewer || !container) return;
    exporting = true;
    try {
      const canvas = await renderCurrentView(viewer, container, panoImg, layer?.getScreenPieces() ?? []);
      exportUrl = canvas.toDataURL('image/png');
      dialog?.showModal();
    } finally {
      exporting = false;
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      linkStatus = 'Link copied — paste it to anyone; it opens this exact room.';
    } catch {
      linkStatus = 'Copy blocked by the browser — select the link text and copy it yourself.';
    }
  }
</script>

<main class="gallery">
  <div class="top">
    <p class="tape">{artwork?.length ? 'The party gallery' : linkPieces ? 'Shared gallery' : 'Gallery preview'} — {room}</p>
    {#if onback}<button type="button" onclick={onback}>Back to the reveal</button>{/if}
  </div>

  <form class="host" onsubmit={(e) => e.preventDefault()}>
    <fieldset disabled={locked} aria-describedby={locked ? 'hang-note' : undefined}>
      <legend>Hang the party's art</legend>
      <label><input type="radio" bind:group={mode} value="walls-then-lean" oninput={() => chooseMode('walls-then-lean')} /> Walls first, lean overflow</label>
      <label><input type="radio" bind:group={mode} value="walls" oninput={() => chooseMode('walls')} /> Walls only</label>
      <label><input type="radio" bind:group={mode} value="lean" oninput={() => chooseMode('lean')} /> Lean spaces only</label>
      {#if locked}<p id="hang-note" class="status">The host chooses how the art hangs.</p>{/if}
    </fieldset>

{#if !realArt}
    <label class="count">
      <span>Pieces finished: <output>{pieces.length}</output></span>
      <input
        type="range"
        min="1"
        max="14"
        value={pieces.length}
        oninput={(e) => {
          linkPieces = null;
          pieceCount = Number((e.target as HTMLInputElement).value);
        }}
      />
    </label>

    <button type="button" class="ghost" onclick={() => { linkPieces = null; shuffle++; }}>Reshuffle placeholders</button>

{/if}

    <div class="actions">
      <button type="button" class="primary" onclick={previewExport} disabled={exporting || !viewerReady}>
        {exporting ? 'Rendering…' : 'Preview export'}
      </button>
      <button type="button" onclick={copyLink}>Copy room link</button>
    </div>

    <label class="link">
      <span>Shareable 3D room link</span>
      <input type="text" readonly value={shareUrl} onfocus={(e) => e.currentTarget.select()} aria-label="Shareable 3D room link" />
    </label>
    <p class="status" role="status">{linkStatus}</p>
  </form>

  <p class="status">{countsText()}, look around — the pieces stay in place.{realArt ? '' : ' Placeholder paintings.'}</p>

  <div class="stage">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex — the panorama is a custom interactive widget (drag or arrow keys), so it must be a tab stop -->
    <div
      class="viewer"
      bind:this={container}
      tabindex="0"
      role="application"
      aria-label={`Studio room with ${pieces.length} finished pieces on display. Use the arrow keys to look around.`}
    ></div>
    {#if viewerReady && viewer}
      <ArtLayer bind:this={layer} {viewer} {hangs} />
    {/if}
  </div>

  {#if realArt}
    <!-- The pieces in words: who made what, for everyone (and screen readers). -->
    <section class="captions" aria-label="On display">
      <h2>On display</h2>
      <ol>
        {#each pieces as piece (piece.seed)}<li>{piece.caption ?? piece.seed}{#if piece.url}{' · '}<a href={partyUrl(piece.url)} download>Download</a>{/if}</li>{/each}
      </ol>
    </section>
  {/if}

  <dialog bind:this={dialog} aria-label="Export preview">
    <h2>Export preview</h2>
    <!-- svelte-ignore a11y_autofocus — the dialog's close button should receive focus on open -->
    <img src={exportUrl} alt="The room as currently viewed, artwork included" />
    <p class="dialog-actions">
      <a class="download" href={exportUrl} download="passthecanvas-{room}.png">Download PNG</a>
      <button type="button" onclick={() => dialog?.close()}>Back to the room</button>
    </p>
  </dialog>
</main>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .gallery {
    @include walnut-table;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    color: $cream;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .captions {
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.125rem;
    }
    ol {
      margin: 0;
      padding-left: 1.5rem;
      display: grid;
      gap: 0.25rem;
    }
    a {
      color: $cream;
      font-weight: 700;
    }
  }

  .tape {
    @include tape-label;
    margin: 0;
    font-size: 1.25rem;
  }

  .host {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 1rem 1.5rem;
    padding: 0.75rem 1rem;
    background: rgb(24 16 11 / 0.85);
    border-radius: $radius-sm;

    fieldset {
      border: 0;
      margin: 0;
      padding: 0;
      display: flex;
      gap: 0.25rem 1.25rem;
      flex-wrap: wrap;

      legend {
        font-weight: 700;
        margin-bottom: 0.25rem;
      }
      label {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        min-height: $tap-min;
        font-size: 0.9375rem;
      }
      input {
        width: 1.2rem;
        height: 1.2rem;
        accent-color: $cadmium-orange;
      }
    }

    .count {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: $cream-muted;

      input {
        min-height: 1.75rem;
        accent-color: $cadmium-orange;
      }
    }

    .actions {
      display: flex;
      gap: 0.75rem;
    }

    .link {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1 1 16rem;
      font-size: 0.875rem;
      color: $cream-muted;

      input {
        min-height: $tap-min;
        padding: 0 0.5rem;
        border-radius: $radius-sm;
        border: 1px solid rgb(255 230 200 / 0.25);
        background: rgb(0 0 0 / 0.3);
        color: $cream;
        font-size: 0.8125rem;
      }
    }

    .status {
      margin: 0;
      font-size: 0.875rem;
      color: $cream-muted;
    }
  }

  button {
    min-height: $tap-min;
    padding: 0 1rem;
    border: 1px solid rgb(255 230 200 / 0.3);
    border-radius: $radius-sm;
    background: rgb(243 234 217 / 0.08);
    color: $cream;

    &.primary {
      background: $cadmium-orange;
      color: rgb(24 16 11);
      font-weight: 700;
    }
    &.ghost {
      background: transparent;
    }
    &:disabled {
      opacity: 0.55;
    }
    &:focus-visible {
      outline: 3px solid $focus;
      outline-offset: 2px;
    }
  }

  .status {
    margin: 0;
    font-size: 0.875rem;
    color: $cream-muted;
  }

  .stage {
    position: relative; // the art layer overlays the viewer
    flex: 1;
    min-height: 65vh;
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

  dialog {
    max-width: min(56rem, 92vw);
    padding: 1rem;
    border: 0;
    border-radius: $radius-sm;
    background: $paper;
    color: $walnut-900;

    h2 {
      margin: 0 0 0.75rem;
      font-size: 1.25rem;
    }
    img {
      display: block;
      width: 100%;
      border-radius: $radius-sm;
      border: 1px solid #b9a483;
    }
    .dialog-actions {
      display: flex;
      gap: 0.75rem;
      margin: 0.75rem 0 0;

      .download {
        display: inline-flex;
        align-items: center;
        min-height: $tap-min;
        padding: 0 1rem;
        border-radius: $radius-sm;
        background: $walnut-900;
        color: $cream;
        font-weight: 700;
        text-decoration: none;
      }
      button {
        background: transparent;
        color: $walnut-900;
        border-color: #b9a483;
      }
      *:focus-visible {
        outline: 3px solid $focus;
        outline-offset: 2px;
      }
    }
  }
</style>
