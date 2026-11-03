<!--
  The shared party canvas inside its movable, zoomable window.
  - Your own marks: pointer/touch/keyboard input → evenly spaced stamps →
    drawn into your turn's layer right away, and sent to the party in small
    batches (about 20 a second).
  - Everyone else's marks arrive from the party and go through the very same
    layer engine, so every screen ends up with the same picture.
  - Only the current painter can mark. Everyone can zoom, pan and rotate.
-->
<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from 'svelte';
  import type { PaintedStroke, Stamp, Stroke } from '@ptc/shared';
  import { partyUrl } from '../party/origin';
  import { canPaint, TOOL_NAMES, type PaintingSelection } from './painting-selection';
  import { stampSpacing, type StrokePoint } from './brushes';
  import { TurnLayers } from './layers';
  import { fitCamera, zoomCamera, screenToCanvas, rotateVector, type CanvasCamera } from './camera';

  interface Props {
    selection: PaintingSelection;
    size: number;
    intensity?: number;
    mode?: 'paint' | 'arrange';
    /** Is it your turn? */
    canDraw: boolean;
    /** Your party member id and the current round: they name your turn's layer. */
    painterId: string;
    round: number;
    /** Spoken summary, e.g. "Round 2. Jordan is painting." */
    label: string;
    wheelZoom?: boolean;
    /** Which canvas is on the table ("c1"…, or "lobby" before the game). Strokes carry it. */
    canvasKey: string;
    documentWidth: number;
    documentHeight: number;
    baseWidth?: number;
    rotation?: number;
    fitVersion?: number;
    onresizewindow?: (width: number, height: number) => void;
    ontoolbarheight?: (height: number) => void;
    onstroke?: (stroke: Stroke) => void;
  }
  let { selection, size, intensity = 0.5, mode = 'paint', canDraw, painterId, round, label, wheelZoom = false, canvasKey, documentWidth, documentHeight, baseWidth = 800, rotation = $bindable(0), fitVersion = 0, onresizewindow, ontoolbarheight, onstroke }: Props = $props();

  let element: HTMLCanvasElement;
  let viewport: HTMLDivElement;
  let toolbar: HTMLDivElement;
  let thumbnail = $state<HTMLCanvasElement>();
  let ready = $state(false);
  let view = $state<CanvasCamera>({ zoom: 1, x: 0, y: 0, rotation: 0 });
  let windowSize = $state({ width: 800, height: 425 });
  let frame = $derived({ ...windowSize, documentWidth, documentHeight, scale: Math.max(0.05, (baseWidth - 32) / documentWidth) });
  let fitted = $derived(fitCamera(view, frame));
  let atFit = $derived(Math.abs(view.zoom - fitted.zoom) < 0.001 && Math.abs(view.x) < 0.5 && Math.abs(view.y) < 0.5);
  let resizeStart: { x: number; y: number; width: number; height: number } | null = null;
  let didFit = $state(false);
  let painting = $derived(mode === 'paint' && canDraw);
  function fitView() { return fitCamera(view, frame); }
  function zoomView(camera: CanvasCamera, zoom: number, x = 0.5, y = 0.5) { return zoomCamera(camera, zoom, frame, x * frame.width, y * frame.height); }
  function panView(camera: CanvasCamera, x: number, y: number) { return { ...camera, x: camera.x - x * frame.width, y: camera.y - y * frame.height }; }
  $effect(() => { view.rotation = rotation; });
  $effect(() => { if (ready && frame.width > 0 && !didFit) { didFit = true; view = fitCamera(view, frame); } });
  $effect(() => {
    void fitVersion;
    if (!ready) return;
    void tick().then(() => {
      windowSize = { width: viewport.clientWidth, height: viewport.clientHeight };
      view = fitCamera(view, { ...frame, ...windowSize });
    });
  });
  let cursor = $state({ x: 800, y: 425 });
  let focused = $state(false);
  let announcement = $state('');
  let context: CanvasRenderingContext2D;
  // svelte-ignore state_referenced_locally — the engine is rebuilt below when the shape changes
  const layers = new TurnLayers(documentWidth, documentHeight);
  /** Every stroke this screen has drawn, for the painting-data export. */
  let log: PaintedStroke[] = [];
  /** False when this screen joined too late to get every stroke (snapshot base instead). */
  let fullHistory = true;

  // ---- the stroke in progress ----
  let stroke: { id: string; canvasId: string; selection: PaintingSelection; size: number; intensity: number; last: StrokePoint; carry: number; index: number; angle: number } | null = null;
  /** Stamps not yet sent to the party. */
  let outgoing: Stamp[] = [];
  let outgoingFirst = 0;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** Touch strokes wait a moment before sending, so a second finger can still turn them into a pinch. */
  let holdUntil = 0;
  let sentAny = false;
  let pointerId: number | null = null;
  let touches = new Map<number, { x: number; y: number }>();
  let touchBackup: { surface: HTMLCanvasElement; pixels: ImageData }[] = [];
  let gesture = false;
  let pendingTouch = false;
  let panStart: { x: number; y: number; view: CanvasCamera } | null = null;
  let pinch: { distance: number; midpointX: number; midpointY: number; view: CanvasCamera } | null = null;
  let spray: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    context = element.getContext('2d')!;
    windowSize = { width: viewport.clientWidth, height: viewport.clientHeight };
    ready = true;
    let firstObservation = true;
    const observer = new ResizeObserver(() => {
      windowSize = { width: viewport.clientWidth, height: viewport.clientHeight };
      if (firstObservation) { firstObservation = false; view = fitCamera(view, { ...frame, ...windowSize }); }
    });
    observer.observe(viewport);
    const toolbarObserver = new ResizeObserver(() => ontoolbarheight?.(toolbar.offsetHeight));
    toolbarObserver.observe(toolbar);
    return () => { observer.disconnect(); toolbarObserver.disconnect(); };
  });
  onDestroy(stopStroke);

  // A different canvas on the table (the round moved on) starts clean, unless
  // its history already arrived and was drawn.
  let loadedKey = '';
  $effect(() => {
    const key = canvasKey;
    const width = documentWidth;
    const height = documentHeight;
    if (!ready) return;
    untrack(() => {
      if (loadedKey === key && layers.width === width && layers.height === height) { redraw(); return; }
      stopStroke();
      loadedKey = key;
      layers.reset(width, height);
      log = [];
      cursor = { x: width / 2, y: height / 2 };
      didFit = false;
      redraw();
    });
  });
  // Turn over, tool down or Arrange mode: finish (and send) any stroke in progress.
  $effect(() => {
    if (!painting || selection.tool === null) untrack(stopStroke);
  });

  function redraw() {
    if (!context) return;
    layers.composite(context);
    if (thumbnail) {
      const small = thumbnail.getContext('2d')!;
      small.clearRect(0, 0, thumbnail.width, thumbnail.height);
      small.drawImage(element, 0, 0, thumbnail.width, thumbnail.height);
    }
  }
  $effect(() => { if (!atFit && ready && thumbnail) untrack(redraw); });

  // ---------- called by the parent ----------

  /** Someone else's stroke, relayed by the party. */
  export function applyRemote(remote: PaintedStroke) {
    if (remote.canvasId !== loadedKey) return; // meant for a canvas we're not showing
    layers.apply(remote);
    log.push(remote);
    redraw();
  }

  /** Late joiner: rebuild every turn's layer from the party's history. */
  export async function loadHistory(key: string, width: number, height: number, strokes: PaintedStroke[], complete: boolean, snapshotUrl: string | null) {
    stopStroke();
    loadedKey = key;
    layers.reset(width, height);
    log = [];
    fullHistory = complete;
    if (!complete && snapshotUrl) {
      // Too much history to replay: show the latest saved picture, protected.
      const image = new Image();
      image.crossOrigin = 'anonymous'; // the party server may be another origin; keeps the canvas exportable
      image.src = partyUrl(snapshotUrl);
      try { await image.decode(); layers.setBase(image); } catch { /* keep painting on a blank base */ }
    }
    for (const remote of strokes) { layers.apply(remote); log.push(remote); }
    redraw();
  }

  /** The key of the canvas currently drawn (to ignore strokes meant for another). */
  export function currentKey() {
    return loadedKey;
  }

  /** The finished picture on paper, as a PNG data URL (for the round snapshot). */
  export function snapshot(): string {
    flush(true);
    const flat = document.createElement('canvas');
    flat.width = documentWidth;
    flat.height = documentHeight;
    const paper = flat.getContext('2d')!;
    paper.fillStyle = '#e1dfda'; // the canvas color behind the paint
    paper.fillRect(0, 0, flat.width, flat.height);
    paper.drawImage(element, 0, 0);
    return flat.toDataURL('image/png');
  }

  /** End any stroke in progress and send its last stamps (before passing). */
  export function finishStroke() {
    stopStroke();
  }

  /** Every stroke drawn on this screen so far, in order (for the time-lapse). */
  export function strokes(): PaintedStroke[] {
    return fullHistory ? log : [];
  }

  /** Painting data only (no audio or video), for the "Export painting data" menu item. */
  export function downloadStrokes() {
    const data = { format: 'ptc-party-strokes', version: 1, width: documentWidth, height: documentHeight, strokes: log };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'pass-the-canvas-strokes.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announcement = 'Painting data exported. Strokes only; no audio or video.';
  }

  // ---------- your own painting ----------

  function point(event: PointerEvent): StrokePoint {
    const box = viewport.getBoundingClientRect();
    const local = screenToCanvas(event.clientX - box.left, event.clientY - box.top, view, frame);
    return { ...local, pressure: event.pointerType === 'mouse' || !event.pressure ? 0.5 : event.pressure };
  }

  /** One stamp: draw it into your layer now, and queue it for the party. */
  function emit(at: StrokePoint) {
    if (!stroke) return;
    const stamp: Stamp = { x: round1(at.x), y: round1(at.y), pressure: round3(at.pressure), angle: round3(stroke.angle) };
    const batch = makeStroke([stamp], stroke.index, false);
    layers.apply({ ...batch, painterId, round });
    if (!outgoing.length) outgoingFirst = stroke.index;
    outgoing.push(stamp);
    stroke.index += 1;
    if (performance.now() >= holdUntil) flushTimer ??= setTimeout(() => flush(false), 50);
  }

  function makeStroke(stamps: Stamp[], first: number, done: boolean): Stroke {
    const held = stroke!;
    return { id: held.id, canvasId: held.canvasId, tool: held.selection.tool!, load: held.selection.load, wet: held.selection.wet, size: held.size, intensity: held.intensity, first, stamps, done };
  }

  function flush(done: boolean) {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    if (!stroke || (!outgoing.length && !done)) return;
    if (!done && performance.now() < holdUntil) return;
    if (!outgoing.length && !sentAny) return; // nothing was ever sent: no need for a "done"
    const batch = makeStroke(outgoing, outgoing.length ? outgoingFirst : stroke.index, done);
    log.push({ ...batch, painterId, round });
    onstroke?.(batch);
    sentAny = true;
    outgoing = [];
  }

  function begin(at: StrokePoint, touch = false) {
    stroke = { id: crypto.randomUUID(), canvasId: canvasKey, selection: $state.snapshot(selection), size, intensity, last: at, carry: 0, index: 0, angle: 0 };
    outgoing = []; sentAny = false;
    holdUntil = touch ? performance.now() + 200 : 0;
    emit(at);
    redraw();
    if (selection.tool === 'airbrush') spray = setInterval(() => { if (stroke) { emit(stroke.last); redraw(); } }, 40);
  }
  function lineTo(next: StrokePoint) {
    if (!stroke) return;
    const previous = stroke.last;
    const dx = next.x - previous.x; const dy = next.y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return;
    stroke.angle = Math.atan2(dy, dx);
    const spacing = stampSpacing(stroke.selection, stroke.size);
    let travel = spacing - stroke.carry;
    for (; travel <= distance; travel += spacing) {
      const fraction = travel / distance;
      emit({ x: previous.x + dx * fraction, y: previous.y + dy * fraction, pressure: previous.pressure + (next.pressure - previous.pressure) * fraction });
    }
    stroke.carry = (stroke.carry + distance) % spacing;
    stroke.last = next;
    redraw();
  }
  /** Finish the stroke and send what's left. */
  function stopStroke() {
    if (spray) clearInterval(spray);
    spray = undefined;
    if (stroke) { holdUntil = 0; flush(true); }
    stroke = null;
  }
  /** A second finger arrived before anything was sent: undo the tentative mark. */
  function cancelTentativeStroke(): boolean {
    if (!stroke || sentAny || !touchBackup.length) return false;
    if (spray) clearInterval(spray);
    spray = undefined;
    for (const backup of touchBackup) backup.surface.getContext('2d')!.putImageData(backup.pixels, 0, 0);
    stroke = null; outgoing = [];
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    return true;
  }

  function down(event: PointerEvent) {
    if (event.pointerType === 'mouse' && ![0, 2].includes(event.button)) return;
    viewport.setPointerCapture(event.pointerId);
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size >= 2) {
      // A second finger converts the interaction into navigation.
      if (!cancelTentativeStroke()) stopStroke();
      redraw(); gesture = true; pendingTouch = false;
      const [a, b] = [...touches.values()];
      pinch = { distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), midpointX: (a.x + b.x) / 2, midpointY: (a.y + b.y) / 2, view: { ...view } };
      return;
    }
    pointerId = event.pointerId;
    if (event.button === 2 || mode === 'arrange' || event.altKey) {
      panStart = { x: event.clientX, y: event.clientY, view: { ...view } };
      return;
    }
    // Not your turn: a plain drag does nothing (no surprise panning while you
    // watch). Right-drag, Alt-drag, two fingers and Arrange & view still move the view.
    if (!canDraw) return;
    if (!canPaint(selection) || !(event.target instanceof HTMLCanvasElement)) return;
    if (event.pointerType === 'touch') {
      // Snapshot your layers so a pinch that starts as one finger leaves no mark.
      layers.prepare(painterId, round);
      touchBackup = layers.ownedSurfaces(painterId).map(surface => ({ surface, pixels: surface.getContext('2d')!.getImageData(0, 0, documentWidth, documentHeight) }));
      pendingTouch = true;
    } else begin(point(event));
  }
  function move(event: PointerEvent) {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const box = viewport.getBoundingClientRect();
    if (pinch && touches.size >= 2) {
      const [a, b] = [...touches.values()];
      const middleX = (a.x + b.x) / 2; const middleY = (a.y + b.y) / 2;
      const ratio = Math.hypot(b.x - a.x, b.y - a.y) / pinch.distance;
      const zoomed = zoomView(pinch.view, pinch.view.zoom * ratio, (pinch.midpointX - box.left) / box.width, (pinch.midpointY - box.top) / box.height);
      view = panView(zoomed, (pinch.midpointX - middleX) / box.width, (pinch.midpointY - middleY) / box.height);
      return;
    }
    if (gesture || event.pointerId !== pointerId) return;
    if (panStart) {
      view = panView(panStart.view, (panStart.x - event.clientX) / box.width, (panStart.y - event.clientY) / box.height);
      return;
    }
    if (pendingTouch && canPaint(selection) && painting) { pendingTouch = false; begin(point(event), true); }
    if (stroke) lineTo(point(event));
  }
  function up(event: PointerEvent) {
    if (!touches.has(event.pointerId)) return;
    if (event.type !== 'pointercancel' && pendingTouch && !gesture && event.pointerId === pointerId && painting && canPaint(selection)) begin(point(event), true);
    touches.delete(event.pointerId);
    if (event.pointerId === pointerId) { stopStroke(); panStart = null; pendingTouch = false; }
    if (touches.size === 0) { gesture = false; pinch = null; touchBackup = []; pointerId = null; }
  }
  function wheel(event: WheelEvent) {
    if (!wheelZoom && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const box = viewport.getBoundingClientRect();
    view = zoomView(view, view.zoom * Math.exp(-event.deltaY * 0.003), (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); view = zoomView(view, view.zoom * 1.25); return; }
    if (event.key === '-') { event.preventDefault(); view = zoomView(view, view.zoom / 1.25); return; }
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction && event.key !== ' ') return;
    event.preventDefault();
    if (!painting || event.altKey) {
      if (direction) view = panView(view, direction[0] * 0.1, direction[1] * 0.1);
      return;
    }
    const before = { ...cursor, pressure: 0.5 };
    if (direction) { const step = rotateVector(direction[0] * 20, direction[1] * 20, -rotation); cursor = { x: Math.max(0, Math.min(documentWidth, cursor.x + step.x)), y: Math.max(0, Math.min(documentHeight, cursor.y + step.y)) }; }
    if (canPaint(selection) && ((!direction && event.key === ' ') || event.shiftKey)) {
      begin(before);
      if (direction) lineTo({ ...cursor, pressure: 0.5 });
      stopStroke();
    }
    announcement = canPaint(selection) ? `Cursor ${Math.round(cursor.x / documentWidth * 100)} percent across, ${Math.round(cursor.y / documentHeight * 100)} percent down.` : 'Choose and load a tool first.';
  }
  function navigate(event: MouseEvent) {
    const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const scale = Math.min(rect.width / documentWidth, rect.height / documentHeight);
    const x = (event.clientX - rect.left - (rect.width - documentWidth * scale) / 2) / scale;
    const y = (event.clientY - rect.top - (rect.height - documentHeight * scale) / 2) / scale;
    const shifted = rotateVector((x - documentWidth / 2) * frame.scale * view.zoom, (y - documentHeight / 2) * frame.scale * view.zoom, rotation);
    view = { ...view, x: -shifted.x, y: -shifted.y };
  }
  let navigatorPoints = $derived([[0, 0], [frame.width, 0], [frame.width, frame.height], [0, frame.height]].map(([x, y]) => { const p = screenToCanvas(x, y, view, frame); return `${p.x},${p.y}`; }).join(' '));
  function startResize(event: PointerEvent) {
    if (event.button !== 0) return;
    resizeStart = { x: event.clientX, y: event.clientY, ...windowSize };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function resize(event: PointerEvent) {
    if (resizeStart) onresizewindow?.(resizeStart.width + event.clientX - resizeStart.x, resizeStart.height + event.clientY - resizeStart.y);
  }
  function resizeKey(event: KeyboardEvent) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    if (steps[event.key]) { event.preventDefault(); onresizewindow?.(frame.width + steps[event.key][0], frame.height + steps[event.key][1]); }
  }
  // Short numbers keep network messages small; a tenth of a canvas pixel is invisible.
  function round1(n: number) { return Math.round(n * 10) / 10; }
  function round3(n: number) { return Math.round(n * 1000) / 1000; }
