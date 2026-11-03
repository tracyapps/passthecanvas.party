<!--
  History & art: the parties you've been to and the galleries saved from
  them. Each gallery opens the full archive (credits, time-lapses, the room).
-->
<script lang="ts">
  import { partyUrl } from '../../party/origin';
  import { go, studio, when } from './studio.svelte';
  import { isPast, statusOf } from './parties';

  interface ArchivePiece { id: string; ownerName: string; image: string | null }
  let covers = $state<Record<string, { pieces: ArchivePiece[]; missing?: boolean }>>({});

  let galleries = $derived(studio.home?.galleries ?? []);
  let past = $derived((studio.home?.parties ?? []).filter((p) => isPast(p) && !p.cancelled && statusOf(p) !== 'declined').sort((a, b) => b.startsAt.localeCompare(a.startsAt)));

  $effect(() => {
    for (const g of galleries) {
      if (covers[g.archiveId]) continue;
      covers[g.archiveId] = { pieces: [] };
      fetch(partyUrl(`/api/archive/${g.archiveId}`))
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((record: { pieces: ArchivePiece[] }) => (covers[g.archiveId] = { pieces: record.pieces.slice(0, 4) }))
        .catch(() => (covers[g.archiveId] = { pieces: [], missing: true }));
    }
  });
  const fileUrl = (archiveId: string, name: string) => partyUrl(`/api/archive/${archiveId}/files/${name}`);
</script>

<header class="page-head">
  <div><p class="eyebrow">The things you made together</p><h1 tabindex="-1">History & art</h1></div>
</header>

<section class="card" aria-labelledby="art-title">
  <h2 id="art-title">Saved galleries</h2>
  {#if galleries.length}
    <ul class="galleries">
      {#each galleries as g (g.archiveId)}
        {@const cover = covers[g.archiveId]}
        <li>
          <a href={`/?archive=${g.archiveId}`} class="gallery">
            <span class="thumbs" aria-hidden="true">
              {#each cover?.pieces ?? [] as piece (piece.id)}{#if piece.image}<img src={fileUrl(g.archiveId, piece.image)} alt="" loading="lazy" />{/if}{/each}
            </span>
            <span class="title">{g.title}</span>
            <span class="muted">{when(g.savedAt, 'date')}{cover?.missing ? ' · deleted by its host' : cover?.pieces.length ? ` · ${cover.pieces.map((p) => p.ownerName).join(', ')}` : ''}</span>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">When a host saves a party's gallery, it lands here: every piece, who painted it, and the time-lapse.</p>
  {/if}
</section>

<section class="card" aria-labelledby="past-title">
  <h2 id="past-title">Past parties</h2>
  {#if past.length}
    <ul class="list">
      {#each past as party (party.id)}
        <li><strong>{party.title}</strong> <span class="muted">· {when(party.startsAt)} · {party.hosting ? 'you hosted' : `hosted by ${party.hostName}`}</span></li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No past parties yet. <a href="/account/parties/new" onclick={(e) => go('/account/parties/new', e)}>Plan your first one</a>.</p>
  {/if}
</section>

<style>
  .galleries { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: 20px; }
  .gallery { display: grid; gap: 6px; text-decoration: none; color: inherit; }
  .gallery:hover .title { text-decoration: underline; }
  .thumbs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; aspect-ratio: 4 / 3; padding: 6px; background: #6b4426; }
  .thumbs img { width: 100%; height: 100%; object-fit: cover; background: #e1dfda; }
  .title { font-weight: 700; font-size: 17px; }
</style>
