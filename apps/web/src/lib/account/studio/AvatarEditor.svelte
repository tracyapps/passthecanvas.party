<!--
  The cutout avatar maker (from papr.world): pick a paper shape and a sheet
  of construction paper, then draw on it with pencil, soft pastel or crayon.
  Marks are clipped to the cutout, like coloring inside the lines of a
  shape you cut out. Drawing needs a mouse, pen or finger; everything else
  (shape, paper, color, undo, saving) works from the keyboard.
-->
<script lang="ts">
  import { blankDesign, CUTOUT_CATEGORIES, CUTOUT_INKS, CUTOUT_MEDIA, CUTOUT_SHAPES, PAPER_COLORS, PAPER_PATTERNS, SHEET, strokePath, type AvatarDesign, type CutoutCategory, type CutoutMedium, type CutoutStroke, type PaperColor, type PaperPattern, type SavedAvatar } from '@ptc/shared';
  import CutoutPreview from './CutoutPreview.svelte';

  interface Props {
    avatar: SavedAvatar | null;
    canSave: boolean;
    onsave: (name: string, design: AvatarDesign) => Promise<void>;
    oncancel: () => void;
  }
  let { avatar, canSave, onsave, oncancel }: Props = $props();

  // svelte-ignore state_referenced_locally — the editor re-mounts per avatar
  let design = $state<AvatarDesign>(structuredClone($state.snapshot(avatar?.design) ?? blankDesign()));
  // svelte-ignore state_referenced_locally
  let name = $state(avatar?.name ?? 'My avatar');
  let medium = $state<CutoutMedium>('pastel');
  let width = $state<number>(CUTOUT_MEDIA.pastel.widths[1]);
  let color = $state<string>(CUTOUT_INKS[4].color);
  let category = $state<CutoutCategory>(CUTOUT_SHAPES.find((s) => s.key === design.shape)?.category ?? 'folks');
  let redo = $state<CutoutStroke[]>([]);
  let current = $state<number[] | null>(null);
  let saving = $state(false);
  let confirmClear = $state(false);
  let surface: SVGSVGElement;
  let spoken = $state('');

  const MAX_POINTS = 1200;
  let shape = $derived(CUTOUT_SHAPES.find((s) => s.key === design.shape) ?? CUTOUT_SHAPES[0]!);
  let shown = $derived(CUTOUT_SHAPES.filter((s) => s.category === category));

  function pickMedium(next: CutoutMedium) {
    medium = next;
    width = CUTOUT_MEDIA[next].widths[1];
  }

  function point(event: PointerEvent): [number, number] {
    const box = surface.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * SHEET.width;
    const y = ((event.clientY - box.top) / box.height) * SHEET.height;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }
  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    surface.setPointerCapture(event.pointerId);
    current = point(event);
  }
  function move(event: PointerEvent) {
    if (!current) return;
    const [x, y] = point(event);
    const lx = current[current.length - 2]!, ly = current[current.length - 1]!;
    if (Math.hypot(x - lx, y - ly) < 0.7) return;
    current = [...current, x, y];
    // Long scribbles are saved in pieces, so no single stroke gets too big.
    if (current.length >= MAX_POINTS) {
      commit();
      current = [x, y];
    }
  }
  function commit() {
    if (!current) return;
    design.strokes = [...design.strokes, { medium, color, width, points: current }];
    redo = [];
    current = null;
  }
  function undo() {
    const last = design.strokes.at(-1);
    if (!last) return;
    design.strokes = design.strokes.slice(0, -1);
    redo = [...redo, last];
    spoken = 'Undid the last mark.';
  }
  function redoStroke() {
    const next = redo.at(-1);
    if (!next) return;
    redo = redo.slice(0, -1);
    design.strokes = [...design.strokes, next];
    spoken = 'Put the mark back.';
  }
  function keys(event: KeyboardEvent) {
    if ((event.target as HTMLElement).closest('input, textarea, select')) return; // typing undo stays the field's own
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redoStroke();
      else undo();
    }
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    saving = true;
    try {
      await onsave(name.trim() || 'My avatar', $state.snapshot(design));
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window onkeydown={keys} />

<form class="editor" onsubmit={save}>
  <section class="card canvas-card" aria-labelledby="draw-title">
    <h2 id="draw-title" class="sr">Draw on your cutout</h2>
    <div class="sheet">
      <CutoutPreview {design} label={`Your ${shape.label} avatar, ${design.strokes.length} marks`} />
      <!-- The drawing layer: a transparent sheet on top, plus the mark being drawn. -->
      <svg bind:this={surface} class="draw" viewBox={`0 0 ${SHEET.width} ${SHEET.height}`} aria-hidden="true"
        onpointerdown={down} onpointermove={move} onpointerup={commit} onpointercancel={commit}>
        <defs><clipPath id="live-clip"><path d={shape.path} /></clipPath></defs>
        {#if current}
          <g clip-path="url(#live-clip)"><path d={strokePath(current)} fill="none" stroke={color} stroke-width={width} stroke-linecap="round" stroke-linejoin="round" opacity={medium === 'pastel' ? 0.62 : medium === 'pencil' ? 0.88 : 1} /></g>
        {/if}
      </svg>
    </div>
    <div class="row tools-row">
      <button type="button" class="btn small quiet" onclick={undo} disabled={!design.strokes.length}>Undo</button>
      <button type="button" class="btn small quiet" onclick={redoStroke} disabled={!redo.length}>Redo</button>
      {#if confirmClear}
        <button type="button" class="btn small danger" onclick={() => { redo = [...design.strokes].reverse(); design.strokes = []; confirmClear = false; spoken = 'Cleared. Redo brings the marks back.'; }}>Yes, clear it</button>
        <button type="button" class="btn small quiet" onclick={() => (confirmClear = false)}>Keep</button>
      {:else}
        <button type="button" class="btn small quiet" onclick={() => (confirmClear = true)} disabled={!design.strokes.length}>Clear marks</button>
      {/if}
    </div>
    <p class="sr" role="status">{spoken}</p>
    <p class="hint">Draw with a mouse, pen or finger. Marks stay inside the cutout. Undo: Ctrl/⌘ + Z.</p>
  </section>

  <div class="panels">
    <section class="card stack" aria-labelledby="tools-title">
      <h2 id="tools-title">Draw with</h2>
      <div class="choices">
        {#each Object.entries(CUTOUT_MEDIA) as [key, m] (key)}
          <label><input type="radio" name="medium" checked={medium === key} onchange={() => pickMedium(key as CutoutMedium)} />{m.label}</label>
        {/each}
      </div>
      <p class="hint">{CUTOUT_MEDIA[medium].hint}</p>
      <fieldset>
        <legend>Size</legend>
        <div class="choices">
          {#each CUTOUT_MEDIA[medium].widths as w, i (w)}
            <label><input type="radio" name="width" value={w} bind:group={width} /><span class="dot" style:width={`${6 + i * 6}px`} style:height={`${6 + i * 6}px`}></span>{['Fine', 'Medium', 'Bold'][i]}</label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Color</legend>
        <div class="swatches">
          {#each CUTOUT_INKS as ink (ink.color)}
            <label class="swatch" title={ink.label}><input type="radio" name="ink" value={ink.color} bind:group={color} aria-label={ink.label} /><span style:background={ink.color}></span></label>
          {/each}
          <label class="swatch custom" title="Any color"><input type="color" bind:value={color} aria-label="Any color" /></label>
        </div>
      </fieldset>
    </section>

    <section class="card stack" aria-labelledby="shape-title">
      <h2 id="shape-title">Cutout shape</h2>
      <div class="choices" role="radiogroup" aria-label="Shape groups">
        {#each CUTOUT_CATEGORIES as c (c.key)}<label><input type="radio" name="category" value={c.key} bind:group={category} />{c.label}</label>{/each}
      </div>
      <div class="shapes">
        {#each shown as s (s.key)}
          <label class="shape" title={s.label}>
            <input type="radio" name="shape" value={s.key} bind:group={design.shape} aria-label={s.spoken} />
            <svg viewBox="0 0 130 180" aria-hidden="true"><path d={s.path} /></svg>
          </label>
        {/each}
      </div>
    </section>

    <section class="card stack" aria-labelledby="paper-title">
      <h2 id="paper-title">Paper</h2>
      <div class="swatches">
        {#each Object.entries(PAPER_COLORS) as [key, p] (key)}
          <label class="swatch" title={p.label}><input type="radio" name="paper" value={key} bind:group={design.paper.color} aria-label={`${p.label} paper`} /><span style:background={p.fill}></span></label>
        {/each}
      </div>
      <div class="choices">
        {#each Object.entries(PAPER_PATTERNS) as [key, label] (key)}
          <label><input type="radio" name="pattern" value={key} bind:group={design.paper.pattern} />{label}</label>
        {/each}
      </div>
    </section>

    <section class="card stack" aria-labelledby="name-title">
      <h2 id="name-title">Name it</h2>
      <label class="field">Avatar name<input maxlength="40" required bind:value={name} /></label>
      <div class="row">
        <button type="submit" class="btn" disabled={!canSave || saving}>{saving ? 'Saving…' : avatar ? 'Save changes' : 'Save avatar'}</button>
        <button type="button" class="btn quiet" onclick={oncancel}>{avatar ? 'Back to avatars' : 'Cancel'}</button>
      </div>
      {#if !canSave}<p class="hint">This is a preview. Sign in (and set up your profile) to save avatars.</p>{/if}
    </section>
  </div>
</form>

<style>
  .editor { display: grid; grid-template-columns: minmax(16rem, 26rem) minmax(0, 1fr); gap: 24px; align-items: start; }
  @media (max-width: 900px) { .editor { grid-template-columns: minmax(0, 1fr); } }
  .canvas-card { position: sticky; top: 16px; }
  @media (max-width: 900px) { .canvas-card { position: static; } }
  .sheet { position: relative; width: min(100%, 22rem); margin: 0 auto; background: #ece3cf; background-image: radial-gradient(#d6c9ad 1px, transparent 1px); background-size: 12px 12px; padding: 8px; }
  .draw { position: absolute; inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); touch-action: none; cursor: crosshair; }
  .tools-row { justify-content: center; margin-top: 12px; }
  .panels { display: grid; gap: 24px; min-width: 0; }
  .dot { display: inline-block; border-radius: 50%; background: currentColor; }
  .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch { position: relative; width: 44px; height: 44px; cursor: pointer; }
  .swatch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .swatch span { display: block; width: 100%; height: 100%; border-radius: 50%; border: 2px solid #8d7858; }
  .swatch:has(input:checked) span { box-shadow: 0 0 0 3px #fffaf0, 0 0 0 6px #2a261e; }
  .swatch:has(input:focus-visible) { outline: 3px solid #276777; outline-offset: 6px; border-radius: 50%; }
  .swatch.custom input { opacity: 1; width: 44px; height: 44px; padding: 0; border: 2px solid #8d7858; border-radius: 50%; background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red); }
  .shapes { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 8px; }
  .shape { position: relative; display: block; padding: 4px; border: 1px solid #c8b695; background: #fffaf0; cursor: pointer; }
  .shape input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .shape svg { display: block; width: 100%; height: auto; fill: #8d7858; }
  .shape:has(input:checked) { border: 3px solid #2a261e; background: #fff4cf; }
  .shape:has(input:checked) svg { fill: #2a261e; }
  .shape:has(input:focus-visible) { outline: 3px solid #276777; outline-offset: 2px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
