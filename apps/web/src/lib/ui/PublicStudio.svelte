<script lang="ts">
  import { onMount } from 'svelte';
  import type { Viewer } from '@photo-sphere-viewer/core';
  import '@photo-sphere-viewer/core/index.css';
  let container: HTMLDivElement;
  let viewer: Viewer | null = null;
  let ready = $state(false);
  let error = $state('');
  onMount(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { Viewer, events } = await import('@photo-sphere-viewer/core');
        if (cancelled) return;
        viewer = new Viewer({ container, panorama: '/studio/cream-city/panorama.webp', defaultYaw: '0deg', defaultPitch: '-7deg', defaultZoomLvl: 25, navbar: false, keyboard: 'fullscreen', moveInertia: !matchMedia('(prefers-reduced-motion: reduce)').matches });
        viewer.addEventListener(events.ReadyEvent.type, () => ready = true);
        viewer.addEventListener(events.PanoramaErrorEvent.type, () => { ready = false; error = 'The studio image could not load. You can close this view and keep exploring the paint table.'; });
      } catch { error = 'The room could not open on this device. The paint table still works without it.'; }
    })();
    return () => { cancelled = true; viewer?.destroy(); };
  });
  function look(yaw: string) { viewer?.rotate({ yaw, pitch: '-7deg' }); }
</script>
<div class="studio-look">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- the panorama is keyboard operated while focused -->
  <div bind:this={container} class="panorama" role="region" aria-label="Interactive Cream City studio. Drag to look around or focus here and use arrow keys." tabindex="0" onfocusin={() => viewer?.startKeyboardControl()} onfocusout={() => viewer?.stopKeyboardControl()}></div>
  {#if !ready}<p class="room-status" role="status">{error || 'Turning on the studio lights…'}</p>{/if}
  <div class="look-controls" aria-label="Studio viewpoints"><span>Drag to explore. Or jump to a view:</span><button type="button" disabled={!ready} onclick={() => look('0deg')}>The table</button><button type="button" disabled={!ready} onclick={() => look('90deg')}>The lounge</button><button type="button" disabled={!ready} onclick={() => look('180deg')}>The other side</button><button type="button" disabled={!ready} onclick={() => look('270deg')}>Keep looking</button></div>
</div>
<style>
  .studio-look { position: relative; background: #251d18; }
  .panorama { height: min(65svh, 650px); min-height: 300px; }
  .look-controls { padding: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .look-controls span { font-size: 14px; flex: 1 0 200px; }
  button { min-height: 44px; padding: 8px 12px; background: #f3ead9; color: #2a1d14; border: 1px solid #bba482; }
  .room-status { position: absolute; inset: 20% 20px auto; text-align: center; background: #251d18; padding: 16px; }
</style>
