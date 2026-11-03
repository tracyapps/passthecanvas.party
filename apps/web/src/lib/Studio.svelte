<!--
  The party screen. Three places, one party:
  - the painting table (default): every guest sees the shared canvas; the
    current painter paints, everyone else watches and gets their tools ready
  - the 360° room
  - the gallery, after the reveal: the finished piece hung in the room
  Host tools (canvas shape, start, pass now) live in the table's top bar.
-->
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { CANVAS_SHAPES, type CanvasShape } from '@ptc/shared';
  import type { PartyConnection } from './party/connection.svelte';
  import { Call } from './call/call.svelte';
  import CallDock from './call/CallDock.svelte';
  import VideoTile from './call/VideoTile.svelte';
  import PaintingTable from './canvas/PaintingTable.svelte';
  import StudioPanel from './canvas/StudioPanel.svelte';
  import TimerDial from './ui/TimerDial.svelte';
  import type { GalleryPiece } from './room/leanLayout';

  let { party, onleave }: { party: PartyConnection; onleave?: () => void } = $props();

  // The room this party opens in. Per-party room choice arrives in phase 2.
  const ROOM = 'cream-city';
  const ROOM_PANORAMA = `/studio/${ROOM}/panorama.webp`;
  const ROOM_SPOTS = `/studio/${ROOM}/spots.json`;

  let view = $state<'paint' | 'room' | 'gallery'>('paint');
  let table: PaintingTable | undefined = $state();
  let guestsOpen = $state(innerWidth > 1100);
  let revealOpen = $state(true);
  const call = new Call();

  // Hand the canvas everything that arrived before it existed (a late
  // joiner's history), then every new stroke as it comes in.
  $effect(() => {
    const current = table;
    if (!current) return;
    // untrack: only a new table should rebuild the canvas, never a state update.
    untrack(() => {
      const waiting = party.attachCanvas((stroke) => current.applyRemote(stroke));
      void current.loadHistory(waiting.history, waiting.complete, party.state?.snapshotUrl ?? null);
    });
    party.onSnapshotRequest = (round) => party.send({ type: 'snapshot', round, pngDataUrl: current.snapshot() });
    return () => party.detachCanvas();
  });

  // Join the video call once the party tells us who we are. The member id
  // becomes the LiveKit identity, so tiles line up with guests.
  let callJoined = false;
  $effect(() => {
    const me = party.me;
    const partyId = party.state?.partyId;
    if (!me || !partyId || callJoined) return;
    callJoined = true;
    void call.join(partyId, me.name, me.id, me.presence);
  });

  onDestroy(() => call.leave());

  function leave() {
    call.leave();
    party.leave();
    onleave?.();
  }

  let game = $derived(party.state);
  let painterName = $derived(party.painter?.name ?? '');
  let isHost = $derived(party.me?.isHost ?? false);
  let timerLabel = $derived(party.isMyTurn ? 'Your turn' : painterName ? `${painterName}'s turn` : 'Waiting');
  let canvasLabel = $derived(
    game?.phase === 'painting' ? `Shared canvas, round ${game.round} of ${game.totalRounds}. ${party.isMyTurn ? 'Your turn.' : painterName + ' is painting.'}`
      : game?.phase === 'reveal' ? 'The finished group painting.' : 'Shared canvas.'
  );
  let waitingNote = $derived(
    !game ? 'Connecting…'
      : game.phase === 'lobby' ? (isHost ? 'Choose a canvas, then start the game when everyone is here.' : 'Waiting for the host to start.')
      : game.phase === 'passing' ? 'Passing the canvas…'
      : game.phase === 'reveal' ? 'All rounds done.'
      : `Watching ${painterName || 'the painter'} paint.`
  );

  /** The finished piece first, then how it grew round by round. */
  let artwork = $derived.by((): GalleryPiece[] => {
    const rounds = game?.rounds ?? [];
    if (!rounds.length || !game) return [];
    const aspect = game.canvas.width / game.canvas.height;
    const last = rounds[rounds.length - 1]!;
    return [
      { seed: `final-${last.round}`, aspect, url: last.url, caption: 'The finished piece — everyone' },
      ...rounds.slice(0, -1).map((r) => ({ seed: `round-${r.round}`, aspect, url: r.url, caption: `After round ${r.round} — ${r.painterName}` }))
    ];
  });

  function chooseCanvas(shape: CanvasShape) {
    party.send({ type: 'setCanvas', shape });
  }
  function closeMenu() {
    document.getElementById('table-actions')?.hidePopover();
  }
