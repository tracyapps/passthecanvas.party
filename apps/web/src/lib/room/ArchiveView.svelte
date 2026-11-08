<!--
  A saved party gallery (?archive=<id>), from the host's share link.
  The pieces with their credits; open one for its time-lapse, where each
  artist's name jumps to their turn and lights up while it plays. "See them
  in the room" hangs everything in the 360° studio.
  The host's private delete link adds #delete=<key>, which shows a Delete
  button (asked twice, never a browser dialog).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { creditLine, type PaintedStroke } from '@ptc/shared';
  import { partyUrl } from '../party/origin';
  import TimeLapse from '../canvas/TimeLapse.svelte';
  import Gallery from './Gallery.svelte';
  import type { GalleryPiece } from './leanLayout';

  interface ArchivePiece {
    id: string;
    ownerName: string;
    width: number;
    height: number;
    image: string | null;
    strokes: string | null;
    turns: { round: number; painterId: string; painterName: string; image: string | null }[];
  }
  interface ArchiveRecord {
    id: string;
    room: string;
    createdAt: string;
    pieces: ArchivePiece[];
  }

  let { id }: { id: string } = $props();

  let record = $state<ArchiveRecord | null>(null);
  let problem = $state('');
  let view = $state<'pieces' | 'room'>('pieces');
  let detail = $state<ArchivePiece | null>(null);
  let strokes = $state.raw<PaintedStroke[] | null>(null);
  let loadingStrokes = $state(false);

  const deleteKey = new URLSearchParams(location.hash.replace(/^#/, '')).get('delete');
  let confirmDelete = $state(false);
  let deleted = $state(false);
  let status = $state('');

  // svelte-ignore state_referenced_locally — the id is fixed for this page
  const base = `/api/archive/${encodeURIComponent(id)}`;
  const fileUrl = (name: string) => partyUrl(`${base}/files/${name}`);

  onMount(async () => {
    try {
      const response = await fetch(partyUrl(base));
      if (response.status === 404) problem = "This gallery doesn't exist, or its host deleted it.";
      else if (!response.ok) problem = "The gallery couldn't load right now. Try again in a moment.";
      else record = await response.json();
    } catch {
      problem = "The gallery couldn't load right now. Try again in a moment.";
    }
  });

  let dateText = $derived(record ? new Date(record.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
  const credit = (piece: ArchivePiece) => creditLine(piece.ownerName, piece.turns.map((t) => t.painterName));

  let artwork = $derived<GalleryPiece[]>(
    (record?.pieces ?? []).flatMap((piece) => (piece.image ? [{ seed: piece.id, aspect: piece.width / piece.height, url: `${base}/files/${piece.image}`, caption: credit(piece) }] : []))
  );

  async function open(piece: ArchivePiece) {
    detail = piece;
    strokes = null;
    if (!piece.strokes) return;
    loadingStrokes = true;
    try {
      // Stored gzipped and served with content-encoding: gzip, so this is plain JSON here.
      const response = await fetch(fileUrl(piece.strokes));
      strokes = response.ok ? await response.json() : null;
    } catch {
      strokes = null;
    }
    loadingStrokes = false;
  }

  async function remove() {
    if (!deleteKey) return;
    status = 'Deleting…';
    try {
      const response = await fetch(partyUrl(base), { method: 'DELETE', headers: { 'x-delete-key': deleteKey } });
      if (response.ok) {
        deleted = true;
        record = null;
        status = 'Deleted. The link no longer works for anyone.';
      } else status = response.status === 403 ? "That delete link doesn't match this gallery." : "Couldn't delete it right now. Try again in a moment.";
    } catch {
      status = "Couldn't delete it right now. Try again in a moment.";
    }
    confirmDelete = false;
  }
</script>

{#if view === 'room' && record}
  <Gallery room={record.room} {artwork} onback={() => (view = 'pieces')}
    onpiece={(seed) => { const piece = record?.pieces.find((p) => p.id === seed); if (piece) { view = 'pieces'; void open(piece); } }} />
{:else}
  <main class="archive">
    <p class="tape">Pass the Canvas</p>
    {#if record}
      <h1>A party's gallery</h1>
      <p class="when">Painted together on {dateText}.</p>

      {#if detail}
        {@const names = Object.fromEntries(detail.turns.map((t) => [t.painterId, t.painterName]))}
        <section class="detail" aria-labelledby="piece-title">
          <button type="button" class="plain" onclick={() => (detail = null)}>All the pieces</button>
          <h2 id="piece-title">{detail.ownerName}'s piece</h2>
          <p class="credit">{credit(detail)}</p>
          {#if strokes?.length}
            {#key strokes}
              <TimeLapse {strokes} width={detail.width} height={detail.height} {names} turns={detail.turns} />
            {/key}
          {:else if loadingStrokes}
            <p>Loading the time-lapse…</p>
          {:else}
            {#if detail.image}<img class="art" src={fileUrl(detail.image)} alt={`Finished piece: ${credit(detail)}`} />{/if}
            {#if detail.turns.some((t) => t.image)}
              <h3>Turn by turn</h3>
              <ol class="turns">
                {#each detail.turns as turn (turn.round)}
                  {#if turn.image}<li><img src={fileUrl(turn.image)} alt={`After round ${turn.round}, by ${turn.painterName}`} /><span>{turn.round}. {turn.painterName}</span></li>{/if}
                {/each}
              </ol>
            {/if}
          {/if}
          {#if detail.image}<p><a href={fileUrl(detail.image)} download={`pass-the-canvas-${detail.ownerName}.png`}>Download full size</a></p>{/if}
        </section>
      {:else}
        <ul class="pieces">
          {#each record.pieces as piece (piece.id)}
            <li>
              <button type="button" class="piece" onclick={() => open(piece)} aria-label={`Open ${piece.ownerName}'s piece: ${credit(piece)}`}>
                {#if piece.image}<img src={fileUrl(piece.image)} alt="" />{:else}<span class="missing">No picture saved</span>{/if}
                <span class="owner">{piece.ownerName}</span>
              </button>
              <p class="credit">{credit(piece)}</p>
            </li>
          {/each}
        </ul>
        <div class="actions">
          {#if artwork.length}<button type="button" class="dark" onclick={() => (view = 'room')}>See them in the room</button>{/if}
        </div>
      {/if}

      {#if deleteKey}
        <section class="danger" aria-labelledby="delete-title">
          <h2 id="delete-title">Delete this gallery</h2>
          <p>Removes every piece and time-lapse for everyone with the link. This can't be undone.</p>
          {#if confirmDelete}
            <button type="button" class="dark" onclick={remove}>Yes, delete it</button>
            <button type="button" class="plain" onclick={() => (confirmDelete = false)}>Keep it</button>
          {:else}
            <button type="button" class="dark" onclick={() => (confirmDelete = true)}>Delete…</button>
          {/if}
        </section>
      {/if}
    {:else if deleted}
      <h1>Gallery deleted</h1>
    {:else if problem}
      <h1>Gallery not found</h1>
      <p>{problem}</p>
    {:else}
      <p>Opening the gallery…</p>
    {/if}
    <p class="status" role="status">{status}</p>
  </main>
{/if}

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .archive {
    @include walnut-table;
    min-height: 100dvh;
    padding: 1.5rem 1rem 3rem;
    color: $cream;

    > * {
      max-width: 70rem;
      margin-inline: auto;
    }
  }

  .tape {
    @include tape-label;
    display: table;
    font-size: 1.25rem;
  }

  h1 {
    font-family: $font-display;
    margin: 1rem auto 0.25rem;
  }

  .when,
  .credit {
    color: $cream-muted;
  }

  .pieces {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 1.5rem;
  }

  .piece {
    width: 100%;
    display: grid;
    gap: 0.5rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: $cream;
    text-align: left;
    cursor: pointer;

    img,
    .missing {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: contain;
      background: #e1dfda;
      border: 8px solid #6b4426;
    }
    .missing {
      display: grid;
      place-items: center;
      color: $walnut-900;
    }
    .owner {
      font-weight: 700;
    }
  }

  .detail {
    background: $paper;
    color: $walnut-900;
    border-radius: $radius-sm;
    padding: 1rem 1.25rem 1.5rem;
    margin-top: 1rem;

    .credit {
      color: $walnut-900;
    }
    .art {
      display: block;
      max-width: 100%;
      border: 12px solid #6b4426;
    }
    a {
      color: $walnut-900;
    }
  }

  .turns {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 1rem;

    img {
      width: 100%;
      background: #e1dfda;
    }
  }

  .actions,
  .danger {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .danger {
    padding: 1rem;
    border: 1px solid rgb(255 230 200 / 0.3);
    border-radius: $radius-sm;

    h2,
    p {
      flex-basis: 100%;
      margin: 0;
    }
    h2 {
      font-size: 1.0625rem;
    }
  }

  button {
    min-height: $tap-min;
    padding: 0 1.125rem;
    border-radius: $radius-pill;
    font-weight: 700;
  }
  .dark {
    border: 0;
    background: $cadmium-orange;
    color: rgb(24 16 11);
  }
  .plain {
    border: 1px solid currentColor;
    background: transparent;
    color: inherit;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid $focus;
    outline-offset: 2px;
  }
</style>