</script>

<div class="surface">
  <div class="viewport" bind:this={viewport} role="application" aria-label="Shared canvas and view controls"
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onlostpointercapture={up}
    oncontextmenu={(event) => event.preventDefault()} onwheel={wheel}>
    <div class="paper" style:width={`${documentWidth * frame.scale * view.zoom}px`} style:height={`${documentHeight * frame.scale * view.zoom}px`} style:--edge={`${9 * view.zoom}px`} style:transform={`translate(-50%, -50%) translate(${view.x}px, ${view.y}px) rotate(${rotation * 90}deg)`}><div class="artwork">
      <canvas bind:this={element} width={documentWidth} height={documentHeight} tabindex="0" aria-roledescription="painting surface"
        aria-label={`${label} ${painting ? (selection.tool ? TOOL_NAMES[selection.tool] : 'No tool') + ' in hand.' : mode === 'arrange' ? 'Canvas locked while arranging.' : 'View only.'}`}
        aria-describedby="painting-keyboard-help" class:ready={painting && canPaint(selection)}
        onkeydown={keyboard} onfocus={() => focused = true} onblur={() => focused = false}></canvas>
      {#if focused && painting}<span class="cursor" aria-hidden="true" style:left={`${cursor.x / documentWidth * 100}%`} style:top={`${cursor.y / documentHeight * 100}%`}></span>{/if}
    </div></div>
  </div>
  <div bind:this={toolbar} class="view-controls" aria-label="Canvas view">
    <label class="zoom-slider">Zoom <input type="range" aria-label="Canvas zoom" min="10" max="600" step="1" value={Math.round(view.zoom * 100)} oninput={(event) => view = zoomView(view, event.currentTarget.valueAsNumber / 100)} /><output>{Math.round(view.zoom * 100)}%</output></label>
    <select aria-label="Quick zoom" value={[0.25, 0.5, 1, 1.5, 2, 3, 4, 6].includes(view.zoom) ? view.zoom : ''} onchange={(event) => { if (event.currentTarget.value) view = zoomView(view, Number(event.currentTarget.value)); }}><option value="" disabled>Zoom to…</option>{#each [0.25, 0.5, 1, 1.5, 2, 3, 4, 6] as level}<option value={level}>{level * 100}%</option>{/each}</select>
    <button type="button" disabled={atFit} onclick={() => view = fitView()}>Fit</button>
    <button type="button" aria-label="Rotate canvas clockwise" title="Rotate canvas 90 degrees" onclick={() => { stopStroke(); rotation = (rotation + 1) % 4; }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /></svg></button>
    <details class="window-options"><summary>Window size</summary><form onsubmit={(event) => { event.preventDefault(); const fields = new FormData(event.currentTarget); onresizewindow?.(Number(fields.get('width')), Number(fields.get('height'))); }}><label>Width<input type="number" aria-label="Canvas window width" name="width" min="260" value={Math.round(frame.width)} /></label><label>Height<input type="number" aria-label="Canvas window height" name="height" min="200" value={Math.round(frame.height)} /></label><button type="submit">Apply</button></form></details>
    <aside class="navigator" class:inactive={atFit} aria-hidden={atFit} aria-label="Canvas navigator">
      <span>Navigator</span>
      <button type="button" class="map" disabled={atFit} tabindex={atFit ? -1 : 0} aria-label="Recenter canvas navigator. Arrow keys pan."
        onclick={navigate} onkeydown={(event) => { const directions: Record<string, [number, number]> = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }; const step = directions[event.key]; if (step) { event.preventDefault(); view = panView(view, ...step); } }}>
        <canvas bind:this={thumbnail} width={160} height={Math.round(160 * documentHeight / documentWidth)} aria-hidden="true"></canvas>
        <svg class="map-area" viewBox={`0 0 ${documentWidth} ${documentHeight}`} aria-hidden="true"><polygon points={navigatorPoints} /></svg>
      </button>
    </aside>
  </div>
  <button type="button" class="resize-handle" aria-label="Resize canvas window. Drag or use arrow keys." onpointerdown={startResize} onpointermove={resize} onpointerup={() => resizeStart = null} onpointercancel={() => resizeStart = null} onkeydown={resizeKey}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 20 14-14M12 20l8-8M18 20l2-2" /></svg></button>
</div>
<p id="painting-keyboard-help" class="sr-only">On your turn, arrows move the cursor, Space stamps and Shift+arrows draws. When it isn't your turn, or in Arrange and view, arrows pan. Plus and minus zoom. Alt+arrows pan in either mode. Right-drag pans; two fingers pan and pinch to zoom. Tab leaves the canvas. Earlier painters' turns are protected.</p>
<span class="sr-only" role="status">{announcement}</span>

<style lang="scss">
  .surface { position: absolute; inset: 0; }
  .viewport { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; outline: 1px solid #b7a17a; box-shadow: inset 0 0 8px #0007; }
  .paper { position: absolute; left: 50%; top: 50%; background: #e1dfda var(--surface) center / 100% 100%; box-shadow: 10px 16px 14px #0008; }
  .paper::before { content: ''; position: absolute; right: 100%; top: 0; width: var(--edge); height: 100%; background: linear-gradient(90deg, #77766e, #bbb9ae); }
  .paper::after { content: ''; position: absolute; top: 100%; left: calc(-1 * var(--edge)); right: 0; height: calc(var(--edge) * 1.5); background: linear-gradient(#8a887f, #55544e); }
  .artwork { width: 100%; height: 100%; position: relative; }
  .artwork > canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  .artwork > canvas.ready { cursor: crosshair; }
  .cursor { position: absolute; width: 18px; height: 18px; border: 2px solid #222; outline: 2px solid white; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; }
  .navigator.inactive { visibility: hidden; pointer-events: none; }
  .view-controls { position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translateX(-50%); width: max(100%, min(760px, calc(100vw - 24px))); display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: #fff5e4; }
  button, select, summary { min-width: 44px; min-height: 44px; border: 1px solid #ad9b73; border-radius: 3px; background: #241a11; color: #fff5e4; font: inherit; padding: 6px 8px; }
  button:disabled { opacity: .45; }
  .zoom-slider { display: flex; align-items: center; gap: 5px; font-size: 12px; }
  .zoom-slider input { width: 100px; height: 44px; accent-color: #eee935; }
  output { font-size: 12px; min-width: 34px; }
  .window-options { position: relative; }
  summary { display: flex; align-items: center; cursor: pointer; }
  .window-options > form { position: absolute; right: 0; top: 48px; z-index: 20; display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; width: 250px; background: #241a11; border: 1px solid #ad9b73; }
  .window-options label { width: 100px; font-size: 12px; }
  .window-options input { width: 100%; min-height: 44px; background: #17100c; color: #fff5e4; border: 1px solid #ad9b73; }
  .resize-handle { position: absolute; right: 0; top: calc(100% + 6px); cursor: nwse-resize; touch-action: none; }
  .navigator { width: 100px; padding: 4px; background: #20180ff2; color: #fff5e4; border: 1px solid #ad9b73; border-radius: 4px; font-size: 11px; }
  .map { display: block; position: relative; width: 100%; height: 52px; padding: 0; margin-top: 4px; overflow: hidden; background: #a89b80; }
  .map canvas, .map-area { width: 100%; height: 100%; display: block; object-fit: contain; position: absolute; inset: 0; }
  .map-area polygon { stroke: #f1ec35; stroke-width: 12; fill: #eee83518; }
</style>
