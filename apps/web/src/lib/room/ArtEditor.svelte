<!--
  Wall art editor (?art=<room>): draw boxes over the blank canvases that hang
  in the room, to set up the "hang the party's artwork on the walls" feature.
  Boxes are drawn on the flat equirectangular panorama (the same view you'd
  mask in Photoshop) — and because that photo flattens the room, each box's
  four corners drag on their own so the quad can follow a canvas's skew.
  Selected boxes get corner handles (warp), edge handles (resize) and a body
  drag (move). Saved to art.json next to spots.json as four yaw/pitch points.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ArtRegion } from '@ptc/shared';

  let { room }: { room: string } = $props();

  // svelte-ignore state_referenced_locally — the room is fixed for this page's lifetime
  const PANORAMA = `/studio/${room}/panorama.webp`;
  // svelte-ignore state_referenced_locally
  const ART_URL = `/studio/${room}/art.json`;

  let art = $state<ArtRegion[]>([]);
  let loaded = $state(false);
  let dirty = $state(false);
  let status = $state('');

  /** The selected box gets handles; the form below renames it. */
  let selectedId = $state<string | null>(null);
  let selected = $derived(art.find((a) => a.id === selectedId) ?? null);

  /** Show/hide each group so one can be worked on alone, and what a fresh drag draws. */
  let showWalls = $state(true);
  let showLean = $state(true);
  let drawRole = $state<'wall' | 'lean'>('wall');
  let walls = $derived(art.filter((a) => a.role !== 'lean'));
  let leans = $derived(art.filter((a) => a.role === 'lean'));
  function visible(region: ArtRegion) {
    return region.role === 'lean' ? showLean : showWalls;
  }

  /** Live rectangle while drawing a fresh box. Percent coordinates. */
  let draft = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  let stage: HTMLDivElement | null = null;

  onMount(() => {
    // No art.json yet just means "no boxes drawn" — start empty.
    fetch(ART_URL)
      .then((r) => (r.ok ? r.json() : { room, art: [] }))
      .then((file: { art?: unknown[] }) => {
        // Older saves were rectangles (center + size); turn them into quads.
        art = (file.art ?? []).map(fromLegacy).filter((r): r is ArtRegion => r !== null);
        loaded = true;
      })
      .catch(() => {
        art = [];
        loaded = true;
      });
  });

  /** Accepts the current quad format and the old rectangle format. */
  function fromLegacy(entry: unknown): ArtRegion | null {
    if (!entry || typeof entry !== 'object') return null;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.label !== 'string') return null;
    // Files saved before lean areas existed have no role — they're all walls.
    const role: ArtRegion['role'] = e.role === 'lean' ? 'lean' : 'wall';
    if (Array.isArray(e.corners) && e.corners.length === 4) return { ...(entry as ArtRegion), role };
    const { yaw, pitch, yawSpan, pitchSpan } = e as Record<string, unknown>;
    if (typeof yaw !== 'number' || typeof pitch !== 'number' || typeof yawSpan !== 'number' || typeof pitchSpan !== 'number') return null;
    return {
      id: e.id,
      label: e.label,
      role,
      corners: [
        { yaw: yaw - yawSpan / 2, pitch: pitch + pitchSpan / 2 },
        { yaw: yaw + yawSpan / 2, pitch: pitch + pitchSpan / 2 },
        { yaw: yaw + yawSpan / 2, pitch: pitch - pitchSpan / 2 },
        { yaw: yaw - yawSpan / 2, pitch: pitch - pitchSpan / 2 }
      ] as ArtRegion['corners']
    };
  }

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

  // --- Drawing and box editing ---------------------------------------------
  // Percent ↔ angles: left edge of the image is yaw −180, top is pitch +90.

  /** Pointer position as percents of the image, undoing zoom/pan. */
  function imagePercent(event: { clientX: number; clientY: number }, limitToImage = true) {
    const rect = stage!.getBoundingClientRect();
    const x = ((event.clientX - rect.left - panX) / (rect.width * zoom)) * 100;
    const y = ((event.clientY - rect.top - panY) / (rect.height * zoom)) * 100;
    // Fresh boxes stay inside the photo; corner drags stay free so a corner
    // can be dragged across the back seam (the image's left/right edge)
    // without sticking to it.
    return limitToImage ? { x: clamp(x, 0, 100), y: clamp(y, 0, 100) } : { x, y };
  }

  /**
   * The drag in progress on an existing box: which corners move, and how.
   * `absolute` (corner drags) place corners at the pointer; the others shift
   * corners by the pointer's delta. `wrap` is the corner's percent offset
   * across the back seam (0, or ±100), so a corner dragged off one edge of
   * the photo keeps moving smoothly on the other side.
   */
  let boxDrag = $state<{
    regionId: string;
    corners: number[]; // indexes into the quad
    absolute: boolean;
    wrap: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

  function onPointerDown(event: PointerEvent) {
    if (!stage) return;
    if (spaceHeld || event.button === 1) {
      event.preventDefault(); // middle button would otherwise autoscroll
      panDrag = { x: event.clientX - panX, y: event.clientY - panY };
    } else if (event.button === 0) {
      const target = event.target as HTMLElement;
      const cornerEl = target.closest<HTMLElement>('[data-corner]');
      const edgeEl = target.closest<HTMLElement>('[data-edge]');
      const polyEl = target.closest<HTMLElement>('[data-region]');
      const { x, y } = imagePercent(event, false);
      if (cornerEl) {
        boxDrag = {
          regionId: cornerEl.dataset.regionId!,
          corners: [Number(cornerEl.dataset.corner)],
          absolute: true,
          wrap: Number(cornerEl.dataset.wrap ?? 0),
          startX: x, startY: y, lastX: x, lastY: y, moved: false
        };
      } else if (edgeEl) {
        const i = Number(edgeEl.dataset.edge);
        boxDrag = {
          regionId: edgeEl.dataset.regionId!,
          corners: [i, (i + 1) % 4],
          absolute: false,
          wrap: 0,
          startX: x, startY: y, lastX: x, lastY: y, moved: false
        };
      } else if (polyEl) {
        boxDrag = {
          regionId: polyEl.dataset.region!,
          corners: [0, 1, 2, 3],
          absolute: false,
          wrap: 0,
          startX: x, startY: y, lastX: x, lastY: y, moved: false
        };
      } else {
        beginDraw(event);
      }
    }
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety for drags that wander off; test harnesses with
      // fake pointer ids throw here and everything still works without it.
    }
  }

  function beginDraw(event: PointerEvent) {
    // Pressing a handle or box selects it — don't also start drawing.
    if ((event.target as HTMLElement).closest('.zoombar')) return;
    const { x, y } = imagePercent(event);
    draft = { x1: x, y1: y, x2: x, y2: y };
    selectedId = null;
  }

  function onPointerMove(event: PointerEvent) {
    if (panDrag) {
      if (!stage) return;
      panX = event.clientX - panDrag.x;
      panY = event.clientY - panDrag.y;
      clampPan(stage.getBoundingClientRect());
      return;
    }
    if (boxDrag) {
      // Keep a plain copy: `boxDrag` is reactive and TS can't promise it
      // stays non-null across the statements below.
      const drag = boxDrag;
      const region = art.find((a) => a.id === drag.regionId);
      if (!region) return;
      const { x, y } = imagePercent(event, false);
      // A tiny slip (or a plain click) must select, not nudge the box.
      if (Math.abs(x - boxDrag.startX) > 0.15 || Math.abs(y - boxDrag.startY) > 0.15) boxDrag.moved = true;
      if (boxDrag.moved) {
        if (boxDrag.absolute) {
          // Place the corner at the pointer: bring the pointer into its wrap
          // lane (0–100) first, then add the corner's own seam offset.
          const wrappedX = x - Math.floor(x / 100) * 100;
          setCorner(region, boxDrag.corners[0]!, wrappedX + boxDrag.wrap, y);
        } else {
          const dx = x - boxDrag.lastX;
          const dy = y - boxDrag.lastY;
          for (const i of boxDrag.corners) shiftCorner(region, i, dx, dy);
        }
        boxDrag.lastX = x;
        boxDrag.lastY = y;
        dirty = true;
      }
      return;
    }
    if (!draft) return;
    const { x, y } = imagePercent(event);
    draft = { ...draft, x2: x, y2: y };
  }

  function onPointerUp() {
    panDrag = null;
    if (boxDrag) {
      const drag = boxDrag;
      boxDrag = null;
      const region = art.find((a) => a.id === drag.regionId);
      if (!region) return;
      if (drag.moved) {
        normalizeRegion(region);
        art = art;
      } else {
        // A plain click on a box or handle selects it.
        selectedId = region.id;
      }
      return;
    }
    endDraw();
  }

  function setCorner(region: ArtRegion, index: number, xPercent: number, yPercent: number) {
    region.corners[index] = {
      yaw: xPercent * 3.6 - 180,
      pitch: clamp(90 - yPercent * 1.8, -90, 90)
    };
    art = art;
  }

  function shiftCorner(region: ArtRegion, index: number, dxPercent: number, dyPercent: number) {
    const c = region.corners[index]!;
    region.corners[index] = {
      yaw: c.yaw + dxPercent * 3.6,
      pitch: clamp(c.pitch - dyPercent * 1.8, -90, 90)
    };
    art = art;
  }

  function endDraw() {
    if (!draft) return;
    const box = normalize(draft);
    draft = null;
    const yawSpan = (box.x2 - box.x1) * 3.6;
    const pitchSpan = (box.y2 - box.y1) * 1.8;
    // A slip of the pointer shouldn't create a speck — the sanitizer's own
    // minimum is 2°.
    if (yawSpan < 2 || pitchSpan < 2) return;
    const region: ArtRegion = {
      id: nextId(drawRole === 'lean' ? 'lean_space' : 'canvas'),
      label: `${drawRole === 'lean' ? 'Lean area' : 'Canvas'} ${art.length + 1}`,
      role: drawRole,
      corners: [
        { yaw: box.x1 * 3.6 - 180, pitch: 90 - box.y1 * 1.8 },
        { yaw: box.x2 * 3.6 - 180, pitch: 90 - box.y1 * 1.8 },
        { yaw: box.x2 * 3.6 - 180, pitch: 90 - box.y2 * 1.8 },
        { yaw: box.x1 * 3.6 - 180, pitch: 90 - box.y2 * 1.8 }
      ]
    };
    normalizeRegion(region);
    art = [...art, region];
    dirty = true;
    status = '';
    selectedId = region.id;
  }

  function addBlankBox() {
    // Center the new quad on whatever part of the photo is on screen.
    const cx = stage ? (stage.clientWidth / 2 - panX) / (stage.clientWidth * zoom) * 100 : 50;
    const cy = stage ? (stage.clientHeight / 2 - panY) / (stage.clientHeight * zoom) * 100 : 50;
    const w = 24 / 3.6; // 24° wide, 16° tall — a canvas, not a wall
    const h = 16 / 1.8;
    const region: ArtRegion = {
      id: nextId(drawRole === 'lean' ? 'lean_space' : 'canvas'),
      label: `${drawRole === 'lean' ? 'Lean area' : 'Canvas'} ${art.length + 1}`,
      role: drawRole,
      corners: [
        { yaw: (cx - w / 2) * 3.6 - 180, pitch: 90 - (cy - h / 2) * 1.8 },
        { yaw: (cx + w / 2) * 3.6 - 180, pitch: 90 - (cy - h / 2) * 1.8 },
        { yaw: (cx + w / 2) * 3.6 - 180, pitch: 90 - (cy + h / 2) * 1.8 },
        { yaw: (cx - w / 2) * 3.6 - 180, pitch: 90 - (cy + h / 2) * 1.8 }
      ]
    };
    normalizeRegion(region);
    art = [...art, region];
    dirty = true;
    status = '';
    selectedId = region.id;
  }

  /** Straighten a warped quad back to its upright bounding rectangle. */
  function straighten(region: ArtRegion) {
    const quad = quadOf(region);
    const x1 = Math.min(...quad.map((p) => p.x));
    const x2 = Math.max(...quad.map((p) => p.x));
    const y1 = Math.min(...quad.map((p) => p.y));
    const y2 = Math.max(...quad.map((p) => p.y));
    region.corners = [
      { yaw: x1 * 3.6 - 180, pitch: 90 - y1 * 1.8 },
      { yaw: x2 * 3.6 - 180, pitch: 90 - y1 * 1.8 },
      { yaw: x2 * 3.6 - 180, pitch: 90 - y2 * 1.8 },
      { yaw: x1 * 3.6 - 180, pitch: 90 - y2 * 1.8 }
    ] as ArtRegion['corners'];
    normalizeRegion(region);
    art = art;
    dirty = true;
  }

  function removeRegion(id: string) {
    const region = art.find((a) => a.id === id);
    if (region && confirm(`Remove "${region.label}"?`)) {
      art = art.filter((a) => a.id !== id);
      art = art;
      dirty = true;
      if (selectedId === id) selectedId = null;
    }
  }

  // --- Rendering helpers ----------------------------------------------------

  /**
   * A region's corners as image percents. Yaws are unwrapped relative to the
   * first corner, so a box that crosses the back seam keeps its true shape
   * instead of flipping across the photo; `wrap` records each corner's seam
   * offset (0 or ±100 percent) for handle drags.
   */
  function quadOf(region: ArtRegion) {
    const anchor = region.corners[0].yaw;
    return region.corners.map((c) => {
      const yaw = c.yaw + 360 * Math.round((anchor - c.yaw) / 360);
      return {
        x: ((yaw + 180) / 360) * 100,
        y: ((90 - c.pitch) / 180) * 100,
        wrap: Math.round((yaw - c.yaw) / 360) * 100
      };
    });
  }

  /** Copies of the quad to draw: one, or a second when it crosses the seam. */
  function seamCopies(quad: { x: number; y: number }[]) {
    const xs = quad.map((p) => p.x);
    const copies: { x: number; y: number }[][] = [quad];
    if (Math.max(...xs) > 100) copies.push(quad.map((p) => ({ ...p, x: p.x - 100 })));
    if (Math.min(...xs) < 0) copies.push(quad.map((p) => ({ ...p, x: p.x + 100 })));
    return copies;
  }

  function pointsOf(quad: { x: number; y: number }[]) {
    return quad.map((p) => `${p.x},${p.y}`).join(' ');
  }

  /** Rough size of the quad in degrees, for the list and the form. */
  function sizeText(region: ArtRegion) {
    const quad = quadOf(region);
    const w = (Math.max(...quad.map((p) => p.x)) - Math.min(...quad.map((p) => p.x))) * 3.6;
    const h = (Math.max(...quad.map((p) => p.y)) - Math.min(...quad.map((p) => p.y))) * 1.8;
    return `${round1(w)}° wide × ${round1(h)}° tall`;
  }

  /** The drag rectangle with its corners ordered top-left → bottom-right. */
  let draftBox = $derived(draft ? normalize(draft) : null);

  function normalize(d: { x1: number; y1: number; x2: number; y2: number }) {
    return { x1: Math.min(d.x1, d.x2), y1: Math.min(d.y1, d.y2), x2: Math.max(d.x1, d.x2), y2: Math.max(d.y1, d.y2) };
  }

  /** Wrap every yaw into −180…180 and clamp pitches, ready for saving. */
  function normalizeRegion(region: ArtRegion) {
    region.corners = region.corners.map((c) => ({
      yaw: round1(wrapYaw(c.yaw)),
      pitch: round1(clamp(c.pitch, -90, 90))
    })) as ArtRegion['corners'];
  }

  function nextId(base: string) {
    let id = `art_${slug(base) || 'canvas'}`;
    let n = 2;
    while (art.some((a) => a.id === id)) id = `art_${slug(base) || 'canvas'}_${n++}`;
    return id;
  }

  function slug(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  }

  // --- Keyboard ---------------------------------------------------------------
  // Space pans, +/−/0 zoom, arrows nudge a focused corner handle or the
  // selected box (or pan the image when nothing is selected), Delete removes.

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

    const step = event.shiftKey ? 3 : 0.5;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step]
    };

    // A focused corner handle: the arrows move just that corner.
    const target = event.target as HTMLElement;
    const cornerEl = target.dataset?.corner !== undefined ? target : null;
    if (cornerEl) {
      const region = art.find((a) => a.id === cornerEl.dataset.regionId);
      if (!region) return;
      if (event.key in moves) {
        event.preventDefault();
        const [dy, dp] = moves[event.key]!;
        const index = Number(cornerEl.dataset.corner);
        const c = region.corners[index]!;
        region.corners[index] = { yaw: wrapYaw(c.yaw + dy), pitch: clamp(c.pitch + dp, -90, 90) };
        art = art;
        dirty = true;
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeRegion(region.id);
      }
      return;
    }

    if (selectedId) {
      // The selected box: the arrows move the whole quad.
      const region = art.find((a) => a.id === selectedId);
      if (region && event.key in moves) {
        event.preventDefault();
        const [dy, dp] = moves[event.key]!;
        region.corners = region.corners.map((c) => ({
          yaw: wrapYaw(c.yaw + dy),
          pitch: clamp(c.pitch + dp, -90, 90)
        })) as ArtRegion['corners'];
        art = art;
        dirty = true;
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeRegion(selectedId);
      }
      return;
    }

    // Nothing selected: the arrows pan the image (the keyboard pan path).
    if (event.key in moves && stage) {
      event.preventDefault();
      const pans: Record<string, [number, number]> = {
        ArrowLeft: [80, 0],
        ArrowRight: [-80, 0],
        ArrowUp: [0, 80],
        ArrowDown: [0, -80]
      };
      const [dx, dy] = pans[event.key]!;
      panX += dx;
      panY += dy;
      clampPan(stage.getBoundingClientRect());
    }
  }

  function onKeyup(event: KeyboardEvent) {
    if (event.code === 'Space') spaceHeld = false;
  }

  // --- Saving -----------------------------------------------------------------

  async function save() {
    try {
      // Build plain copies (Svelte's reactive proxies can't be structured-
      // cloned, and we only want to send clean numbers anyway).
      const clean = art.map((region) => {
        const copy: ArtRegion = {
          id: region.id,
          label: region.label,
          role: region.role === 'lean' ? 'lean' : 'wall',
          corners: region.corners.map((c) => ({ yaw: c.yaw, pitch: c.pitch })) as ArtRegion['corners']
        };
        normalizeRegion(copy);
        return copy;
      });
      const response = await fetch(`/api/art/${room}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room, art: clean })
      });
      if (!response.ok) throw new Error(await response.text());
      dirty = false;
      const wallsSaved = clean.filter((r) => r.role !== 'lean').length;
      const leansSaved = clean.length - wallsSaved;
      status = `Saved ${wallsSaved} wall ${wallsSaved === 1 ? 'box' : 'boxes'} and ${leansSaved} lean ${leansSaved === 1 ? 'area' : 'areas'} to studio/${room}/art.json`;
    } catch (error) {
      status = `Save failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify({ room, art }, null, 2));
    status = 'JSON copied to the clipboard';
  }

  function wrapYaw(yaw: number) {
    return round1((((yaw + 180) % 360) + 360) % 360 - 180);
  }
  function clamp(n: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, n));
  }
  function round1(n: number) {
    return Math.round(n * 10) / 10;
  }
  function mod100(n: number) {
    return ((n % 100) + 100) % 100;
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
    <button type="button" onclick={addBlankBox} disabled={!loaded}>Add blank box</button>
    <span class="filters" role="group" aria-label="Show or hide box groups">
      <button
        type="button"
        class="filter"
        class:off={!showWalls}
        aria-pressed={showWalls}
        onclick={() => (showWalls = !showWalls)}
      >
        Wall canvases ({walls.length})
      </button>
      <button
        type="button"
        class="filter lean"
        class:off={!showLean}
        aria-pressed={showLean}
        onclick={() => (showLean = !showLean)}
      >
        Lean spaces ({leans.length})
      </button>
    </span>
    <fieldset class="drawrole">
      <legend class="sr-only">What a new drag creates</legend>
      <label><input type="radio" name="drawrole" bind:group={drawRole} value="wall" /> Draw wall canvas</label>
      <label><input type="radio" name="drawrole" bind:group={drawRole} value="lean" /> Draw lean space</label>
    </fieldset>
    <p class="status" role="status">{status}</p>
  </header>

  <p class="hint">
    Scroll to move around the image, pinch (ctrl-scroll) to zoom — or hold space and drag, like Photoshop. Drag a
    rectangle to add the kind picked above; corners follow the canvas's skew (same warp for lean areas), edges resize,
    the middle moves. Arrows nudge a corner or the whole box, Delete removes.
  </p>

  {#if selected}
    <form class="form" onsubmit={(e) => { e.preventDefault(); selectedId = null; }}>
      <h2>{selected.label}</h2>
      <label>
        <span>Label</span>
        <input bind:value={selected.label} maxlength="60" oninput={() => (dirty = true)} />
      </label>
      <fieldset class="typerole">
        <legend>Type</legend>
        <label><input type="radio" name="typerole" bind:group={selected.role} value="wall" oninput={() => (dirty = true)} /> Wall canvas</label>
        <label><input type="radio" name="typerole" bind:group={selected.role} value="lean" oninput={() => (dirty = true)} /> Lean space</label>
      </fieldset>
      <p class="sizes">{sizeText(selected)}</p>
      <div class="actions">
        <button type="submit" class="primary">Done</button>
        <button type="button" onclick={() => straighten(selected)}>Straighten</button>
        <button type="button" class="danger" onclick={() => removeRegion(selected.id)}>Remove</button>
      </div>
    </form>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions — drawing needs a pointer; the keyboard path is the handle buttons, the list, and the arrow keys -->
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
      boxDrag = null;
      draft = null;
    }}
    onwheel={onWheel}
  >
    <div class="surface" style="transform: translate({panX}px, {panY}px) scale({zoom}); --z: {zoom};">
      <img src={PANORAMA} alt={`Flat view of the ${room} panorama for drawing canvas boxes`} draggable="false" />
      <svg class="boxes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {#each art as region (region.id)}
          {#if visible(region)}
            {@const quad = quadOf(region)}
            {#each seamCopies(quad) as copy, i (i)}
              <polygon
                class="art-poly"
                class:selected={selectedId === region.id}
                class:lean={region.role === 'lean'}
                points={pointsOf(copy)}
                data-region={region.id}
                vector-effect="non-scaling-stroke"
              />
            {/each}
          {/if}
        {/each}
        {#if draftBox}
          <polygon
            class="art-poly draft"
            class:lean={drawRole === 'lean'}
            points="{draftBox.x1},{draftBox.y1} {draftBox.x2},{draftBox.y1} {draftBox.x2},{draftBox.y2} {draftBox.x1},{draftBox.y2}"
            vector-effect="non-scaling-stroke"
          />
        {/if}
      </svg>
      {#if selected}
        {@const quad = quadOf(selected)}
        {#each quad as pt, i}
          {@const next = quad[(i + 1) % 4]!}
          <button
            type="button"
            class="handle corner"
            data-region-id={selected.id}
            data-corner={i}
            data-wrap={pt.wrap}
            style="left:{mod100(pt.x)}%; top:{pt.y}%;"
            aria-label="Corner {i + 1} of {selected.label}. Arrow keys nudge this corner."
          ></button>
          <button
            type="button"
            class="handle edge"
            data-region-id={selected.id}
            data-edge={i}
            style="left:{mod100((pt.x + next.x) / 2)}%; top:{(pt.y + next.y) / 2}%;"
            aria-label="Edge {i + 1} of {selected.label}"
          ></button>
        {/each}
      {/if}
      {#if draftBox}
        <div class="draft-tag" style="left:{draftBox.x1}%; top:{draftBox.y1}%;">
          {round1((draftBox.x2 - draftBox.x1) * 3.6)}° × {round1((draftBox.y2 - draftBox.y1) * 1.8)}°
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

  {#if walls.length > 0}
    <section class="list" class:hidden={!showWalls}>
      <h2>Wall canvases ({walls.length})</h2>
      <ul>
        {#each walls as region (region.id)}
          <li>
            <button type="button" class:selected={selectedId === region.id} onclick={() => (selectedId = region.id)}>
              {region.label}
            </button>
            <span class="meta">{sizeText(region)}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  {#if leans.length > 0}
    <section class="list" class:hidden={!showLean}>
      <h2>Lean spaces ({leans.length})</h2>
      <ul>
        {#each leans as region (region.id)}
          <li>
            <button
              type="button"
              class="lean"
              class:selected={selectedId === region.id}
              onclick={() => (selectedId = region.id)}
            >
              {region.label}
            </button>
            <span class="meta">{sizeText(region)}</span>
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

  // Show/hide one group at a time while working on the other.
  .filters {
    display: inline-flex;
    gap: 0.5rem;
  }
  .filter {
    &.lean {
      color: #6fd6c8;
      border-color: rgb(111 214 200 / 0.45);
    }
    &.off {
      opacity: 0.45;
      border-style: dashed;
    }
    &[aria-pressed='false']::after {
      content: ' — hidden';
      font-size: 0.75rem;
    }
  }

  .drawrole,
  .typerole {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    border: 0;
    margin: 0;
    padding: 0;
    font-size: 0.875rem;

    legend {
      font-weight: 700;
    }
    label {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      min-height: $tap-min;
    }
    input {
      width: 1.15rem;
      height: 1.15rem;
      accent-color: $cadmium-orange;
    }
  }

  .typerole {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.25rem;
    color: $cream-muted;
  }

  // Screen-reader-only text (the draw-role legend is obvious visually).
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
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
    .sizes {
      margin: 0;
      font-size: 0.875rem;
      color: $cream-muted;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
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

  // The moving image. --z (the zoom factor) lets handles and labels below
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

  .boxes {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  :global(.art-poly) {
    fill: rgb(232 116 42 / 0.1);
    stroke: $cadmium-orange;
    stroke-width: 2;
    cursor: move;
  }
  :global(.art-poly.selected) {
    fill: rgb(232 116 42 / 0.2);
    stroke-width: 3;
  }
  :global(.art-poly.draft) {
    fill: rgb(232 116 42 / 0.16);
    stroke-width: 3;
    pointer-events: none;
  }
  // Lean areas are a different animal: dashed teal, lighter fill, so a floor
  // space reads at a glance as "freeform area", not "canvas on the wall".
  :global(.art-poly.lean) {
    fill: rgb(64 169 156 / 0.12);
    stroke: #45b8aa;
    stroke-dasharray: 7 5; // px dashes — the stroke itself is non-scaling
  }
  :global(.art-poly.lean.selected) {
    fill: rgb(64 169 156 / 0.24);
  }
  :global(.art-poly.draft.lean) {
    fill: rgb(64 169 156 / 0.18);
  }

  // Handles sit at percent positions inside the surface, so their pixel
  // sizes divide by the zoom to stay visually constant.
  .handle {
    position: absolute;
    min-height: 0;
    min-width: 0;
    width: calc(28px / var(--z, 1));
    height: calc(28px / var(--z, 1));
    padding: 0;
    transform: translate(-50%, -50%);
    background: transparent;
    border: 0;
    cursor: move;

    &::after {
      content: '';
      position: absolute;
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      width: calc(11px / var(--z, 1));
      height: calc(11px / var(--z, 1));
      border-radius: 50%;
      background: $cream;
      border: calc(2px / var(--z, 1)) solid $cadmium-orange;
      box-sizing: border-box;
    }
    &.edge {
      width: calc(22px / var(--z, 1));
      height: calc(22px / var(--z, 1));
      cursor: pointer;
      &::after {
        border-radius: calc(2px / var(--z, 1));
        width: calc(9px / var(--z, 1));
        height: calc(9px / var(--z, 1));
      }
    }
    &:focus-visible {
      outline: calc(3px / var(--z, 1)) solid $focus;
      outline-offset: calc(1px / var(--z, 1));
    }
  }

  .draft-tag {
    position: absolute;
    transform: translate(0, calc(-100% - 4px / var(--z, 1)));
    padding: 0.15em 0.5em;
    border-radius: $radius-pill;
    background: rgb(24 16 11 / 0.85);
    color: $cream;
    font-size: calc(0.75rem / var(--z, 1));
    white-space: nowrap;
    pointer-events: none;
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
    &.hidden {
      display: none;
    }
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
      &.selected {
        border-color: $cadmium-orange;
        color: $cadmium-orange;
      }
      &.lean {
        border-color: rgb(111 214 200 / 0.45);
        &.selected {
          border-color: #45b8aa;
          color: #6fd6c8;
        }
      }
    }
    .meta {
      font-size: 0.875rem;
      color: $cream-muted;
    }
  }
</style>
