<!--
  The studio screen: painting view (default) or the 360° room.
  Phase 1 version: functional, plainly styled. The real-object skin from the
  design canvas (brush jar, palette, polaroids) lands in phase 2.
-->
<script lang="ts">
  import type { PartyConnection } from './party/connection.svelte';
  import type { BrushSettings } from './canvas/brushes';
  import { TOOLS } from './canvas/brushes';
  import { PAINTS } from './canvas/paints';
  import PaintCanvas from './canvas/PaintCanvas.svelte';
  import TimerDial from './ui/TimerDial.svelte';

  let { party }: { party: PartyConnection } = $props();

  let view = $state<'paint' | 'room'>('paint');
  let brush = $state<BrushSettings>({ tool: 'round', color: '#2c3f9e', size: 18, flow: 0.9 });
  let canvas: PaintCanvas | undefined = $state();

  // Wire the connection to the canvas.
  $effect(() => {
    party.onRemoteStroke = (stroke) => canvas?.replay(stroke);
    party.onSnapshotRequest = (round) => {
      if (canvas) party.send({ type: 'snapshot', round, pngDataUrl: canvas.snapshot() });
    };
  });

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

  <main>
    {#if view === 'paint'}
      <aside class="tools" aria-label="Art supplies">
        <div role="group" aria-label="Brushes">
          {#each TOOLS as tool (tool.id)}
            <button type="button" aria-pressed={brush.tool === tool.id} onclick={() => (brush.tool = tool.id)}>
              {tool.label}
            </button>
          {/each}
        </div>
        <div role="group" aria-label="Paint palette" class="palette">
          {#each PAINTS as paint (paint.hex)}
            <button
              type="button"
              class="paint"
              style:--paint={paint.hex}
              aria-label={paint.name}
              aria-pressed={brush.color === paint.hex}
              onclick={() => (brush.color = paint.hex)}
            ></button>
          {/each}
        </div>
        <label>Brush size {brush.size}<input type="range" min="2" max="80" bind:value={brush.size} /></label>
      </aside>

      <div class="canvas-wrap">
        <PaintCanvas bind:this={canvas} {brush} canDraw={party.isMyTurn} label={canvasLabel} onstroke={(stroke) => party.send({ type: 'stroke', stroke })} />
        {#if game?.phase === 'painting' && !party.isMyTurn}
          <p class="watching">Watching {painterName} paint</p>
        {/if}
      </div>

      <aside class="guests" aria-label="Around the table">
        <h2>Around the table</h2>
        <ol>
          {#each game?.order ?? [] as id (id)}
            {@const member = game?.members.find((m) => m.id === id)}
            {#if member}
              <li class:painting={member.id === game?.painterId}>
                {member.name}{member.isHost ? ' (host)' : ''}{member.id === party.youId ? ' (you)' : ''}
              </li>
            {/if}
          {/each}
        </ol>
      </aside>
    {:else}
      <!-- Loaded only when opened: the 360° viewer (three.js) is the heaviest part of the app. -->
      {#await import('./room/RoomView.svelte')}
        <p>Opening the room…</p>
      {:then { default: RoomView }}
        <RoomView panorama="/studio/placeholder/panorama.jpg" spotsUrl="/studio/placeholder/spots.json" />
      {/await}
    {/if}
  </main>

  <nav class="dock" aria-label="Call controls">
    <button type="button" aria-pressed={view === 'room'} onclick={() => (view = view === 'paint' ? 'room' : 'paint')}>
      {view === 'paint' ? 'Room view' : 'Back to the canvas'}
    </button>
    <!-- TODO phase 1: mic, camera (LiveKit), chat, leave -->
  </nav>

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
    ol {
      margin: 0;
      padding-left: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .painting {
      color: $cadmium-orange;
      font-weight: 700;
    }
  }

  .dock {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    display: flex;
    gap: 0.375rem;
    padding: 0.5rem;
    border-radius: 18px;
    background: rgb(24 16 11 / 0.92);
    border: 1px solid rgb(255 230 200 / 0.16);

    button {
      min-height: 3rem;
      padding: 0 1rem;
      border: 0;
      border-radius: $radius-md;
      background: rgb(243 234 217 / 0.12);
      color: $cream;
      font-weight: 700;
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
