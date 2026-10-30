<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  let { title, label, dock = 'bottom', flow = false, onclose, children }: { title: string; label: string; dock?: 'bottom' | 'palette'; flow?: boolean; onclose: () => void; children: Snippet } = $props();
  let panel: HTMLElement;
  let position = $state<{ x: number; y: number } | null>(null);
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
<section bind:this={panel} class="studio-panel" class:palette={dock === 'palette'} class:flow aria-label={label}
  style={position ? `position:fixed;left:${position.x}px;top:${position.y}px;right:auto;bottom:auto;z-index:30;width:min(400px, calc(100vw - 16px));max-height:calc(100svh - 16px);` : ''}>
  <header>
    <button type="button" class="handle" aria-label={`Move ${label}. Drag or use arrow keys.`}
      onpointerdown={down} onpointermove={move} onpointerup={() => start = null} onpointercancel={() => start = null} onkeydown={keyboard}>{title}</button>
    <details class="position-controls"><summary>Move</summary><div>
      <button type="button" aria-label={`Move ${label} left`} onclick={() => nudge(-32, 0)}>Left</button>
      <button type="button" aria-label={`Move ${label} right`} onclick={() => nudge(32, 0)}>Right</button>
      <button type="button" aria-label={`Move ${label} up`} onclick={() => nudge(0, -32)}>Up</button>
      <button type="button" aria-label={`Move ${label} down`} onclick={() => nudge(0, 32)}>Down</button>
      <button type="button" onclick={() => position = null}>Dock panel</button>
    </div></details>
    <button type="button" class="close" aria-label={`Close ${label}`} onclick={onclose}>Close</button>
  </header>
  <div class="panel-content">{@render children()}</div>
</section>
<style lang="scss">
  .studio-panel { position: fixed; right: 16px; bottom: 32px; width: min(400px, calc(100vw - 24px)); max-width: calc(100vw - 16px); max-height: calc(100svh - 116px); overflow: auto; padding: 8px 12px 12px; background: #17130fef; color: #fff5e6; border: 1px solid #e6df54; border-radius: 8px; box-shadow: 0 8px 25px #0008; z-index: 12; }
  .palette { left: 12px; top: 108px; bottom: auto; right: auto; width: min(420px, calc(100vw - 24px)); }
  header { display: flex; align-items: center; gap: 4px; }
  button, summary { min-height: 44px; border: 0; background: transparent; color: #fff5e6; font: inherit; padding: 8px; }
  .handle { flex: 1; text-align: left; font-weight: 800; font-size: 19px; cursor: grab; touch-action: none; padding-left: 0; }
  .close, summary { font-size: 12px; }
  summary { cursor: pointer; }
  .position-controls { position: relative; }
  .position-controls > div { position: absolute; right: 0; top: 44px; z-index: 2; width: 200px; display: grid; grid-template-columns: 1fr 1fr; padding: 6px; background: #2c2118; border: 1px solid #b8a47b; box-shadow: 0 5px 16px #0009; }
  .position-controls button { border: 1px solid #84714e; margin: 2px; }
  .panel-content { container-type: inline-size; }
  .flow { position: relative; inset: auto; width: 100%; max-width: 100%; max-height: none; margin: 0; z-index: 12; }
</style>