</script>

<div class="studio">
  {#if view === 'gallery' && game}
    <!-- Loaded only when opened: the gallery shares the 360° viewer. -->
    {#await import('./room/Gallery.svelte')}
      <p class="loading">Hanging the artwork…</p>
    {:then { default: Gallery }}
      <Gallery room={ROOM} {artwork} onback={() => { view = 'paint'; revealOpen = true; }} />
    {/await}
  {:else if view === 'room'}
    <!-- Loaded only when opened: the 360° viewer (three.js) is the heaviest part of the app. -->
    {#await import('./room/RoomView.svelte')}
      <p class="loading">Opening the room…</p>
    {:then { default: RoomView }}
      <RoomView
        panorama={ROOM_PANORAMA}
        spotsUrl={ROOM_SPOTS}
        members={game?.members ?? []}
        youId={party.youId}
        videos={call.videos}
        onTakeSpot={(spotId) => party.send({ type: 'takeSpot', spotId })}
      />
    {/await}
  {/if}

  <!-- The table stays mounted in the room and gallery too, so the canvas keeps
       receiving strokes; it is just hidden. -->
  {#if game && party.youId}
    <div class="table" hidden={view !== 'paint'}>
      <PaintingTable
        bind:this={table}
        canDraw={party.isMyTurn}
        painterId={party.youId}
        round={game.round}
        canvasSize={game.canvas}
        label={canvasLabel}
        {waitingNote}
        onstroke={(stroke) => party.send({ type: 'stroke', stroke })}
      >
        {#snippet partyBar()}
          <div class="party-bar">
            <p class="tape">{game.partyId}</p>
            {#if game.phase === 'lobby' && isHost}
              <label class="shape">Canvas
                <select value={game.canvas.shape} onchange={(event) => chooseCanvas(event.currentTarget.value as CanvasShape)}>
                  {#each Object.entries(CANVAS_SHAPES) as [id, shape] (id)}<option value={id}>{shape.name}</option>{/each}
                </select>
              </label>
              <button type="button" class="primary" onclick={() => party.send({ type: 'start' })}>Start the game</button>
            {:else if game.phase === 'lobby'}
              <p class="note">{CANVAS_SHAPES[game.canvas.shape].name} canvas · waiting for the host</p>
            {/if}
            {#if game.phase === 'painting' || game.phase === 'passing'}
              <p class="round">Round <strong>{game.round}</strong> of {game.totalRounds}</p>
              <TimerDial secondsLeft={game.secondsLeft} totalSeconds={game.turnSeconds} label={timerLabel} />
            {/if}
            {#if game.phase === 'painting' && (party.isMyTurn || isHost)}
              <button type="button" class="primary" onclick={() => party.send({ type: 'passNow' })}>{party.isMyTurn ? 'Pass now' : 'Pass for them'}</button>
            {/if}
            {#if game.phase === 'reveal'}
              <button type="button" class="primary" onclick={() => (revealOpen = true)}>See the finished piece</button>
            {/if}
          </div>
        {/snippet}
        {#snippet menu()}
          <button type="button" aria-pressed={guestsOpen} onclick={() => { guestsOpen = !guestsOpen; closeMenu(); }}>{guestsOpen ? 'Hide guests' : 'Show guests'}</button>
          <button type="button" onclick={() => { view = 'room'; closeMenu(); }}>Go to the room</button>
          {#if artwork.length}<button type="button" onclick={() => { view = 'gallery'; closeMenu(); }}>Open the gallery</button>{/if}
          <button type="button" onclick={leave}>Leave the party</button>
        {/snippet}
      </PaintingTable>

      {#if guestsOpen}
        <StudioPanel title="Around the table" label="guests" dock="guests" flow={innerWidth <= 1100} onclose={() => (guestsOpen = false)}>
          <ul class="guests">
            {#each game.order as id (id)}
              {@const member = game.members.find((m) => m.id === id)}
              {#if member}
                <li>
                  <VideoTile
                    name={member.name}
                    you={member.id === party.youId}
                    host={member.isHost}
                    painting={member.id === game.painterId}
                    track={member.id === party.youId
                      ? call.camOn && call.status === 'in-call'
                        ? call.localVideo
                        : null
                      : call.videos.find((v) => v.identity === member.id)?.track ?? null}
                    speaking={member.id !== party.youId && call.videos.find((v) => v.identity === member.id)?.speaking}
                  />
                </li>
              {/if}
            {/each}
          </ul>
        </StudioPanel>
      {/if}
    </div>
  {:else}
    <p class="loading">Pulling up a chair…</p>
  {/if}

  {#if view !== 'gallery'}
    <CallDock {call} inRoom={view === 'room'} onToggleRoom={() => (view = view === 'paint' ? 'room' : 'paint')} onLeave={leave} />
  {/if}

  {#if game?.phase === 'passing'}
    <div class="pass" role="alertdialog" aria-labelledby="pass-title">
      <div class="card">
        <p class="hand">Time's up!</p>
        <h2 id="pass-title">Pass the canvas</h2>
      </div>
    </div>
  {/if}

  {#if game?.phase === 'reveal' && revealOpen && view === 'paint'}
    <div class="pass" role="dialog" aria-labelledby="reveal-title">
      <div class="card">
        <h2 id="reveal-title">You made this together.</h2>
        {#if game.snapshotUrl}
          <img src={game.snapshotUrl} alt="The finished group painting" />
        {:else}
          <p>Saving the finished piece…</p>
        {/if}
        <div class="reveal-actions">
          {#if artwork.length}<button type="button" class="dark" onclick={() => (view = 'gallery')}>Hang it in the gallery</button>{/if}
          {#if game.snapshotUrl}<a href={game.snapshotUrl} download="pass-the-canvas.png">Download full size</a>{/if}
          <button type="button" class="plain" onclick={() => (revealOpen = false)}>Back to the table</button>
        </div>
      </div>
    </div>
  {/if}

  <div class="sr-only" aria-live="polite">{party.announcement}</div>
</div>

<style lang="scss">
  @use '../styles/tokens' as *;
  @use '../styles/mixins' as *;

  .studio {
    @include walnut-table;
    min-height: 100dvh;
  }

  .table[hidden] {
    display: none;
  }

  .loading {
    margin: 0;
    padding: 2rem;
  }

  .party-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;
  }

  .tape {
    @include tape-label;
    margin: 0;
    font-size: 1.25rem;
  }

  .round,
  .note {
    margin: 0;
  }

  .note {
    font-size: 0.875rem;
    color: $cream-muted;
  }

  .shape {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .primary {
    min-height: $tap-min;
    padding: 0 1.125rem;
    border: 0;
    border-radius: $radius-pill;
    background: $cream;
    color: $walnut-900;
    font-weight: 700;
  }

  // A row of small tiles across the top-right, above the brush rail.
  .guests {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 6.5rem;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;

    li {
      font-size: 0.8125rem;
    }
  }

  .pass {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: rgb(20 13 9 / 0.72);

    .card {
      max-width: 32rem;
      max-height: calc(100dvh - 2.5rem);
      overflow: auto;
      padding: 1.75rem 2rem;
      background: $paper;
      color: $walnut-900;
      transform: rotate(-1deg);
      box-shadow: 0 30px 60px rgb(0 0 0 / 0.55);
    }
    .hand {
      margin: 0;
      font-family: $font-hand;
      font-size: 1.875rem;
      color: #8a3b12;
    }
    h2 {
      margin: 0.25rem 0 1rem;
      font-size: 2rem;
    }
    img {
      display: block;
      width: 100%;
      margin-bottom: 1rem;
    }
    a {
      color: $walnut-900;
      font-weight: 700;
    }
  }

  .reveal-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;

    button,
    a {
      min-height: $tap-min;
      display: inline-flex;
      align-items: center;
    }
    .dark {
      padding: 0 1.125rem;
      border: 0;
      border-radius: $radius-pill;
      background: $walnut-900;
      color: $cream;
      font-weight: 700;
    }
    .plain {
      padding: 0 0.5rem;
      border: 0;
      background: transparent;
      color: $walnut-900;
      text-decoration: underline;
    }
  }
</style>
