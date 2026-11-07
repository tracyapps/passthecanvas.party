<script lang="ts" module>
  /** Where you last moved each panel (this visit), so it reopens in the same spot. */
  const placed = new Map<string, { x: number; y: number }>();
</script>
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  let { title, label, dock = 'bottom', flow = false, onclose, children }: { title: string; label: string; dock?: 'bottom' | 'palette' | 'toolbox' | 'guests' | 'notes' | 'radio' | 'arrange'; flow?: boolean; onclose: () => void; children: Snippet } = $props();
  let panel: HTMLElement;
  // svelte-ignore state_referenced_locally — a panel keeps its label for life
  let position = $state<{ x: number; y: number } | null>(placed.get(label) ?? null);
  $effect(() => { if (position) placed.set(label, position); else placed.delete(label); });
  let start: { x: number; y: number; left: number; top: number; pointer: number } | null = null;
  function bounded(x: number, y: number) {
    const box = panel.getBoundingClientRect();
    position = { x: Math.max(8, Math.min(innerWidth - box.width - 8, x)), y: Math.max(8, Math.min(innerHeight - Math.min(box.height, innerHeight - 16) - 8, y)) };
  }
  onMount(() => {
    const resize = () => { if (position) bounded(position.x, position.y); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  });
  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    const box = panel.getBoundingClientRect();
    start = { x: event.clientX, y: event.clientY, left: box.left, top: box.top, pointer: event.pointerId };
    event.currentTarget instanceof HTMLElement && event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function move(event: PointerEvent) {
    if (!start || start.pointer !== event.pointerId) return;
    bounded(start.left + event.clientX - start.x, start.top + event.clientY - start.y);
  }
  function nudge(dx: number, dy: number) {
    const box = panel.getBoundingClientRect();
    bounded(box.left + dx, box.top + dy);
  }
  function keyboard(event: KeyboardEvent) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
    const step = steps[event.key];
    if (step) { event.preventDefault(); nudge(...step); }
  }
</script>
<section bind:this={panel} class="studio-panel" class:palette={dock === 'palette'} class:toolbox={dock === 'toolbox'} class:guests={dock === 'guests'} class:notes={dock === 'notes' || dock === 'radio'} class:radio={dock === 'radio'} class:arrange={dock === 'arrange'} class:flow aria-label={label}
  style={position ? `position:fixed;left:${position.x}px;top:${position.y}px;right:auto;bottom:auto;z-index:30;width:min(calc(400px * var(--ui-scale, 1)), calc(100vw - 16px));max-height:calc(100svh - 16px);` : ''}>
  <header>
    <button type="button" class="handle" aria-label={`Move ${label}. Drag or use arrow keys.`}
      onpointerdown={down} onpointermove={move} onpointerup={() => start = null} onpointercancel={() => start = null} onkeydown={keyboard}>{title}</button>
    <button type="button" class="close" aria-label={`Close ${label}`} onclick={onclose}>Close</button>
  </header>
  <div class="panel-content">{@render children()}</div>
</section>
<style lang="scss">
  .studio-panel { position: fixed; right: 16px; bottom: 32px; width: min(calc(400px * var(--ui-scale, 1)), calc(100vw - 24px)); max-width: calc(100vw - 16px); max-height: calc(100svh - 116px); overflow: auto; padding: 8px 12px 12px; background: #17130fef; color: #fff5e6; border: 1px solid #e6df54; border-radius: 8px; box-shadow: 0 8px 25px #0008; z-index: 12; }
  .palette { left: 12px; top: calc(var(--header-height, 88px) + 16px); bottom: auto; right: auto; width: min(calc(420px * var(--ui-scale, 1)), calc(100vw - 24px)); }
  .toolbox { max-height: calc(100svh - var(--header-height, 88px) - 36px); left: 12px; top: calc(var(--header-height, 88px) + 12px); bottom: auto; right: auto; width: min(380px, calc(100vw - 24px)); }
  .guests { right: 12px; top: 96px; bottom: auto; width: auto; max-width: min(560px, calc(100vw - 24px)); max-height: calc(100svh - 220px); padding: 2px 10px 8px; }
  .guests .handle { font-size: 15px; }
  .notes { left: 12px; right: auto; bottom: 96px; width: min(340px, calc(100vw - 24px)); background: #f3ead9f5; color: #2b1d12; border-color: #b9a483; }
  .notes button { color: #2b1d12; }
  .arrange { top: calc(var(--header-height, 88px) + 12px); bottom: auto; right: auto; left: calc(50% - 170px); width: min(340px, calc(100vw - 24px)); z-index: 35; }
  .radio { left: min(364px, calc(100vw - 352px)); }
  header { display: flex; align-items: center; gap: 4px; }
  button { min-height: 44px; border: 0; background: transparent; color: #fff5e6; font: inherit; padding: 8px; }
  .handle { flex: 1; text-align: left; font-weight: 800; font-size: 19px; cursor: grab; touch-action: none; padding-left: 0; display: flex; flex-direction: column; align-items: stretch; gap: 7px; }
  .handle::before { content: ''; height: 6px; border-radius: 2px; background: repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 4px); opacity: .45; }
  .handle:active { cursor: grabbing; }
  .handle:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .close { font-size: 12px; }
  .panel-content { container-type: inline-size; }
  /* Interface size (Settings): the panel's insides scale; its spot on screen doesn't. */
  .studio-panel > * { zoom: var(--ui-scale, 1); }
  .flow { position: relative; inset: auto; width: 100%; max-width: 100%; max-height: none; margin: 0; z-index: 12; }
</style>
