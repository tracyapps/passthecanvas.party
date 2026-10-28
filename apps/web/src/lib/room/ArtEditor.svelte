<!--
  Wall art editor (?art=<room>): draw the boundary boxes of the blank canvases
  that hang in the room, to set up the "hang the party's artwork on the walls"
  feature. Works on the flat equirectangular panorama — the same view you'd
  mask in Photoshop — because a straight drag there is the simplest way to say
  "this rectangle on this wall". Saved to art.json next to spots.json.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ArtFile, ArtRegion } from '@ptc/shared';

  let { room }: { room: string } = $props();

  // svelte-ignore state_referenced_locally — the room is fixed for this page's lifetime
  const PANORAMA = `/studio/${room}/panorama.webp`;
  // svelte-ignore state_referenced_locally
  const ART_URL = `/studio/${room}/art.json`;

  let art = $state<ArtRegion[]>([]);
  let loaded = $state(false);
  let dirty = $state(false);
  let status = $state('');

  /** The form opens after a drag (new box) or when editing one from the list. */
  let form = $state<{ editingId: string | null; label: string; yaw: number; pitch: number; yawSpan: number; pitchSpan: number } | null>(null);

  /** Live rectangle while dragging on the panorama. Percent coordinates. */
  let draft = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  let stage: HTMLDivElement | null = null;

  onMount(() => {
    // No art.json yet just means "no boxes drawn" — start empty.
    fetch(ART_URL)
      .then((r) => (r.ok ? r.json() : { room, art: [] }))
      .then((file: ArtFile) => {
        art = file.art ?? [];
        loaded = true;
      })
      .catch(() => {
        art = [];
        loaded = true;
      });
  });

  // --- Zoom and pan ---------------------------------------------------------
  // Photoshop habits: hold space (or use the middle button) to drag the image
  // around, pinch or ctrl-scroll to zoom toward the cursor, plain scroll to
  // move. The image sits on a "surface" div we translate and scale; drawing
  // keeps working at any zoom because pointer positions are converted to
  // image percents through the inverse transform.

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 8;
  let zoom = $state(1);
  let panX = $state(0); // surface offset, in stage pixels
  let panY = $state(0);
  let spaceHeld = $state(false);
  let panDrag = $state<{ x: number; y: number } | null>(null); // client-point anchor

  function zoomBy(factor: number, cx?: number, cy?: number) {
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const next = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);
    if (next === zoom) return;
    // Keep the point under the cursor (or the stage center) fixed in place.
    const px = cx ?? rect.width / 2;
    const py = cy ?? rect.height / 2;
    panX = px - (px - panX) * (next / zoom);
    panY = py - (py - panY) * (next / zoom);
    zoom = next;
    clampPan(rect);
  }

  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  /** The image may move around, but it must always fill the stage. */
  function clampPan(rect: { width: number; height: number }) {
    if (zoom === 1) {
      panX = 0;
      panY = 0;
      return;
    }
    panX = clamp(panX, rect.width * (1 - zoom), 0);
    panY = clamp(panY, rect.height * (1 - zoom), 0);
  }

  function onWheel(event: WheelEvent) {
    // The stage is the whole world here — the page behind it must not scroll.
    event.preventDefault();
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) {
      zoomBy(event.deltaY < 0 ? 1.25 : 1 / 1.25, event.clientX - rect.left, event.clientY - rect.top);
    } else {
      panX -= event.deltaX;
      panY -= event.deltaY;
      clampPan(rect);
    }
  }

  // --- Drawing ------------------------------------------------------------
  // Pointer percent → angles: left edge of the image is yaw −180, top is
  // pitch +90. Drawing is clamped at the image edges, so a box never wraps
  // past the seam at the back of the room.

  /** Pointer position as percents of the image, undoing the zoom/pan. */
  function imagePercent(event: PointerEvent) {
    const rect = stage!.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left - panX) / (rect.width * zoom)) * 100, 0, 100);
    const y = clamp(((event.clientY - rect.top - panY) / (rect.height * zoom)) * 100, 0, 100);
    return { x, y };
  }

  function onPointerDown(event: PointerEvent) {
    if (!stage) return;
    if (spaceHeld || event.button === 1) {
      event.preventDefault(); // middle button would otherwise autoscroll
      panDrag = { x: event.clientX - panX, y: event.clientY - panY };
    } else if (event.button === 0) {
      beginDraw(event);
    }
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety for drags that wander off; test harnesses with
      // fake pointer ids throw here and everything still works without it.
    }
  }

  function beginDraw(event: PointerEvent) {
    // Pressing an existing box selects it (its own click handler) — don't
    // also start drawing underneath it. Same for the zoom control.
    if ((event.target as HTMLElement).closest('.box, .zoombar')) return;
    const { x, y } = imagePercent(event);
    draft = { x1: x, y1: y, x2: x, y2: y };
    form = null;
  }

  function onPointerMove(event: PointerEvent) {
    if (panDrag) {
      if (!stage) return;
      panX = event.clientX - panDrag.x;
      panY = event.clientY - panDrag.y;
      clampPan(stage.getBoundingClientRect());
      return;
    }
    if (!draft) return;
    const { x, y } = imagePercent(event);
    draft = { ...draft, x2: x, y2: y };
  }

  function onPointerUp() {
    panDrag = null;
    endDraw(); // no-op when no box was being drawn
  }

  function endDraw() {
    if (!draft) return;
    const box = normalize(draft);
    draft = null;
    const yawSpan = round1(((box.x2 - box.x1) / 100) * 360);
    const pitchSpan = round1(((box.y2 - box.y1) / 100) * 180);
    // A slip of the pointer shouldn't create a speck — the sanitizer's own
    // minimum is 2°.
    if (yawSpan < 2 || pitchSpan < 2) return;
    const yaw = round1(((box.x1 + box.x2) / 200) * 360 - 180);
    const pitch = round1(90 - ((box.y1 + box.y2) / 200) * 180);
    form = { editingId: null, label: '', yaw, pitch, yawSpan, pitchSpan };
  }

  function normalize(d: { x1: number; y1: number; x2: number; y2: number }) {
    return { x1: Math.min(d.x1, d.x2), y1: Math.min(d.y1, d.y2), x2: Math.max(d.x1, d.x2), y2: Math.max(d.y1, d.y2) };
  }

  // --- Boxes on the image --------------------------------------------------

  /** One region in percent of the image; a box over the back seam becomes two. */
  function regionBoxes(r: ArtRegion): { left: number; top: number; width: number; height: number }[] {
    const width = (r.yawSpan / 360) * 100;
    const left = ((r.yaw + 180) / 360) * 100 - width / 2;
    const top = ((90 - r.pitch) / 180) * 100 - (r.pitchSpan / 180) * 50;
    const height = (r.pitchSpan / 180) * 100;
    const right = left + width;
    if (left >= 0 && right <= 100) return [{ left, top, width, height }];
    // A span can't reach from past one edge to past the other (max 120° of
    // 360°), so exactly one of these slivers applies.
    if (left < 0) return [{ left: 0, top, width: right, height }];
    return [
      { left, top, width: 100 - left, height },
      { left: 0, top, width: right - 100, height }
    ];
  }

  // --- The form --------------------------------------------------------

  function slug(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  }

  function saveForm() {
    if (!form || form.label.trim() === '') return;
    const f = { ...form };
    const label = f.label.trim();
    if (f.editingId) {
      const region = art.find((a) => a.id === f.editingId);
      if (region) Object.assign(region, { label, yaw: f.yaw, pitch: f.pitch, yawSpan: f.yawSpan, pitchSpan: f.pitchSpan });
    } else {
      let id = `art_${slug(label) || 'canvas'}`;
      let n = 2;
      while (art.some((a) => a.id === id)) id = `art_${slug(label) || 'canvas'}_${n++}`;
      art.push({ id, label, yaw: f.yaw, pitch: f.pitch, yawSpan: f.yawSpan, pitchSpan: f.pitchSpan });
    }
    art = art; // reassign so the boxes re-render
    dirty = true;
    status = '';
    form = null;
  }

  function removeRegion(id: string) {
    const region = art.find((a) => a.id === id);
    if (region && confirm(`Remove "${region.label}"?`)) {
      art = art.filter((a) => a.id !== id);
      art = art;
      dirty = true;
      form = null;
    }
  }

  /** Keyboard: space pans, +/−/0 zoom, arrows nudge a selected box or pan the image, Delete removes. */
  function onKeydown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === 'Space') {
      // Holding space pans instead of drawing — but a focused button keeps
      // its normal space behaviour.
      if (!(event.target instanceof HTMLElement && ['BUTTON', 'SELECT'].includes(event.target.tagName))) {
        event.preventDefault();
        spaceHeld = true;
      }
      return;
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1.5);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomBy(1 / 1.5);
      return;
    }
    if (event.key === '0') {
      event.preventDefault();
      resetView();
      return;
    }
    if (!form?.editingId) {
      // Nothing selected: the arrows pan the image (the keyboard pan path).
      const pans: Record<string, [number, number]> = {
        ArrowLeft: [80, 0],
        ArrowRight: [-80, 0],
        ArrowUp: [0, 80],
        ArrowDown: [0, -80]
      };
      if (event.key in pans && stage) {
        event.preventDefault();
        const [dx, dy] = pans[event.key]!;
        panX += dx;
        panY += dy;
        clampPan(stage.getBoundingClientRect());
      }
      return;
    }
    const step = event.shiftKey ? 3 : 0.5;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step]
    };
    if (event.key in moves) {
      event.preventDefault();
      const [dy, dp] = moves[event.key]!;
      form = { ...form, yaw: wrapYaw(form.yaw + dy), pitch: clamp(form.pitch + dp, -90, 90) };
      const region = art.find((a) => a.id === form?.editingId);
      if (region) {
        region.yaw = form.yaw;
        region.pitch = form.pitch;
        art = art;
        dirty = true;
      }
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeRegion(form.editingId);
    }
  }

  function onKeyup(event: KeyboardEvent) {
    if (event.code === 'Space') spaceHeld = false;
  }

  // --- Saving ----------------------------------------------------------

  async function save() {
    try {
      const response = await fetch(`/api/art/${room}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room, art })
      });
      if (!response.ok) throw new Error(await response.text());
      dirty = false;
      status = `Saved ${art.length} canvas ${art.length === 1 ? 'box' : 'boxes'} to studio/${room}/art.json`;
    } catch (error) {
      status = `Save failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify({ room, art }, null, 2));
    status = 'JSON copied to the clipboard';
  }

  /** The drag rectangle with its corners ordered top-left → bottom-right. */
  let draftBox = $derived(draft ? normalize(draft) : null);

  function wrapYaw(yaw: number) {
    return round1((((yaw + 180) % 360) + 360) % 360 - 180);
  }
  function clamp(n: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, n));
  }
  function round1(n: number) {
    return Math.round(n * 10) / 10;
  }
