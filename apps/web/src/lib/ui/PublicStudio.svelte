<script lang="ts">
  import { onMount } from 'svelte';
  import type { Viewer } from '@photo-sphere-viewer/core';
  import '@photo-sphere-viewer/core/index.css';
  let { hero = false }: { hero?: boolean } = $props();
  let container: HTMLDivElement;
  let viewer: Viewer | null = null;
  let ready = $state(false);
  let error = $state('');
  let rotating = $state(false);
  let reducedMotion = $state(false);
  let updateRotation = () => {};
  function pauseRotation() { rotating = false; updateRotation(); }
  function toggleRotation() { rotating = !rotating; updateRotation(); }
  onMount(() => {
    let cancelled = false;
    let frame = 0;
    let lastTime = 0;
    let visible = true;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = motion.matches;
    rotating = hero && !reducedMotion;
    // Rotate only while the hero is visible. Manual interaction takes over immediately.
    function turn(time: number) {
      frame = 0;
      if (viewer && ready && lastTime) {
        const position = viewer.getPosition();
        viewer.rotate({ yaw: position.yaw + Math.min(time - lastTime, 50) * .000035, pitch: position.pitch });
      }
      lastTime = time;
      frame = requestAnimationFrame(turn);
    }
    updateRotation = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (hero && rotating && !reducedMotion && visible && !document.hidden && ready) frame = requestAnimationFrame(turn);
    };
    function motionChanged() {
      reducedMotion = motion.matches;
      if (reducedMotion) rotating = false;
      viewer?.setOption('moveInertia', !reducedMotion);
      updateRotation();
    }
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateRotation(); });
    visibility.observe(container);
    motion.addEventListener('change', motionChanged);
    document.addEventListener('visibilitychange', updateRotation);
    void (async () => {
      try {
        const { Viewer, events } = await import('@photo-sphere-viewer/core');
        if (cancelled) return;
        viewer = new Viewer({ container, panorama: '/studio/cream-city/panorama.webp', defaultYaw: '0deg', defaultPitch: '-7deg', defaultZoomLvl: 25, navbar: false, canvasBackground: '#332519', keyboard: 'fullscreen', mousewheel: !hero, touchmoveTwoFingers: hero, moveInertia: !reducedMotion });
        viewer.addEventListener(events.ReadyEvent.type, () => { ready = true; updateRotation(); });
        viewer.addEventListener(events.PanoramaErrorEvent.type, () => { ready = false; updateRotation(); error = hero ? 'The interactive room could not load. You can still explore the site and try the paints.' : 'The studio image could not load. You can close this view and keep exploring the paint table.'; });
      } catch { error = 'The room could not open on this device. The paint table still works without it.'; }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      visibility.disconnect();
      motion.removeEventListener('change', motionChanged);
      document.removeEventListener('visibilitychange', updateRotation);
      viewer?.destroy();
    };
  });
  function look(yaw: string) { viewer?.rotate({ yaw, pitch: '-7deg' }); }
</script>
<div class="studio-look" class:hero>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -- the panorama is keyboard operated while focused -->
  <div bind:this={container} class="panorama" class:ready role="region" aria-label="Interactive Cream City studio. Drag to look around, use two fingers on touch, or focus here and use arrow keys." tabindex="0" onpointerdown={pauseRotation} onfocusin={() => { pauseRotation(); viewer?.startKeyboardControl(); }} onfocusout={() => viewer?.stopKeyboardControl()}></div>
  {#if !ready}<p class="room-status" role="status">{error || 'Turning on the studio lights…'}</p>{/if}
  {#if hero}
    <div class="hero-controls" aria-label="Look around the studio"><span>Drag to look around<small>Arrow keys · two fingers on touch</small></span><button type="button" disabled={!ready || reducedMotion} onclick={toggleRotation} aria-label={reducedMotion ? 'Room rotation off for reduced motion' : rotating ? 'Pause room rotation' : 'Start room rotation'}>{reducedMotion ? 'Motion off' : rotating ? 'Pause' : 'Rotate'}</button></div>
  {:else}
    <div class="look-controls" aria-label="Studio viewpoints"><span>Drag to explore. Or jump to a view:</span><button type="button" disabled={!ready} onclick={() => look('0deg')}>The table</button><button type="button" disabled={!ready} onclick={() => look('90deg')}>The lounge</button><button type="button" disabled={!ready} onclick={() => look('180deg')}>The other side</button><button type="button" disabled={!ready} onclick={() => look('270deg')}>Keep looking</button></div>
  {/if}
</div>
<style>
  .studio-look { position: relative; background: #251d18; }
  .panorama { height: min(65svh, 650px); min-height: 300px; }
  .hero { height: 100%; background: #332519 url('/studio/cream-city/panorama.webp') center / cover; }
  .hero .panorama { height: 100%; }
  .hero .panorama:not(.ready) { opacity: 0; }
  .hero .room-status { inset: auto 24px 90px auto; max-width: 320px; color: #fff4dc; font-size: 13px; }
  .hero-controls { position: absolute; bottom: 24px; right: 24px; display: flex; align-items: center; gap: 16px; background: #211912ed; color: #fff4dc; padding: 8px 12px; border: 1px solid #d7b87d; font-size: 14px; box-shadow: 3px 6px 14px #0005; }
  .hero-controls small { display: block; font-size: 11px; }
  @media(max-width: 760px) { .hero-controls { bottom: 16px; right: 16px; left: 16px; justify-content: space-between; } }
  .look-controls { padding: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .look-controls span { font-size: 14px; flex: 1 0 200px; }
  button { min-height: 44px; padding: 8px 12px; background: #f3ead9; color: #2a1d14; border: 1px solid #bba482; }
  .room-status { position: absolute; inset: 20% 20px auto; text-align: center; background: #251d18; color: #fff4dc; padding: 16px; }
</style>
