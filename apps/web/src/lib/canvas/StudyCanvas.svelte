<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from 'svelte';
  import type { StrokePoint } from '@ptc/shared';
  import { canPaint, TOOL_NAMES, type PaintingSelection } from './painting-selection';
  import { drawStudyMark, studySpacing } from './study-brushes';
  import { newRecording, recordStamp } from './study-recording';
  import { editOwnedLayers, type OwnedLayer } from './study-layers';
  import { fitCamera, zoomCamera, screenToCanvas, rotateVector, type CanvasCamera } from './study-camera';

  let { selection, size, intensity = 0.5, resetVersion = 0, mode = 'paint', painterId = '1', wheelZoom = false, documentWidth = 1600, documentHeight = 850, baseWidth = 800, rotation = $bindable(0), onresizewindow, onnewcanvas, onexportready, ontoolbarheight, fitVersion = 0 }:
    { selection: PaintingSelection; size: number; intensity?: number; resetVersion?: number; mode?: 'paint' | 'arrange'; painterId?: string; wheelZoom?: boolean; documentWidth?: number; documentHeight?: number; baseWidth?: number; rotation?: number; onresizewindow?: (width: number, height: number) => void; onnewcanvas?: () => void; onexportready?: (download: () => void) => void; fitVersion?: number; ontoolbarheight?: (height: number) => void } = $props();
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
  function fitView() { return fitCamera(view, frame); }
  function zoomView(camera: CanvasCamera, zoom: number, x = 0.5, y = 0.5) { return zoomCamera(camera, zoom, frame, x * frame.width, y * frame.height); }
  function panView(camera: CanvasCamera, x: number, y: number) { return { ...camera, x: camera.x - x * frame.width, y: camera.y - y * frame.height }; }
  $effect(() => { view.rotation = rotation; });
  $effect(() => { if (ready && frame.width > 0 && !didFit) { didFit = true; view = fitCamera(view, frame); } });
  $effect(() => {
    const version = fitVersion;
    if (!ready) return;
    void tick().then(() => {
      windowSize = { width: viewport.clientWidth, height: viewport.clientHeight };
      view = fitCamera(view, { ...frame, ...windowSize });
    });
  });
  let cursor = $state({ x: 800, y: 425 });
  let focused = $state(false);
  let announcement = $state('');
  let layers: OwnedLayer<HTMLCanvasElement>[] = [];
  let activeLayer: HTMLCanvasElement;
  let owner = '';
  let recording = untrack(() => newRecording(documentWidth, documentHeight));
  let recordingStarted = 0;
  let activeContribution = 0;
  let previousReset = -1;
  let context: CanvasRenderingContext2D;
  let stroke: { selection: PaintingSelection; size: number; intensity: number; last: StrokePoint; carry: number; index: number; angle: number } | null = null;
  let pointerId: number | null = null;
  let touches = new Map<number, { x: number; y: number }>();
  let touchRecordingStart = 0;
  let touchRecordingTruncated = false;
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
    recordingStarted = performance.now();
    onexportready?.(downloadRecording);
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
  $effect(() => {
    const nextOwner = painterId;
    const reset = resetVersion;
    const dimensions = [documentWidth, documentHeight];
    if (!ready) return;
    untrack(() => {
      stopStroke();
      if (reset !== previousReset || element.width !== dimensions[0] || element.height !== dimensions[1]) { layers = []; previousReset = reset; cursor = { x: documentWidth / 2, y: documentHeight / 2 }; didFit = false; recording = newRecording(documentWidth, documentHeight); recordingStarted = performance.now(); }
      if (owner !== nextOwner || layers.length === 0) {
        activeLayer = document.createElement('canvas');
        activeLayer.width = documentWidth; activeLayer.height = documentHeight;
        layers.push({ owner: nextOwner, surface: activeLayer });
        activeContribution = layers.length - 1;
        recording.contributions.push({ id: activeContribution, owner: nextOwner });
      }
      owner = nextOwner;
      redraw();
    });
  });
  $effect(() => {
    if (mode !== 'paint' || selection.tool === null) untrack(stopStroke);
  });

  function downloadRecording() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(recording)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'pass-the-canvas-replay.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announcement = recording.truncated ? 'Replay data exported. The recording limit was reached; this file is incomplete.' : 'Replay data exported. Painting data only; no audio or video.';
  }
  function redraw() {
    if (!context) return;
    context.clearRect(0, 0, documentWidth, documentHeight);
    for (const layer of layers) context.drawImage(layer.surface, 0, 0);
    if (thumbnail) {
      const small = thumbnail.getContext('2d')!;
      small.clearRect(0, 0, thumbnail.width, thumbnail.height);
      small.drawImage(element, 0, 0, thumbnail.width, thumbnail.height);
    }
  }
  $effect(() => { if (!atFit && ready && thumbnail) untrack(redraw); });
  function point(event: PointerEvent): StrokePoint {
    const box = viewport.getBoundingClientRect();
    const local = screenToCanvas(event.clientX - box.left, event.clientY - box.top, view, frame);
    return { ...local, pressure: event.pointerType === 'mouse' || !event.pressure ? 0.5 : event.pressure };
  }
  function emit(at: StrokePoint) {
    if (!stroke) return;
    const frozen = stroke;
    recordStamp(recording, { at: performance.now() - recordingStarted, owner, contribution: activeContribution, selection: frozen.selection, size: frozen.size, intensity: frozen.intensity, point: at, angle: frozen.angle, index: frozen.index });
    const modifies = frozen.selection.wet || frozen.selection.tool === 'sponge' || frozen.selection.tool === 'burnisher' || frozen.selection.tool === 'eraser';
    if (modifies) {
      editOwnedLayers(layers, owner, surface => {
        // Older contributions by this artist may be worked, but only the newest
        // contribution receives new pigment. Other artists are never sampled.
        const state = surface === activeLayer ? frozen.selection : { ...frozen.selection, load: null };
        drawStudyMark(surface.getContext('2d', { willReadFrequently: true })!, state, frozen.size, at, frozen.angle, frozen.index, frozen.intensity);
      });
    } else {
      drawStudyMark(activeLayer.getContext('2d', { willReadFrequently: true })!, frozen.selection, frozen.size, at, frozen.angle, frozen.index, frozen.intensity);
    }
    frozen.index += 1;
  }
  function begin(at: StrokePoint) {
    stroke = { selection: $state.snapshot(selection), size, intensity, last: at, carry: 0, index: 0, angle: 0 };
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
    const spacing = studySpacing(stroke.selection, stroke.size);
    let travel = spacing - stroke.carry;
    for (; travel <= distance; travel += spacing) {
      const fraction = travel / distance;
      emit({ x: previous.x + dx * fraction, y: previous.y + dy * fraction, pressure: previous.pressure + (next.pressure - previous.pressure) * fraction });
    }
    stroke.carry = (stroke.carry + distance) % spacing;
    stroke.last = next;
    redraw();
  }
  function stopStroke() {
    if (spray) clearInterval(spray);
    spray = undefined; stroke = null;
  }
  function down(event: PointerEvent) {
    if (event.pointerType === 'mouse' && ![0, 2].includes(event.button)) return;
    viewport.setPointerCapture(event.pointerId);
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size >= 2) {
      // A second finger converts the interaction into navigation, including
      // restoring any tentative one-finger paint from the start of this gesture.
      if (touchBackup.length) { recording.stamps.length = touchRecordingStart; recording.truncated = touchRecordingTruncated; }
      for (const backup of touchBackup) backup.surface.getContext('2d')!.putImageData(backup.pixels, 0, 0);
      stopStroke(); redraw(); gesture = true; pendingTouch = false;
      const [a, b] = [...touches.values()];
      pinch = { distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), midpointX: (a.x + b.x) / 2, midpointY: (a.y + b.y) / 2, view: { ...view } };
      return;
    }
    pointerId = event.pointerId;
    if (event.button === 2 || mode === 'arrange' || event.altKey) {
      panStart = { x: event.clientX, y: event.clientY, view: { ...view } };
      return;
    }
    if (!canPaint(selection) || !(event.target instanceof HTMLCanvasElement)) return;
    if (event.pointerType === 'touch') {
      touchRecordingStart = recording.stamps.length; touchRecordingTruncated = recording.truncated;
      touchBackup = layers.filter(layer => layer.owner === owner).map(layer => ({ surface: layer.surface, pixels: layer.surface.getContext('2d')!.getImageData(0, 0, documentWidth, documentHeight) }));
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
    if (pendingTouch && canPaint(selection) && mode === 'paint') { pendingTouch = false; begin(point(event)); }
    if (stroke) lineTo(point(event));
  }
  function up(event: PointerEvent) {
    if (!touches.has(event.pointerId)) return;
    if (event.type !== 'pointercancel' && pendingTouch && !gesture && event.pointerId === pointerId && mode === 'paint' && canPaint(selection)) begin(point(event));
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
    if (mode !== 'paint' || event.altKey) {
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
</script>

<div class="surface">
  <div class="viewport" bind:this={viewport} role="application" aria-label="Painting and canvas navigation"
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onlostpointercapture={up}
    oncontextmenu={(event) => event.preventDefault()} onwheel={wheel}>
    <div class="paper" style:width={`${documentWidth * frame.scale * view.zoom}px`} style:height={`${documentHeight * frame.scale * view.zoom}px`} style:--edge={`${9 * view.zoom}px`} style:transform={`translate(-50%, -50%) translate(${view.x}px, ${view.y}px) rotate(${rotation * 90}deg)`}><div class="artwork">
      <canvas bind:this={element} width={documentWidth} height={documentHeight} tabindex="0" aria-roledescription="painting surface"
        aria-label={`${mode === 'paint' ? 'Practice canvas' : 'Locked canvas'}. Painter ${painterId}. ${selection.tool ? TOOL_NAMES[selection.tool] : 'No tool'}.`}
        aria-describedby="painting-keyboard-help" class:ready={mode === 'paint' && canPaint(selection)}
        onkeydown={keyboard} onfocus={() => focused = true} onblur={() => focused = false}></canvas>
      {#if focused && mode === 'paint'}<span class="cursor" aria-hidden="true" style:left={`${cursor.x / documentWidth * 100}%`} style:top={`${cursor.y / documentHeight * 100}%`}></span>{/if}
    </div></div>
  </div>
  <div bind:this={toolbar} class="view-controls" aria-label="Canvas view">
    <label class="zoom-slider">Zoom <input type="range" aria-label="Canvas zoom" min="10" max="600" step="1" value={Math.round(view.zoom * 100)} oninput={(event) => view = zoomView(view, event.currentTarget.valueAsNumber / 100)} /><output>{Math.round(view.zoom * 100)}%</output></label>
    <select aria-label="Quick zoom" value={[0.25, 0.5, 1, 1.5, 2, 3, 4, 6].includes(view.zoom) ? view.zoom : ''} onchange={(event) => { if (event.currentTarget.value) view = zoomView(view, Number(event.currentTarget.value)); }}><option value="" disabled>Zoom to…</option>{#each [0.25, 0.5, 1, 1.5, 2, 3, 4, 6] as level}<option value={level}>{level * 100}%</option>{/each}</select>
    <button type="button" disabled={atFit} onclick={() => view = fitView()}>Fit</button>
    <button type="button" aria-label="Rotate canvas clockwise" title="Rotate canvas 90 degrees" onclick={() => { stopStroke(); rotation = (rotation + 1) % 4; }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /></svg></button>
    <button type="button" onclick={onnewcanvas}>Canvas size</button>
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
<p id="painting-keyboard-help" class="sr-only">In Paint, arrows move the cursor, Space stamps and Shift+arrows draws. In Arrange and view, arrows pan. Plus and minus zoom. Alt+arrows pan in either mode. Right-drag pans; two fingers pan and pinch to zoom. Tab leaves the canvas. Other painters' layers are protected.</p>
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
