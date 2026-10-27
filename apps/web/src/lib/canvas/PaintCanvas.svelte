<!--
  The shared canvas. Handles pointer input (with pen pressure), draws locally,
  and hands batches of points to the parent to send to the party server.
  The parent can also replay remote strokes and grab a PNG snapshot.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { CANVAS_HEIGHT, CANVAS_WIDTH, type Stroke, type StrokePoint } from '@ptc/shared';
  import { drawSegment, StrokeReplayer, type BrushSettings } from './brushes';

  interface Props {
    brush: BrushSettings;
    canDraw: boolean;
    label: string; // spoken description, e.g. "Shared canvas, round 3. Jordan is painting."
    onstroke?: (stroke: Stroke) => void;
  }
  let { brush, canDraw, label, onstroke }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let replayer: StrokeReplayer;

  // The stroke in progress.
  let strokeId = '';
  let last: StrokePoint | null = null;
  let pending: StrokePoint[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    ctx = canvasEl.getContext('2d')!;
    replayer = new StrokeReplayer(ctx);
  });

  /** Screen position → canvas units, plus pressure (mice report 0.5). */
  function toCanvasPoint(event: PointerEvent): StrokePoint {
    const box = canvasEl.getBoundingClientRect();
    const pressure = event.pointerType === 'mouse' || !event.pressure ? 0.5 : event.pressure;
    return {
      x: ((event.clientX - box.left) * CANVAS_WIDTH) / box.width,
      y: ((event.clientY - box.top) * CANVAS_HEIGHT) / box.height,
      pressure
    };
  }

  function handleDown(event: PointerEvent) {
    if (!canDraw) return;
    // Capture keeps the stroke alive even if the pointer leaves the canvas.
    // Some browsers throw when the pointer is already gone (fast taps); the
    // stroke can still proceed without capture.
    try {
      canvasEl.setPointerCapture(event.pointerId);
    } catch {
      /* paint without capture */
    }
    strokeId = crypto.randomUUID();
    last = toCanvasPoint(event);
    pending = [last];
    drawSegment(ctx, brush, last, { ...last, x: last.x + 0.1 });
  }

  function handleMove(event: PointerEvent) {
    if (!last) return;
    // Coalesced events give us every pen sample, not just one per frame: smoother lines.
    const samples = event.getCoalescedEvents?.() ?? [event];
    for (const sample of samples.length ? samples : [event]) {
      const point = toCanvasPoint(sample);
      drawSegment(ctx, brush, last, point);
      pending.push(point);
      last = point;
    }
    // Send about 20 times a second, not on every sample.
    flushTimer ??= setTimeout(() => flush(false), 50);
  }

  function handleUp() {
    if (!last) return;
    flush(true);
    last = null;
  }

  function flush(done: boolean) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    if (pending.length === 0 && !done) return;
    onstroke?.({ id: strokeId, ...brush, points: pending, done });
    // Keep the last point so the next batch connects to this one.
    pending = last ? [last] : [];
  }

  // ---- called by the parent ----

  export function replay(stroke: Stroke) {
    replayer.draw(stroke);
  }

  export function snapshot(): string {
    return canvasEl.toDataURL('image/png');
  }

  export async function loadImage(url: string) {
    const img = new Image();
    img.src = url;
    await img.decode();
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
</script>

<!-- The wrapper carries the spoken description; the canvas itself is just pixels. -->
<div role="img" aria-label={label}>
<canvas
  bind:this={canvasEl}
  width={CANVAS_WIDTH}
  height={CANVAS_HEIGHT}
  aria-hidden="true"
  class:can-draw={canDraw}
  onpointerdown={handleDown}
  onpointermove={handleMove}
  onpointerup={handleUp}
  onpointercancel={handleUp}
></canvas>
</div>

<style lang="scss">
  @use '../../styles/tokens' as *;

  canvas {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    touch-action: none; // stop the page scrolling while painting on touch
    // Linen texture behind transparent paint, so the eraser reveals canvas.
    background:
      repeating-linear-gradient(0deg, rgb(120 100 70 / 0.05) 0 1px, transparent 1px 3px),
      repeating-linear-gradient(90deg, rgb(120 100 70 / 0.05) 0 1px, transparent 1px 3px),
      $paper;
    box-shadow:
      inset 0 0 40px rgb(160 130 90 / 0.18),
      10px 14px 28px rgb(0 0 0 / 0.45);
  }

  .can-draw {
    cursor: crosshair;
  }
</style>
