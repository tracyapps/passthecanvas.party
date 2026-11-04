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
  import { saveFile } from '../download';
  import { holdStill } from '../holdStill';
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
    ontoolbarheight?: (height: number) => void;
    onstroke?: (stroke: Stroke) => void;
  }
  let { selection, size, intensity = 0.5, mode = 'paint', canDraw, painterId, round, label, wheelZoom = false, canvasKey, documentWidth, documentHeight, baseWidth = 800, rotation = $bindable(0), fitVersion = 0, ontoolbarheight, onstroke }: Props = $props();

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
  let didFit = $state(false);
  let painting = $derived(mode === 'paint' && canDraw);
  function fitView() { return fitCamera(view, frame); }
  const ZOOM_LEVELS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6];
  function zoomView(camera: CanvasCamera, zoom: number, x = 0.5, y = 0.5) { return zoomCamera(camera, zoom, frame, x * frame.width, y * frame.height); }
  function panView(camera: CanvasCamera, x: number, y: number) { return { ...camera, x: camera.x - x * frame.width, y: camera.y - y * frame.height }; }
  $effect(() => { view.rotation = rotation; });
  // Until you zoom or pan yourself, the view keeps showing the whole canvas while
  // the window settles or is resized. Any zoom or pan of your own stops that.
  let following = true;
  $effect(() => {
    const target = frame;
    if (!ready || !following) return;
    untrack(() => { view = fitCamera(view, target); });
  });
  function noteViewChange() { following = atFit; }
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
  // The keyboard cursor (a small ring) only shows once you paint with the keyboard, not after a mouse click.
  let keyboardPainting = $state(false);
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
  let touchBackup: { surface: HTMLCanvasElement; copy: HTMLCanvasElement }[] = [];
  let gesture = false;
  let pendingTouch = false;
  let panStart: { x: number; y: number; view: CanvasCamera } | null = null;
  /** Holding Space turns any drag into a pan, even with a tool in hand (like most art apps). */
  let spaceHeld = $state(false);
  let panning = $state(false);
  /** A plain drag moves the view when it can't paint: no tool, nothing loaded, or not your turn. */
  let dragPans = $derived(spaceHeld || mode === 'arrange' || !painting || !canPaint(selection));
  let pinch: { distance: number; midpointX: number; midpointY: number; view: CanvasCamera } | null = null;
  let spray: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    context = element.getContext('2d')!;
    windowSize = { width: viewport.clientWidth, height: viewport.clientHeight };
    ready = true;
    let firstObservation = true;
    const observer = new ResizeObserver(() => {
      // A window that was showing the whole canvas keeps showing it as it resizes.
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

  // Drawing is batched to the screen's refresh: a pencil can report 240 moves a
  // second, but the picture only needs restacking once per frame. That keeps the
  // page free to respond to taps while you paint.
  // ?perf (or &perf) in the address shows a small readout: how long painting work
  // and screen updates take on this device, for tuning tablets.
  const perfOn = typeof location !== 'undefined' && /[?&]perf\b/.test(location.search);
  const perf = { moves: 0, moveMs: 0, frames: 0, frameMs: 0, stamps: 0, worst: 0, since: 0 };
  let perfText = $state('');
  function notePerf() {
    const now = performance.now();
    if (!perf.since) perf.since = now;
    if (now - perf.since < 1000) return;
    const secs = (now - perf.since) / 1000;
    perfText = `moves ${Math.round(perf.moves / secs)}/s · ${perf.moves ? (perf.moveMs / perf.moves).toFixed(1) : 0} ms each (worst ${perf.worst.toFixed(0)}) · stamps ${Math.round(perf.stamps / secs)}/s · redraws ${Math.round(perf.frames / secs)}/s · ${perf.frames ? (perf.frameMs / perf.frames).toFixed(1) : 0} ms each`;
    Object.assign(perf, { moves: 0, moveMs: 0, frames: 0, frameMs: 0, stamps: 0, worst: 0, since: now });
  }
  let frameQueued = 0;
  let thumbnailAt = 0;
  function redraw() {
    if (frameQueued) { cancelAnimationFrame(frameQueued); frameQueued = 0; }
    if (!context) return;
    layers.composite(context);
    refreshThumbnail(true);
  }
  function scheduleRedraw() {
    if (frameQueued) return;
    frameQueued = requestAnimationFrame(() => {
      frameQueued = 0;
      if (!context) return;
      const start = perfOn ? performance.now() : 0;
      layers.composite(context);
      refreshThumbnail(false);
      if (perfOn) { perf.frames += 1; perf.frameMs += performance.now() - start; notePerf(); }
    });
  }
  /** The navigator's little copy: only while it's showing, and a few times a second at most. */
  function refreshThumbnail(now: boolean) {
    if (!thumbnail || atFit) return;
    const time = performance.now();
    if (!now && time - thumbnailAt < 250) return;
    thumbnailAt = time;
    const small = thumbnail.getContext('2d')!;
    small.clearRect(0, 0, thumbnail.width, thumbnail.height);
    small.drawImage(element, 0, 0, thumbnail.width, thumbnail.height);
  }
  $effect(() => { if (!atFit && ready && thumbnail) untrack(redraw); });

  // ---------- called by the parent ----------

  /** Someone else's stroke, relayed by the party. */
  export function applyRemote(remote: PaintedStroke) {
    if (remote.canvasId !== loadedKey) return; // meant for a canvas we're not showing
    layers.apply(remote);
    log.push(remote);
    scheduleRedraw();
  }

  /** Late joiner: rebuild every turn's layer from the party's history. */
  export async function loadHistory(key: string, width: number, height: number, strokes: PaintedStroke[], complete: boolean, snapshotUrl: string | null, ownBase = false) {
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
      try { await image.decode(); layers.setBase(image, ownBase ? { painter: painterId, round } : null); } catch { /* keep painting on a blank base */ }
    }
    for (const remote of strokes) { layers.apply(remote); log.push(remote); }
    redraw();
  }

  /** The key of the canvas currently drawn (to ignore strokes meant for another). */
  export function currentKey() {
    return loadedKey;
  }

  /** The finished picture on paper, as a PNG data URL (for the round snapshot). */
  export function snapshot(paintOnly = false): string {
    flush(true);
    redraw(); // include marks still waiting for the next frame
    const flat = document.createElement('canvas');
    flat.width = documentWidth;
    flat.height = documentHeight;
    const paper = flat.getContext('2d')!;
    // paintOnly: just the paint, on a see-through background (so it can be laid
    // back onto the textured paper later). Otherwise on the paper's color.
    if (!paintOnly) {
      paper.fillStyle = '#e1dfda'; // the canvas color behind the paint
      paper.fillRect(0, 0, flat.width, flat.height);
    }
    paper.drawImage(element, 0, 0);
    const png = flat.toDataURL('image/png');
    flat.width = flat.height = 0; // free it now: iPad Safari reloads the page if canvas memory piles up
    return png;
  }

  /**
   * Reopen a saved piece from its picture: instant, however much was painted.
   * The picture becomes your own paint (every tool can work it), and the saved
   * strokes are kept as history for the next save, without redrawing them one
   * dab at a time (that took minutes on a tablet).
   */
  export function loadPicture(key: string, width: number, height: number, picture: CanvasImageSource, strokes: PaintedStroke[]) {
    stopStroke();
    loadedKey = key;
    layers.reset(width, height);
    layers.setBase(picture, { painter: painterId, round });
    log = [...strokes];
    fullHistory = true;
    redraw();
  }

  /** End any stroke in progress and send its last stamps (before passing). */
  export function finishStroke() {
    stopStroke();
  }

  /** True while a stroke is under way (so an auto-save can wait for you to lift the pen). */
  export function busy(): boolean { return !!stroke; }

  /** Every stroke drawn on this screen so far, in order (for the time-lapse). */
  export function strokes(): PaintedStroke[] {
    return fullHistory ? log : [];
  }

  /** Painting data only (no audio or video), for the "Export painting data" menu item. */
  export function downloadStrokes() {
    const data = { format: 'ptc-party-strokes', version: 1, width: documentWidth, height: documentHeight, strokes: log };
    void saveFile(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'pass-the-canvas-strokes.json').then((outcome) => {
      announcement = outcome === 'cancelled' ? 'Export cancelled.' : 'Painting data exported. Strokes only; no audio or video.';
    });
  }

  // ---------- your own painting ----------

  /** The viewport's spot on screen, measured once per stroke (measuring on every move forces layout). */
  let box: DOMRect | null = null;
  function point(event: PointerEvent): StrokePoint {
    box ??= viewport.getBoundingClientRect();
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
    scheduleRedraw();
    if (selection.tool === 'airbrush') spray = setInterval(() => { if (stroke) { emit(stroke.last); scheduleRedraw(); } }, 40);
  }
  function lineTo(next: StrokePoint) {
    if (!stroke) return;
    const start = perfOn ? performance.now() : 0;
    const before = stroke.index;
    try { lineToInner(next); } finally {
      if (perfOn && stroke) { const ms = performance.now() - start; perf.moves += 1; perf.moveMs += ms; perf.worst = Math.max(perf.worst, ms); perf.stamps += stroke.index - before; notePerf(); }
    }
  }
  function lineToInner(next: StrokePoint) {
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
    scheduleRedraw();
  }
  /** Finish the stroke and send what's left. */
  function stopStroke() {
    if (spray) clearInterval(spray);
    spray = undefined;
    if (stroke) { holdUntil = 0; flush(true); redraw(); }
    stroke = null;
    box = null;
  }
  const spareCopies: HTMLCanvasElement[] = [];
  function copyOf(surface: HTMLCanvasElement) {
    const copy = spareCopies.pop() ?? document.createElement('canvas');
    if (copy.width !== surface.width || copy.height !== surface.height) { copy.width = surface.width; copy.height = surface.height; }
    const ctx = copy.getContext('2d')!;
    ctx.save(); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(surface, 0, 0); ctx.restore();
    return copy;
  }
  /** A second finger arrived before anything was sent: undo the tentative mark. */
  function cancelTentativeStroke(): boolean {
    if (!stroke || sentAny || !touchBackup.length) return false;
    if (spray) clearInterval(spray);
    spray = undefined;
    for (const backup of touchBackup) {
      const target = backup.surface.getContext('2d')!;
      target.save(); target.globalCompositeOperation = 'copy'; target.drawImage(backup.copy, 0, 0); target.restore();
    }
    stroke = null; outgoing = [];
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    return true;
  }

  function down(event: PointerEvent) {
    if (event.pointerType === 'mouse' && ![0, 2].includes(event.button)) return;
    keyboardPainting = false;
    box = viewport.getBoundingClientRect();
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
    if (event.button === 2 || event.altKey || dragPans) {
      panStart = { x: event.clientX, y: event.clientY, view: { ...view } };
      panning = true;
      return;
    }
    if (!(event.target instanceof HTMLCanvasElement)) return;
    if (event.pointerType === 'touch') {
      // Snapshot your layers so a pinch that starts as one finger leaves no mark.
      layers.prepare(painterId, round);
      // A quick image copy (no pixel readback, which is slow on tablets).
      touchBackup = layers.ownedSurfaces(painterId).map(surface => ({ surface, copy: copyOf(surface) }));
      pendingTouch = true;
    } else begin(point(event));
  }
  function move(event: PointerEvent) {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = (box ??= viewport.getBoundingClientRect());
    if (pinch && touches.size >= 2) {
      const [a, b] = [...touches.values()];
      const middleX = (a.x + b.x) / 2; const middleY = (a.y + b.y) / 2;
      const ratio = Math.hypot(b.x - a.x, b.y - a.y) / pinch.distance;
      const zoomed = zoomView(pinch.view, pinch.view.zoom * ratio, (pinch.midpointX - rect.left) / rect.width, (pinch.midpointY - rect.top) / rect.height);
      view = panView(zoomed, (pinch.midpointX - middleX) / rect.width, (pinch.midpointY - middleY) / rect.height);
      return;
    }
    if (gesture || event.pointerId !== pointerId) return;
    if (panStart) {
      view = panView(panStart.view, (panStart.x - event.clientX) / rect.width, (panStart.y - event.clientY) / rect.height);
      return;
    }
    if (pendingTouch && canPaint(selection) && painting) { pendingTouch = false; begin(point(event), true); }
    if (stroke) lineTo(point(event));
  }
  function up(event: PointerEvent) {
    if (!touches.has(event.pointerId)) return;
    if (event.type !== 'pointercancel' && pendingTouch && !gesture && event.pointerId === pointerId && painting && canPaint(selection)) begin(point(event), true);
    touches.delete(event.pointerId);
    if (event.pointerId === pointerId) { stopStroke(); panStart = null; panning = false; pendingTouch = false; }
    if (touches.size === 0) { gesture = false; pinch = null; spareCopies.push(...touchBackup.map(backup => backup.copy)); touchBackup = []; pointerId = null; }
  }
  function wheel(event: WheelEvent) {
    event.preventDefault();
    const box = viewport.getBoundingClientRect();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1;
    // Pinch on a trackpad arrives as Ctrl+wheel. Cmd/Ctrl+wheel, or the "scroll
    // wheel zooms" setting, zoom too. Otherwise two-finger scrolling pans.
    if (wheelZoom || event.ctrlKey || event.metaKey) {
      view = zoomView(view, view.zoom * Math.exp(-event.deltaY * unit * (event.ctrlKey ? 0.01 : 0.003)), (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
      return;
    }
    const dx = (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit;
    const dy = (event.shiftKey && !event.deltaX ? 0 : event.deltaY) * unit;
    view = { ...view, x: view.x - dx, y: view.y - dy };
  }
  /** Space (held) pans, unless you're typing or pressing a focused control. */
  function typingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
    // A control reached by keyboard keeps Space for pressing it. One you just
    // clicked (a brush, say) doesn't, so Space still pans.
    const control = target.closest('button, summary, a');
    return !!control && control !== clickedControl;
  }
  /** The last control focused by a click or tap (not by Tab). */
  let clickedControl: Element | null = null;
  function notePointer(event: PointerEvent) { clickedControl = event.target instanceof Element ? event.target.closest('button, summary, a') : null; }
  function spaceDown(event: KeyboardEvent) {
    if (event.code !== 'Space' || event.repeat && spaceHeld) { if (event.code === 'Space' && spaceHeld) event.preventDefault(); return; }
    if (typingTarget(event.target)) return;
    event.preventDefault();
    spaceHeld = true;
  }
  function spaceUp(event: KeyboardEvent) { if (event.code === 'Space' && spaceHeld) { event.preventDefault(); spaceHeld = false; } }
  function keyboard(event: KeyboardEvent) {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); view = zoomView(view, view.zoom * 1.25); return; }
    if (event.key === '-') { event.preventDefault(); view = zoomView(view, view.zoom / 1.25); return; }
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction && event.key !== 'Enter') return;
    event.preventDefault();
    keyboardPainting = true;
    if (!painting || event.altKey) {
      if (direction) view = panView(view, direction[0] * 0.1, direction[1] * 0.1);
      return;
    }
    const before = { ...cursor, pressure: 0.5 };
    if (direction) { const step = rotateVector(direction[0] * 20, direction[1] * 20, -rotation); cursor = { x: Math.max(0, Math.min(documentWidth, cursor.x + step.x)), y: Math.max(0, Math.min(documentHeight, cursor.y + step.y)) }; }
    if (canPaint(selection) && ((!direction && event.key === 'Enter') || event.shiftKey)) {
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
  // Short numbers keep network messages small; a tenth of a canvas pixel is invisible.
  function round1(n: number) { return Math.round(n * 10) / 10; }
  function round3(n: number) { return Math.round(n * 1000) / 1000; }
</script>

<svelte:window onkeydown={spaceDown} onkeyup={spaceUp} onpointerdowncapture={notePointer} onblur={() => (spaceHeld = false)} />
<div class="surface" onpointerup={noteViewChange} onwheel={noteViewChange} onkeyup={noteViewChange} onchange={noteViewChange} oninput={noteViewChange} onclick={noteViewChange} role="presentation">
  <div class="viewport" use:holdStill bind:this={viewport} class:pans={dragPans} class:panning role="application" aria-label="Shared canvas and view controls"
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onlostpointercapture={up}
    oncontextmenu={(event) => event.preventDefault()} onwheel={wheel}>
    <div class="paper" style:width={`${documentWidth * frame.scale * view.zoom}px`} style:height={`${documentHeight * frame.scale * view.zoom}px`} style:--edge={`${9 * view.zoom}px`} style:transform={`translate(-50%, -50%) translate(${view.x}px, ${view.y}px) rotate(${rotation * 90}deg)`}><div class="artwork">
      <canvas bind:this={element} width={documentWidth} height={documentHeight} tabindex="0" aria-roledescription="painting surface"
        aria-label={`${label} ${painting ? (selection.tool ? TOOL_NAMES[selection.tool] : 'No tool') + ' in hand.' : mode === 'arrange' ? 'Canvas locked while arranging.' : 'View only.'}`}
        aria-describedby="painting-keyboard-help" class:ready={painting && canPaint(selection) && !spaceHeld}
        onkeydown={keyboard} onfocus={() => { focused = true; keyboardPainting = element.matches(':focus-visible'); }} onblur={() => focused = false}></canvas>
      {#if focused && painting && keyboardPainting}<span class="cursor" aria-hidden="true" style:left={`${cursor.x / documentWidth * 100}%`} style:top={`${cursor.y / documentHeight * 100}%`}></span>{/if}
    </div></div>
  </div>
  <div bind:this={toolbar} class="view-controls" aria-label="Canvas view">
    <div class="view-left">
      <button type="button" class="rotate" aria-label="Rotate canvas clockwise" title="Rotate canvas 90 degrees" onclick={() => { stopStroke(); rotation = (rotation + 1) % 4; }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /></svg><span>Rotate</span></button>
      <aside class="navigator" class:inactive={atFit} aria-hidden={atFit} aria-label="Canvas navigator">
        <button type="button" class="map" disabled={atFit} tabindex={atFit ? -1 : 0} aria-label="Canvas navigator. Click to center there. Arrow keys pan."
          onclick={navigate} onkeydown={(event) => { const directions: Record<string, [number, number]> = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }; const step = directions[event.key]; if (step) { event.preventDefault(); view = panView(view, ...step); } }}>
          <canvas bind:this={thumbnail} width={160} height={Math.round(160 * documentHeight / documentWidth)} aria-hidden="true"></canvas>
          <svg class="map-area" viewBox={`0 0 ${documentWidth} ${documentHeight}`} aria-hidden="true"><polygon points={navigatorPoints} /></svg>
        </button>
      </aside>
    </div>
    <div class="view-right">
      <input class="zoom-range" type="range" aria-label="Canvas zoom" min="10" max="600" step="1" value={Math.round(view.zoom * 100)} oninput={(event) => view = zoomView(view, event.currentTarget.valueAsNumber / 100)} />
      <!-- The number is also the menu: pick a preset or Fit. -->
      <select class="zoom-level" aria-label="Zoom level" value={atFit ? 'fit' : ZOOM_LEVELS.includes(view.zoom) ? String(view.zoom) : 'current'}
        onchange={(event) => { const value = event.currentTarget.value; if (value === 'fit') view = fitView(); else if (value !== 'current') view = zoomView(view, Number(value)); }}>
        {#if !atFit && !ZOOM_LEVELS.includes(view.zoom)}<option value="current">{Math.round(view.zoom * 100)}%</option>{/if}
        <option value="fit">{atFit ? `Fit · ${Math.round(view.zoom * 100)}%` : 'Fit'}</option>
        {#each ZOOM_LEVELS as level}<option value={String(level)}>{level * 100}%</option>{/each}
      </select>
    </div>
  </div>
</div>
{#if perfOn}<p class="perf" aria-hidden="true">{perfText || 'Paint to measure…'}</p>{/if}
<p id="painting-keyboard-help" class="sr-only">On your turn, arrows move the cursor, Enter stamps and Shift+arrows draws. When it isn't your turn, or in Arrange and view, arrows pan. Plus and minus zoom. Alt+arrows pan in either mode. Hold Space and drag to pan, or drag with no tool in hand. Right-drag pans; two fingers pan and pinch to zoom. Tab leaves the canvas. Earlier painters' turns are protected.</p>
<span class="sr-only" role="status">{announcement}</span>

<style lang="scss">
  .surface { position: absolute; inset: 0; }
  .viewport { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; outline: 1px solid #b7a17a; box-shadow: inset 0 0 8px #0007; }
  .paper { position: absolute; left: 50%; top: 50%; background: #e1dfda var(--surface) center / 100% 100%; box-shadow: 10px 16px 14px #0008; }
  .paper::before { content: ''; position: absolute; right: 100%; top: 0; width: var(--edge); height: 100%; background: linear-gradient(90deg, #77766e, #bbb9ae); }
  .paper::after { content: ''; position: absolute; top: 100%; left: calc(-1 * var(--edge)); right: 0; height: calc(var(--edge) * 1.5); background: linear-gradient(#8a887f, #55544e); }
  .artwork { width: 100%; height: 100%; position: relative; }
  /* Its own compositing layer: painting repaints only the canvas, never the paper texture and shadow around it. */
  .artwork > canvas { display: block; width: 100%; height: 100%; transform: translateZ(0); }
  .pans, .pans .artwork > canvas { cursor: grab; }
  .panning, .panning .artwork > canvas { cursor: grabbing; }
  .artwork > canvas.ready { cursor: crosshair; }
  .cursor { position: absolute; width: 18px; height: 18px; border: 2px solid #222; outline: 2px solid white; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; }
  .navigator.inactive { visibility: hidden; pointer-events: none; }
  .view-controls { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; color: #fff5e4; font-size: 12px; }
  .view-left, .view-right { display: flex; align-items: center; gap: 6px; zoom: var(--ui-scale, 1); }
  button, select { min-height: 32px; border: 1px solid #ad9b73; border-radius: 3px; background: #241a11e8; color: #fff5e4; font: inherit; font-size: 12px; padding: 4px 8px; }
  button:disabled { opacity: .45; }
  .rotate { display: inline-flex; align-items: center; gap: 4px; }
  .zoom-range { width: 110px; height: 32px; margin: 0; accent-color: #eee935; }
  .zoom-level { min-width: 72px; }
  :focus-visible { outline: 3px solid #f5ed37; outline-offset: 2px; }
  .navigator { width: 84px; }
  .perf { position: fixed; left: 8px; bottom: 8px; z-index: 300; margin: 0; padding: 4px 8px; font: 12px/1.4 ui-monospace, monospace; color: #fff; background: #000c; border-radius: 4px; pointer-events: none; }
  .map { display: block; position: relative; width: 100%; height: 46px; padding: 0; overflow: hidden; background: #a89b80; }
  .map canvas, .map-area { width: 100%; height: 100%; display: block; object-fit: contain; position: absolute; inset: 0; }
  .map-area polygon { stroke: #f1ec35; stroke-width: 12; fill: #eee83518; }
</style>
