<!--
  Top-level screen switch: public site → owner room tools (dev only:
  ?spots=room, ?art=room, ?seats=room) → shared gallery link → join form →
  the party (painting table, room, reveal gallery).
  Party id comes from the URL (?party=maya-30th); one is made up if missing.
-->
<script lang="ts">
  import type { Look, Presence } from '@ptc/shared';
  import { PartyConnection } from './lib/party/connection.svelte';
  import { applyPreferences, loadPreferences } from './lib/prefs.svelte';

  const params = new URLSearchParams(location.search);
  const publicPath = location.pathname.replace(/\/$/, '') || '/';
  const developmentRoute = import.meta.env.DEV && ['demo', 'spots', 'art', 'seats'].some(key => params.has(key));
  // Painting, the gallery and host tools all live inside the party now
  // (?party=…). The dev-only routes below are room-authoring tools only.
  const showPublicSite = !params.has('party') && !params.has('gallery') && !params.has('archive') && !params.has('practice') && !params.has('link') && !developmentRoute;
  const linkEntry = !params.has('party') && params.has('link'); // "?link": type a code to add this device to your seat
  const editRoom = import.meta.env.DEV ? params.get('spots') : null; // "?spots=cream-city" opens the spot editor
  const artRoom = import.meta.env.DEV ? params.get('art') : null; // "?art=cream-city" opens the wall art editor
  // "?seats=cream-city" opens the room tool: every viewpoint, every seat filled, place markers. (?demo=seats is the old name.)
  const seatRoom = import.meta.env.DEV ? (params.get('seats') ?? (params.get('demo') === 'seats' ? 'cream-city' : null)) : null;
  const practice = params.has('practice'); // "?practice" opens the solo practice table ("&piece=<id>" reopens a saved piece)
  const practicePiece = params.get('piece');
  const archiveId = params.get('archive'); // "?archive=<id>" opens a saved party gallery
  const galleryRoom = params.get('gallery'); // "?gallery=cream-city#g=…" opens a shared gallery room
  const partyId = params.get('party') ?? `party-${Math.random().toString(36).slice(2, 8)}`;

  // Interface size from your settings: the whole page on the site and account
  // pages; just the controls on the painting table (see prefs.svelte.ts).
  applyPreferences();
  $effect(() => { void loadPreferences(); });
  document.documentElement.classList.toggle('scaled-page', showPublicSite);

  const party = new PartyConnection();
  let joined = $state(false);

  // Arriving with a link code (#link=K7P3QM, from the QR code or "Open in its
  // own window"): join as one of your own devices. Arriving with a saved seat
  // (a reload, or coming back to this tab): rejoin it. Either way, no join form.
  if (params.has('party')) {
    const hash = new URLSearchParams(location.hash.slice(1));
    const code = hash.get('link');
    if (code) {
      party.redeem(partyId, code); // reads "#…&window=1" for the device name first
      // Keep the used code out of the address bar and history.
      history.replaceState(null, '', `?party=${partyId}`);
      joined = true;
    } else if (party.rejoin(partyId)) {
      joined = true;
    }
  }
  // Refused (a closed seat, a used code, unlinked): back to the join form, saying why.
  $effect(() => {
    if (party.refused) joined = false;
  });

  function join(name: string, presence: Presence, look: Look) {
    history.replaceState(null, '', `?party=${partyId}`);
    party.join(partyId, name, presence, look);
    joined = true;
  }
</script>

{#if showPublicSite}
  {#await import('./lib/ui/PublicSite.svelte')}
    <main class="loading">Opening the studio…</main>
  {:then { default: PublicSite }}
    <PublicSite path={publicPath} />
  {/await}
{:else if editRoom}
  <!-- Owner tool: plot seats in a room. Loaded separately so party guests never download it. -->
  {#await import('./lib/room/SpotsEditor.svelte')}
    <main class="loading">Opening the spot editor…</main>
  {:then { default: SpotsEditor }}
    <SpotsEditor room={editRoom} />
  {/await}
{:else if artRoom}
  <!-- Owner tool: draw the blank-canvas boxes on the walls. -->
  {#await import('./lib/room/ArtEditor.svelte')}
    <main class="loading">Opening the wall art editor…</main>
  {:then { default: ArtEditor }}
    <ArtEditor room={artRoom} />
  {/await}
{:else if seatRoom}
  <!-- Owner tool: check seats from every viewpoint with placeholder guests, and move them. -->
  {#await import('./lib/room/SeatTool.svelte')}
    <main class="loading">Filling the seats…</main>
  {:then { default: SeatTool }}
    <SeatTool room={seatRoom} />
  {/await}
{:else if practice}
  {#await import('./lib/practice/PracticeTable.svelte')}
    <main class="loading">Setting out the paints…</main>
  {:then { default: PracticeTable }}
    <PracticeTable pieceId={practicePiece && /^[0-9a-f-]{36}$/.test(practicePiece) ? practicePiece : null} />
  {/await}
{:else if archiveId}
  <!-- A saved party gallery, from the host's share link. -->
  {#await import('./lib/room/ArchiveView.svelte')}
    <main class="loading">Opening the gallery…</main>
  {:then { default: ArchiveView }}
    <ArchiveView id={archiveId} />
  {/await}
{:else if galleryRoom}
  <!-- A shared party gallery link. Parties open their own gallery from the reveal. -->
  {#await import('./lib/room/Gallery.svelte')}
    <main class="loading">Hanging the artwork…</main>
  {:then { default: Gallery }}
    <Gallery room={galleryRoom} />
  {/await}
{:else if linkEntry}
  <main class="join">
    {#await import('./lib/party/LinkEntry.svelte')}
      <p class="loading">One moment…</p>
    {:then { default: LinkEntry }}
      <LinkEntry />
    {/await}
  </main>
{:else if !joined}
  <main class="join">
    {#await import('./lib/party/JoinForm.svelte')}
      <p class="loading">Setting out a chair…</p>
    {:then { default: JoinForm }}
      <JoinForm {partyId} onjoin={join} notice={party.refused} />
    {/await}
  </main>
{:else}
  {#await import('./lib/Studio.svelte')}
    <main class="loading">Opening your party…</main>
  {:then { default: Studio }}
    <Studio {party} onleave={() => (joined = false)} />
  {/await}
{/if}

<style lang="scss">
  @use './styles/tokens' as *;
  @use './styles/mixins' as *;

  .join {
    @include walnut-table;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  .loading { color: $cream; }
</style>
