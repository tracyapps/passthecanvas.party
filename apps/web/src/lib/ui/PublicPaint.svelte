<script lang="ts">
  import { onMount } from 'svelte';
  import { drawStudyMark, studySpacing } from '../canvas/study-brushes';
  import type { PaintingSelection, PaintingTool } from '../canvas/painting-selection';
  import type { StrokePoint } from '@ptc/shared';

  let { compact = false }: { compact?: boolean } = $props();
  const helpId = $props.id();
  const colors = [
    { name: 'Turquoise', hex: '#147d83' }, { name: 'Ultramarine', hex: '#343b98' },
    { name: 'Magenta', hex: '#c53178' }, { name: 'Poppy', hex: '#e85432' },
    { name: 'Sunflower', hex: '#edb927' }, { name: 'Leaf', hex: '#558348' },
    { name: 'Plum', hex: '#633766' }, { name: 'Ink', hex: '#272a31' },
  ];
  let canvas: HTMLCanvasElement;
  let tool = $state<PaintingTool>('round');
  let color = $state(colors[0]);
  let size = $state(26);
  let cursor = $state({ x: 500, y: 325 });
  let keyboardMarking = $state(false);
  let status = $state('A little space to try things. Nothing is uploaded or saved.');
  let previous: StrokePoint | null = null;
  let activePointer: number | null = null;
  let stamp = 0;
  let strokeSelection: PaintingSelection | null = null;
  let strokeSize = 26;
  let beforeClear = $state<ImageData | null>(null);

  function selection(): PaintingSelection {
    const load = { medium: tool === 'pencil' ? 'pencil' as const : 'acrylic' as const, name: color.name, colors: [color.hex] };
    return { tool, load: tool === 'eraser' ? null : load, remembered: load, wet: false };
  }
  function point(event: PointerEvent): StrokePoint {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width * canvas.width,
      y: (event.clientY - bounds.top) / bounds.height * canvas.height,
      pressure: event.pointerType === 'pen' ? event.pressure || 0.5 : 0.5 };
  }
  function mark(next: StrokePoint) {
    const context = canvas.getContext('2d');
    if (!context || !strokeSelection) return;
    const start = previous ?? next;
    const distance = Math.hypot(next.x - start.x, next.y - start.y);
    const steps = Math.max(1, Math.ceil(distance / studySpacing(strokeSelection, strokeSize)));
    const angle = Math.atan2(next.y - start.y, next.x - start.x);
    for (let step = 1; step <= steps; step++) {
      drawStudyMark(context, strokeSelection, strokeSize, {
        x: start.x + (next.x - start.x) * step / steps,
        y: start.y + (next.y - start.y) * step / steps,
        pressure: next.pressure,
      }, angle, stamp++);
    }
    previous = next;
    cursor = { x: next.x, y: next.y };
  }
  function start(event: PointerEvent) {
    if (event.button !== 0 || activePointer !== null) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
    keyboardMarking = false;
    strokeSelection = selection();
    strokeSize = size;
    previous = null;
    mark(point(event));
  }
  function move(event: PointerEvent) {
    if (activePointer !== event.pointerId) return;
    mark(point(event));
  }
  function stop(event: PointerEvent) {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    previous = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  function key(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      keyboardMarking = false;
      previous = null;
      status = 'Brush lifted.';
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      keyboardMarking = !keyboardMarking;
      previous = null;
      strokeSelection = selection();
      strokeSize = size;
      if (keyboardMarking) mark({ ...cursor, pressure: 0.5 });
      status = keyboardMarking ? 'Brush down. Arrow keys make marks. Space lifts the brush.' : 'Brush lifted. Arrow keys move without painting.';
      return;
    }
    const direction: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = direction[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 25 : 8;
    cursor = { x: Math.max(0, Math.min(1000, cursor.x + delta[0] * step)), y: Math.max(0, Math.min(650, cursor.y + delta[1] * step)) };
    if (keyboardMarking) mark({ ...cursor, pressure: 0.5 });
  }
  function changeTool(next: PaintingTool) {
    tool = next;
    keyboardMarking = false;
    previous = null;
    status = `${next === 'round' ? 'Round brush' : next === 'pencil' ? 'Colored pencil' : 'Eraser'} selected.`;
  }
  function clear() {
    const context = canvas.getContext('2d');
    if (!context) return;
    beforeClear = context.getImageData(0, 0, canvas.width, canvas.height);
    context.clearRect(0, 0, canvas.width, canvas.height);
    keyboardMarking = false;
    status = 'Fresh paper. Undo clear can bring your marks back.';
  }
  onMount(() => { status = 'Ready to make something. Your marks stay in this browser tab.'; });
</script>

<section class:compact class="paint-table" aria-label="Try the art supplies">
  <div class="table-note"><span>THE MESS IS THE POINT.</span><p>Pick something up. See what happens.</p></div>
  <img class="paint-tin" src="/site/watercolor-photo.webp" alt="" aria-hidden="true" width="200" height="100" />
  <div class="supplies" aria-label="Choose a tool">
    <button class:chosen={tool === 'round'} aria-pressed={tool === 'round'} onclick={() => changeTool('round')}><img src="/site/round-photo.webp" alt="" /><span>Brush</span></button>
    <button class:chosen={tool === 'pencil'} aria-pressed={tool === 'pencil'} onclick={() => changeTool('pencil')}><img src="/site/pencils-photo.webp" alt="" /><span>Pencil</span></button>
    <button class:chosen={tool === 'eraser'} aria-pressed={tool === 'eraser'} onclick={() => changeTool('eraser')}><img src="/site/eraser-photo.webp" alt="" /><span>Eraser</span></button>
  </div>
  <div class="paper-wrap">
    <div class="paper" role="application" aria-label="Painting practice">
      <canvas bind:this={canvas} width="1000" height="650" tabindex="0" aria-roledescription="painting surface" aria-label="Practice canvas" aria-describedby={helpId} onpointerdown={start} onpointermove={move} onpointerup={stop} onpointercancel={stop} onkeydown={key} onblur={() => { keyboardMarking = false; previous = null; }}></canvas>
      <span class="keyboard-cursor" class:down={keyboardMarking} style:left={`${cursor.x / 10}%`} style:top={`${cursor.y / 6.5}%`} aria-hidden="true"></span>
    </div>
    <span class="paper-caption">your very own happy accident</span>
  </div>
  <div class="paint-controls">
    <fieldset class="palette"><legend>Choose a color</legend>{#each colors as swatch}<button class:chosen={color.hex === swatch.hex} style:--paint={swatch.hex} aria-label={swatch.name} aria-pressed={color.hex === swatch.hex} onclick={() => { color = swatch; keyboardMarking = false; }}><span></span></button>{/each}</fieldset>
    <label class="size">Size <input aria-label="Brush size" type="range" min="4" max="80" bind:value={size} oninput={() => { keyboardMarking = false; }} /><output>{size}</output></label>
    <button class="paper-button" onclick={clear}>Fresh paper</button>
    {#if beforeClear}<button class="paper-button" onclick={() => { if (beforeClear) canvas.getContext('2d')?.putImageData(beforeClear, 0, 0); beforeClear = null; status = 'Marks restored.'; }}>Undo clear</button>{/if}
  </div>
  <p id={helpId} class="help">Mouse, pen or touch: draw on the paper. Keyboard: focus the paper, use arrows to move, Space to put your tool down or lift it. Shift + arrows moves farther. Escape lifts your tool.</p>
  <p class="privacy" aria-live="polite">{status}</p>
</section>

<style lang="scss">
  .paint-table { position: relative; isolation: isolate; color: #fff4df; padding: clamp(20px, 4vw, 60px); background: #49301e url('/site/walnut.webp') center / 900px; box-shadow: inset 0 5px 18px #0007, 0 16px 35px #23180e40; min-height: 600px; border-radius: 4px; }
  .table-note { display: inline-block; margin: 0 0 20px 2%; padding: 12px 22px; background: #f5e6bb; color: #372719; box-shadow: 2px 5px 10px #0005; transform: rotate(-3deg); font: 700 1.1rem var(--font-hand, 'Caveat', cursive); }
  .table-note span { letter-spacing: .08em; } .table-note p { margin: 2px 0; font: 400 1rem system-ui; }
  .paint-tin { position: absolute; width: 185px; height: auto; top: 45px; left: 43%; transform: rotate(5deg); filter: drop-shadow(3px 7px 3px #0007); pointer-events: none; }
  @media(max-width: 1100px) { .paint-tin { display: none; } }
  .supplies { position: absolute; top: 35px; right: 5%; display: flex; gap: 8px; }
  button { cursor: pointer; min-width: 44px; min-height: 44px; font: inherit; }
  .supplies button { display: flex; flex-direction: column; justify-content: end; align-items: center; width: 86px; height: 120px; padding: 3px; border: 1px solid transparent; background: transparent; color: #fff4df; border-radius: 5px; }
  .supplies button.chosen { background: #1d120bbd; border-color: #f6d182; }
  .supplies img { width: 76px; height: 78px; object-fit: contain; filter: drop-shadow(3px 5px 2px #0008); transform: rotate(-18deg); }
  .paper-wrap { position: relative; margin: 65px auto 32px; width: min(100%, 900px); }
  .paper { position: relative; background: #fbf7ee; box-shadow: -6px 4px 0 #cbc3b2, -9px 8px 0 #999181, -12px 18px 20px #0008; }
  .paper::after { content: ''; position: absolute; pointer-events: none; inset: 0; opacity: .12; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%236e624c' filter='url(%23n)' d='M0 0h180v180H0z'/%3E%3C/svg%3E"); }
  canvas { display: block; width: 100%; height: auto; touch-action: none; cursor: crosshair; }
  .keyboard-cursor { display: none; position: absolute; width: 18px; height: 18px; border: 2px solid #111; outline: 2px solid white; border-radius: 50%; transform: translate(-50%,-50%); pointer-events: none; }
  .paper:focus-within .keyboard-cursor { display: block; } .keyboard-cursor.down { background: #1117; }
  .paper-caption { display: block; margin: 20px 0 0; text-align: center; font: 1.4rem 'Caveat', cursive; color: #fff4df; }
  .paint-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
  .palette { display: flex; flex-wrap: wrap; border: none; gap: 2px; padding: 5px 12px; margin: 0; border-radius: 40px 28px 35px 20px; background: #e2d4b9; box-shadow: 3px 5px 3px #0006; }
  .palette legend { position: absolute; width: 1px; height: 1px; clip-path: inset(50%); overflow: hidden; }
  .palette button { background: none; border: 2px solid transparent; padding: 6px; border-radius: 50%; } .palette button.chosen { border-color: #3c271b; }
  .palette button span { display: block; width: 27px; height: 27px; background: var(--paint); border-radius: 43% 55% 48% 40%; box-shadow: inset 1px 2px 2px #fff5, 1px 2px 2px #0008; }
  .size { display: flex; align-items: center; gap: 7px; padding: 4px 12px; background: #20150ecf; border-radius: 4px; } .size input { width: 100px; min-height: 44px; accent-color: #f4ce7c; } output { min-width: 25px; }
  .paper-button { border: 1px solid #d9c69c; border-radius: 3px; background: #f5e8cc; color: #332315; padding: 8px 15px; box-shadow: 2px 4px 3px #0005; }
  .help, .privacy { max-width: 850px; margin: 20px auto 0; text-align: center; font-size: .9rem; line-height: 1.6; color: #fff4df; } .privacy { margin-top: 8px; }
  :is(button,input,canvas):focus-visible { outline: 3px solid #ffd38a; outline-offset: 4px; }
  .compact { min-height: 0; }
  @media(max-width: 640px) { .paint-table { padding: 20px 15px; } .table-note { margin-left: 0; max-width: 85%; } .supplies { position: relative; inset: auto; justify-content: center; margin: 0 0 20px; } .supplies button { height: 100px; } .supplies img { height: 65px; } .paper-wrap { margin-top: 12px; } .palette { max-width: 100%; justify-content: center; } .help { text-align: left; } }
</style>