</script>

<svelte:window onkeydown={onKeydown} onkeyup={onKeyup} />

<main class="editor">
  <header class="bar">
    <p class="tape">Wall art editor — {room}</p>
    <button type="button" class="primary" onclick={save} disabled={!dirty || !loaded}>
      {dirty ? 'Save' : 'Saved'}
    </button>
    <button type="button" onclick={copyJson} disabled={!loaded}>Copy JSON</button>
    <button
      type="button"
      onclick={() => (form = { editingId: null, label: '', yaw: 0, pitch: 0, yawSpan: 24, pitchSpan: 16 })}
      disabled={!loaded}
    >
      Add blank box
    </button>
    <p class="status" role="status">{status}</p>
  </header>

  <p class="hint">
    Scroll to move around the image, pinch (or ctrl-scroll) to zoom — or hold space and drag, like Photoshop. Drag a
    rectangle over each blank canvas; the readout while dragging is the box size in degrees. Click a box to fix it up;
    arrows nudge, Delete removes.
  </p>

  {#if form}
    <form class="form" onsubmit={(e) => { e.preventDefault(); saveForm(); }}>
      <h2>{form.editingId ? 'Edit canvas box' : 'New canvas box'}</h2>
      <label>
        <span>Label</span>
        <input bind:value={form.label} placeholder="Brick wall, left" required maxlength="60" />
      </label>
      <div class="numbers">
        <label>
          <span>Yaw °</span>
          <input type="number" min="-180" max="180" step="0.1" bind:value={form.yaw} />
        </label>
        <label>
          <span>Pitch °</span>
          <input type="number" min="-90" max="90" step="0.1" bind:value={form.pitch} />
        </label>
        <label>
          <span>Width °</span>
          <input type="number" min="2" max="120" step="0.1" bind:value={form.yawSpan} />
        </label>
        <label>
          <span>Height °</span>
          <input type="number" min="2" max="120" step="0.1" bind:value={form.pitchSpan} />
        </label>
      </div>
      <div class="actions">
        <button type="submit" class="primary">{form.editingId ? 'Update' : 'Add box'}</button>
        {#if form.editingId}
          <button type="button" class="danger" onclick={() => removeRegion(form!.editingId!)}>Remove</button>
        {/if}
        <button type="button" onclick={() => (form = null)}>Cancel</button>
      </div>
    </form>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions — drawing needs a pointer; the keyboard path is the "Add blank box" button plus the number fields and arrow nudging -->
  <div
    class="stage"
    class:panning={spaceHeld}
    class:grabbing={!!panDrag}
    role="application"
    aria-label="Panorama drawing surface. Drag to draw a canvas box; hold space and drag to pan; plus and minus to zoom."
    bind:this={stage}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={() => {
      panDrag = null;
      draft = null;
    }}
    onwheel={onWheel}
  >
    <div class="surface" style="transform: translate({panX}px, {panY}px) scale({zoom}); --z: {zoom};">
      <img src={PANORAMA} alt={`Flat view of the ${room} panorama for drawing canvas boxes`} draggable="false" />
      {#each art as region (region.id)}
        {@const boxes = regionBoxes(region)}
        {#each boxes as box, i}
          <button
            type="button"
            class="box"
            class:selected={form?.editingId === region.id}
            style="left:{box.left}%; top:{box.top}%; width:{box.width}%; height:{box.height}%;"
            aria-label="Canvas box {region.label}, {region.yawSpan} by {region.pitchSpan} degrees"
            onclick={(e) => {
              e.stopPropagation();
              form = { editingId: region.id, label: region.label, yaw: region.yaw, pitch: region.pitch, yawSpan: region.yawSpan, pitchSpan: region.pitchSpan };
            }}
          >
            {#if i === 0}<span class="tag">{region.label}</span>{/if}
          </button>
        {/each}
      {/each}
      {#if draftBox}
        <div
          class="box draft"
          style="left:{draftBox.x1}%; top:{draftBox.y1}%; width:{draftBox.x2 - draftBox.x1}%; height:{draftBox.y2 - draftBox.y1}%;"
        >
          <span class="tag"
            >{round1(((draftBox.x2 - draftBox.x1) / 100) * 360)}° × {round1(((draftBox.y2 - draftBox.y1) / 100) * 180)}°</span
          >
        </div>
      {/if}
    </div>
    <div class="zoombar">
      <button type="button" onclick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">−</button>
      <span class="zoom-level">{Math.round(zoom * 100)}%</span>
      <button type="button" onclick={() => zoomBy(1.5)} aria-label="Zoom in">+</button>
      <button type="button" onclick={resetView}>Fit</button>
    </div>
  </div>

  {#if art.length > 0}
    <section class="list">
      <h2>Canvas boxes</h2>
      <ul>
        {#each art as region (region.id)}
          <li>
            <button
              type="button"
              onclick={() => (form = { editingId: region.id, label: region.label, yaw: region.yaw, pitch: region.pitch, yawSpan: region.yawSpan, pitchSpan: region.pitchSpan })}
            >
              {region.label}
            </button>
            <span class="meta">{region.yawSpan}° × {region.pitchSpan}° at {region.yaw}° / {region.pitch}°</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .editor {
    @include walnut-table;
    min-height: 100dvh;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    color: $cream;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;

    .primary {
      background: $cadmium-orange;
      color: rgb(24 16 11);
      font-weight: 700;
    }
    .primary:disabled {
      opacity: 0.5;
    }
  }

  .tape {
    @include tape-label;
    margin: 0;
    font-size: 1.25rem;
  }

  button {
    min-height: $tap-min;
    padding: 0 1rem;
    border: 1px solid rgb(255 230 200 / 0.3);
    border-radius: $radius-sm;
    background: rgb(243 234 217 / 0.08);
    color: $cream;
  }

  .danger {
    color: #ff9d7a;
    border-color: rgb(255 157 122 / 0.4);
  }

  .hint,
  .status {
    margin: 0;
    font-size: 0.875rem;
    color: $cream-muted;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: rgb(24 16 11 / 0.85);
    border-radius: $radius-sm;
    max-width: 34rem;

    h2 {
      margin: 0;
      font-size: 1.125rem;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: $cream-muted;
    }
    input {
      min-height: $tap-min;
      padding: 0 0.5rem;
      border-radius: $radius-sm;
      border: 1px solid rgb(255 230 200 / 0.25);
      background: rgb(0 0 0 / 0.3);
      color: $cream;
    }
    .numbers {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
      gap: 0.75rem;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
    }
  }

  // The flat panorama. Wide screens see it whole; narrow screens scroll.
  .stage {
    position: relative;
    align-self: flex-start;
    width: min(100%, 100rem);
    aspect-ratio: 2 / 1;
    border-radius: $radius-sm;
    overflow: hidden;
    cursor: crosshair;
    touch-action: none; // let pointer events draw instead of scroll
    user-select: none;

    &.panning {
      cursor: grab;
    }
    &.grabbing {
      cursor: grabbing;
    }
  }

  // The moving image. --z (the zoom factor) lets borders and labels below
  // divide by it, so they stay the same visual size at every zoom.
  .surface {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;

    img {
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  }

  .box {
    position: absolute;
    border: calc(3px / var(--z, 1)) dashed $cadmium-orange;
    background: rgb(232 116 42 / 0.12);
    padding: 0;
    min-width: 0;
    min-height: 0;
    font: inherit;
    color: $cream;

    &:focus-visible {
      outline: 3px solid $focus;
      outline-offset: 1px;
    }
    &.selected {
      border-style: solid;
      background: rgb(232 116 42 / 0.22);
    }
    &.draft {
      border-style: dashed;
      pointer-events: none;
    }

    .tag {
      position: absolute;
      left: calc(0.25rem / var(--z, 1));
      top: calc(0.25rem / var(--z, 1));
      padding: 0.15em 0.5em;
      border-radius: $radius-pill;
      background: rgb(24 16 11 / 0.85);
      color: $cream;
      font-size: calc(0.75rem / var(--z, 1));
      white-space: nowrap;
    }
  }

  .zoombar {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem;
    border-radius: $radius-pill;
    background: rgb(24 16 11 / 0.85);

    button {
      min-height: $tap-min;
      min-width: 2.75rem;
      padding: 0 0.75rem;
    }
    .zoom-level {
      min-width: 3.5rem;
      text-align: center;
      font-size: 0.875rem;
      color: $cream-muted;
    }
  }

  .list {
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    button {
      text-align: left;
    }
    .meta {
      font-size: 0.875rem;
      color: $cream-muted;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .box {
      transition: background-color 0.15s ease;
    }
  }
</style>
