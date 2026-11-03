<!--
  The time-lapse: the party's own strokes, redrawn from a blank canvas.
  Built from the strokes this screen already has (no video, nothing new is
  stored). It opens on the finished picture and never plays by itself;
  the Play button starts it. The artists' names are a chapter list: the one
  whose turn is playing is highlighted, and choosing a name jumps there.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { PaintedStroke } from '@ptc/shared';
  import { TurnLayers } from './layers';

  interface Props {
    strokes: PaintedStroke[];
    width: number;
    height: number;
    /** Painter id → name, for the caption. */
    names: Record<string, string>;
    /** The turns on this canvas, in order: the chapter list. */
    turns?: { round: number; painterName: string }[];
  }
  let { strokes, width, height, names, turns = [] }: Props = $props();

  // About twelve seconds for a whole party, however long it was.
  const SECONDS = 12;

  let canvas: HTMLCanvasElement;
  let position = $state(0); // how many strokes are drawn
  let playing = $state(false);
  let frame = 0;
  // svelte-ignore state_referenced_locally — the canvas shape is fixed once the party is over
  const layers = new TurnLayers(width, height);
  let drawn = 0;

  let total = $derived(strokes.length);
  let current = $derived(strokes[Math.max(0, Math.min(total, position) - 1)]);
  let caption = $derived(current ? `Round ${current.round} · ${names[current.painterId] ?? 'A guest'}` : 'A blank canvas');

  onMount(() => seek(total));
  onDestroy(() => cancelAnimationFrame(frame));

  /** Draw up to `target` strokes, rebuilding from blank if going backwards. */
  function seek(target: number) {
    const next = Math.max(0, Math.min(total, Math.round(target)));
    if (next < drawn) {
      layers.reset(width, height);
      drawn = 0;
    }
    for (; drawn < next; drawn++) layers.apply(strokes[drawn]!);
    position = next;
    show();
  }

  function show() {
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#e1dfda';
    context.fillRect(0, 0, width, height);
    const flat = document.createElement('canvas');
    flat.width = width;
    flat.height = height;
    layers.composite(flat.getContext('2d')!);
    context.drawImage(flat, 0, 0);
  }

  function play() {
    if (position >= total) seek(0);
    playing = true;
    const perFrame = Math.max(1, Math.ceil(total / (SECONDS * 60)));
    const step = () => {
      if (!playing) return;
      seek(position + perFrame);
      if (position >= total) { playing = false; return; }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  /** Jump to the start of a round's turn. */
  function jumpTo(round: number) {
    pause();
    const first = strokes.findIndex((stroke) => stroke.round === round);
    seek(first === -1 ? total : first + 1);
  }
  let currentRound = $derived(current?.round ?? 0);

  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
  }
</script>

<figure class="lapse">
  <canvas bind:this={canvas} {width} {height} aria-hidden="true"></canvas>
  <figcaption>
    <span class="caption">{caption}</span>
    {#if total}
      <span class="controls">
        {#if playing}
          <button type="button" onclick={pause}>Pause</button>
        {:else}
          <button type="button" onclick={play}>{position >= total ? 'Play the time-lapse' : 'Keep playing'}</button>
        {/if}
        <label>
          <span class="sr-only">Time-lapse position</span>
          <input type="range" min="0" max={total} value={position} aria-valuetext={caption}
            oninput={(event) => { pause(); seek(event.currentTarget.valueAsNumber); }} />
        </label>
      </span>
    {:else}
      <span class="caption">No strokes were recorded for this piece.</span>
    {/if}
  {#if turns.length && total}
      <ol class="chapters" aria-label="Jump to an artist's turn">
        {#each turns as turn (turn.round)}
          <li><button type="button" aria-current={turn.round === currentRound ? 'step' : undefined} onclick={() => jumpTo(turn.round)}>{turn.round}. {turn.painterName}</button></li>
        {/each}
      </ol>
    {/if}
  </figcaption>
</figure>

<style lang="scss">
  @use '../../styles/tokens' as *;

  .lapse {
    margin: 0;
  }

  canvas {
    display: block;
    width: 100%;
    height: auto;
    // A simple wooden frame around the piece.
    border: 12px solid #6b4426;
    border-image: linear-gradient(135deg, #8a5a33, #4a2e18 60%, #7a4e2b) 1;
    box-shadow: 0 10px 24px rgb(0 0 0 / 0.35), inset 0 0 0 1px rgb(0 0 0 / 0.3);
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    margin-top: 0.75rem;
  }

  .chapters {
    flex-basis: 100%;
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;

    button {
      font-weight: 400;
    }
    // The artist whose turn is playing: filled, plus aria-current for screen readers.
    [aria-current='step'] {
      background: $walnut-900;
      color: $cream;
      font-weight: 700;
    }
  }

  .caption {
    font-weight: 700;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1 1 16rem;
  }

  label {
    flex: 1;
  }

  input {
    width: 100%;
    min-height: $tap-min;
    accent-color: $cadmium-orange;
  }

  button {
    min-height: $tap-min;
    padding: 0 1rem;
    border: 1px solid #b9a483;
    border-radius: $radius-pill;
    background: transparent;
    color: $walnut-900;
    font-weight: 700;
    white-space: nowrap;
  }
</style>
