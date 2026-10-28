<!--
  The studio screen: painting view (default) or the 360° room.
  Phase 1 version: functional, plainly styled. The real-object skin from the
  design canvas (brush jar, palette, polaroids) lands in phase 2.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { PartyConnection } from './party/connection.svelte';
  import type { BrushSettings } from './canvas/brushes';
  import { TOOLS, TOOL_GROUPS } from './canvas/brushes';
  import { PAINTS, mixPaint } from './canvas/paints';
  import { Call } from './call/call.svelte';
  import CallDock from './call/CallDock.svelte';
  import VideoTile from './call/VideoTile.svelte';
  import PaintCanvas from './canvas/PaintCanvas.svelte';
  import TimerDial from './ui/TimerDial.svelte';

  let { party, onleave }: { party: PartyConnection; onleave?: () => void } = $props();

  // The room this party opens in. Per-party room choice arrives in phase 2.
  const ROOM_PANORAMA = '/studio/cream-city/panorama.webp';
  const ROOM_SPOTS = '/studio/cream-city/spots.json';

  let view = $state<'paint' | 'room'>('paint');
  let brush = $state<BrushSettings>({ tool: 'round', color: '#2c3f9e', size: 18, flow: 0.9, viscosity: 0.6 });
  let canvas: PaintCanvas | undefined = $state();
  const call = new Call();

  // ---- mixing paints on the palette ----
  // Turn "Mix a color" on, tap two paints, tap the result to load your brush.
  let mixing = $state(false);
  let slotA = $state<{ name: string; hex: string } | null>(null);
  let slotB = $state<{ name: string; hex: string } | null>(null);
  let mixResult = $state<{ name: string; hex: string } | null>(null);

  function toggleMixing() {
    mixing = !mixing;
    if (!mixing) resetMix();
  }

  function resetMix() {
    slotA = null;
    slotB = null;
    mixResult = null;
  }

  function tapPaint(paint: { name: string; hex: string }) {
    if (!mixing) {
      brush.color = paint.hex;
      return;
    }
    if (!slotA) {
      slotA = paint;
      return;
    }
    slotB = paint;
    mixResult = { name: `${slotA.name} and ${slotB.name}`, hex: mixPaint(slotA.hex, slotB.hex) };
    party.announcement = `Mixed ${mixResult.name}. Tap the mix to use it.`;
  }

  function useMix() {
    if (!mixResult) return;
    brush.color = mixResult.hex;
    mixing = false;
    resetMix();
  }

  // Wire the connection to the canvas.
  $effect(() => {
    party.onRemoteStroke = (stroke) => canvas?.replay(stroke);
    party.onSnapshotRequest = (round) => {
      if (canvas) party.send({ type: 'snapshot', round, pngDataUrl: canvas.snapshot() });
    };
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

  // A new official snapshot (a saved round, or history for a late joiner)
  // replaces the pixels on every screen, so nobody carries drift forward.
  let loadedSnapshot = '';
  $effect(() => {
    const url = party.state?.snapshotUrl;
    if (!url || url === loadedSnapshot) return;
    loadedSnapshot = url;
    void canvas?.loadImage(url);
  });

  onDestroy(() => call.leave());

  function leave() {
    call.leave();
    party.leave();
    onleave?.();
  }

  let game = $derived(party.state);
  let painterName = $derived(party.painter?.name ?? '');
  let timerLabel = $derived(party.isMyTurn ? 'Your turn' : painterName ? `${painterName}'s turn` : 'Waiting');
  let canvasLabel = $derived(
    game?.phase === 'painting' ? `Shared canvas, round ${game.round}. ${party.isMyTurn ? 'You are' : painterName + ' is'} painting.` : 'Shared canvas.'
  );
</script>

<div class="studio">
  <header>
    <p class="tape">{game?.partyId ?? 'Connecting…'}</p>
    {#if game && game.phase !== 'lobby'}
      <p class="round">Round <strong>{game.round}</strong> of {game.totalRounds}</p>
      <TimerDial secondsLeft={game.secondsLeft} totalSeconds={game.turnSeconds} label={timerLabel} />
    {/if}
    {#if game?.phase === 'lobby' && party.me?.isHost}
      <button type="button" class="primary" onclick={() => party.send({ type: 'start' })}>Start the game</button>
    {/if}
    {#if game?.phase === 'painting' && (party.isMyTurn || party.me?.isHost)}
      <button type="button" class="primary" onclick={() => party.send({ type: 'passNow' })}>Pass now</button>
    {/if}
  </header>

  <main class:room-only={view === 'room'}>
    {#if view === 'paint'}
      <aside class="tools" aria-label="Art supplies">
        {#each TOOL_GROUPS as group (group.label)}
          <div role="group" aria-label={group.label}>
            <p class="group-label">{group.label}</p>
            {#each group.tools as id (id)}
              {@const tool = TOOLS.find((t) => t.id === id)}
              {#if tool}
                <button
                  type="button"
                  title={tool.hint}
                  aria-pressed={brush.tool === id}
                  onclick={() => (brush.tool = id)}
                >
                  {tool.label}
                </button>
              {/if}
            {/each}
          </div>
        {/each}

        <div role="group" aria-label="Paint palette" class="palette">
          {#each PAINTS as paint (paint.hex)}
            <button
              type="button"
              class="paint"
              style:--paint={paint.hex}
              aria-label={mixing ? `Add ${paint.name} to the mix` : paint.name}
              aria-pressed={mixing ? slotA?.hex === paint.hex || slotB?.hex === paint.hex : brush.color === paint.hex}
              onclick={() => tapPaint(paint)}
            ></button>
          {/each}
          <button type="button" class="mix-toggle" aria-pressed={mixing} onclick={toggleMixing}>
            {mixing ? 'Stop mixing' : 'Mix a color'}
          </button>
          {#if mixing && slotA && mixResult}
            <button
              type="button"
              class="paint"
              style:--paint={mixResult.hex}
              aria-label={`Use the mix of ${mixResult.name}`}
              aria-pressed={brush.color === mixResult.hex}
              onclick={useMix}
            ></button>
          {:else if mixing && slotA}
            <p class="mix-hint">Now tap a second paint to mix with {slotA.name}</p>
          {:else if mixing}
            <p class="mix-hint">Tap two paints to mix them</p>
          {/if}
        </div>

        <label>Brush size {brush.size}<input type="range" min="2" max="80" bind:value={brush.size} /></label>
        {#if brush.tool === 'acrylic'}
          <label>Paint viscosity {Math.round(brush.viscosity * 100)}%<input type="range" min="0" max="1" step="0.05" bind:value={brush.viscosity} /></label>
        {/if}
      </aside>

      <div class="canvas-wrap">
        <PaintCanvas bind:this={canvas} {brush} canDraw={party.isMyTurn} label={canvasLabel} onstroke={(stroke) => party.send({ type: 'stroke', stroke })} />
        {#if game?.phase === 'painting' && !party.isMyTurn}
          <p class="watching">Watching {painterName} paint</p>
        {/if}
      </div>

      <aside class="guests" aria-label="Around the table">
        <h2>Around the table</h2>
        <ul>
          {#each game?.order ?? [] as id (id)}
            {@const member = game?.members.find((m) => m.id === id)}
            {#if member}
              <li>
                <VideoTile
                  name={member.name}
                  you={member.id === party.youId}
                  host={member.isHost}
                  painting={member.id === game?.painterId}
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
      </aside>
    {:else}
      <!-- Loaded only when opened: the 360° viewer (three.js) is the heaviest part of the app. -->
      {#await import('./room/RoomView.svelte')}
        <p>Opening the room…</p>
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
  </main>

  <CallDock {call} inRoom={view === 'room'} onToggleRoom={() => (view = view === 'paint' ? 'room' : 'paint')} onLeave={leave} />

  {#if game?.phase === 'passing'}
    <div class="pass" role="alertdialog" aria-labelledby="pass-title">
      <div class="card">
        <p class="hand">Time's up!</p>
        <h2 id="pass-title">Pass the canvas</h2>
      </div>
    </div>
  {/if}

  {#if game?.phase === 'reveal'}
    <div class="pass" role="dialog" aria-labelledby="reveal-title">
      <div class="card">
        <h2 id="reveal-title">You made this together.</h2>
        {#if game.snapshotUrl}
          <img src={game.snapshotUrl} alt="The finished group painting" />
          <a href={game.snapshotUrl} download="pass-the-canvas.png">Download full size</a>
        {/if}
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
    display: flex;
    flex-direction: column;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 1.25rem;
    background: rgb(24 16 11 / 0.82);
  }

  .tape {
    @include tape-label;
    margin: 0;
    font-size: 1.5rem;
  }

  .round {
    margin: 0;
  }

  main {
    flex: 1;
    display: grid;
    grid-template-columns: 15rem minmax(0, 1fr) 13rem;
    gap: 1.25rem;
    padding: 1.25rem 1.25rem 6rem;

    // The room view is the only child when open; give it the whole table.
    &.room-only {
      grid-template-columns: minmax(0, 1fr);
    }

    @media (max-width: 1000px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .tools {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    [role='group'] {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .group-label {
      width: 100%;
      margin: 0;
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: $cream-muted;
    }

    button {
      @include tap-target;
      padding: 0 0.75rem;
      border-radius: $radius-sm;
      border: 1px solid rgb(255 230 200 / 0.25);
      background: rgb(24 16 11 / 0.55);
      color: $cream;
    }

    button[aria-pressed='true'] {
      background: $cream;
      color: $walnut-900;
    }

    .paint {
      width: $tap-min;
      padding: 0;
      border-radius: 50%;
      background: var(--paint);
    }

    .paint[aria-pressed='true'] {
      background: var(--paint);
      box-shadow:
        0 0 0 3px $paper,
        0 0 0 6px $walnut-900;
    }

    .mix-toggle {
      width: 100%;
    }

    .mix-hint {
      width: 100%;
      margin: 0;
      font-size: 0.875rem;
      color: $cream-muted;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    input {
      accent-color: $cadmium-orange;
    }
  }

  .canvas-wrap {
    position: relative;
    align-self: start;
    width: min(100%, calc((100dvh - 14rem) * 4 / 3));
    justify-self: center;
  }

  .watching {
    position: absolute;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.625rem 1.125rem;
    border-radius: $radius-pill;
    background: rgb(24 16 11 / 0.88);
    white-space: nowrap;
  }

  .guests {
    h2 {
      font-size: 1.125rem;
      margin: 0 0 0.5rem;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
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

  .pass {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: rgb(20 13 9 / 0.72);

    .card {
      max-width: 32rem;
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
</style>
