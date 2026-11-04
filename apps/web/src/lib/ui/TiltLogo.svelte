<!--
  The Pass the Canvas sign, tilting toward the mouse in 3D.

  The feel comes from Tapps's earlier CodePen: the same smooth catch-up
  (0.208 per frame), the same reach (up to about 60° at the edges) and the
  same 800px perspective. What changed is how it starts and stops:
  one animation loop eases in on enter, follows (0.208), and glides back to
  flat on leave (a softer 0.11). Nothing snaps: the lift (scale) and the sheen fade with a
  "presence" value instead of jumping, and no CSS transition takes over
  midway. The loop stops once the sign has settled, so it costs nothing at rest.

  The sheen replaces the SVG's overlay ellipse: a soft highlight that slides
  across the sign opposite the tilt, like light catching it, masked to the
  sign's own shape. Mouse and pen only (touch just taps through); under
  reduced motion the sign stays still and the sheen sits where it was drawn.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';

  let { href = '/', label = 'Pass the Canvas home' }: { href?: string; label?: string } = $props();

  const MAX_TILT = 80; // degrees per unit of pointer offset (pointer offset reaches ±0.75)
  const REACH = 1.5; // pointer offset multiplier from the CodePen
  const EASING = 0.208; // per 60 fps frame, while following the mouse (the CodePen's value)
  const EASING_HOME = 0.11; // softer when settling back to flat, so the return glides
  const LIFT = 0.02; // scale when fully "present"

  let sign: HTMLSpanElement;
  let pointer = { x: 0, y: 0 }; // offset from the sign's center, -0.5…0.5
  let target = { x: 0, y: 0, p: 0 };
  let current = { x: 0, y: 0, p: 0 };
  let frame = 0;
  let last = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function paint() {
    const { x, y, p } = current;
    sign.style.transform = `perspective(800px) rotateX(${(y * MAX_TILT).toFixed(2)}deg) rotateY(${(x * MAX_TILT).toFixed(2)}deg) scale(${(1 + LIFT * p).toFixed(4)})`;
    // The highlight moves against the tilt (a fixed light, a turning sign).
    sign.style.setProperty('--sheen-x', `${(51 - x * 38).toFixed(1)}%`);
    sign.style.setProperty('--sheen-y', `${(49 - y * 38).toFixed(1)}%`);
    sign.style.setProperty('--sheen', (0.45 + 0.3 * p).toFixed(3));
    sign.style.setProperty('--lift', p.toFixed(3));
  }

  function tick(now: number) {
    // Frame-rate independent version of "move 20.8% of the way each frame".
    // A slow frame (a busy tab) counts as two at most, so it can't lurch.
    const dt = last ? Math.min(34, now - last) : 16.67;
    last = now;
    const k = 1 - Math.pow(1 - (target.p ? EASING : EASING_HOME), dt / 16.67);
    // The reach grows with presence, so the first movement is never a jump.
    const reach = REACH * Math.min(1, current.p * 1.4 + 0.25) * target.p;
    target.x = pointer.x * reach;
    target.y = pointer.y * reach;
    current.x += (target.x - current.x) * k;
    current.y += (target.y - current.y) * k;
    // Presence ramps a little slower, so the lift and sheen swell in rather than pop.
    current.p += (target.p - current.p) * k * 0.6;
    paint();
    const settled = Math.abs(target.x - current.x) < 0.0004 && Math.abs(target.y - current.y) < 0.0004 && Math.abs(target.p - current.p) < 0.002;
    if (settled && target.p === 0) {
      current = { x: 0, y: 0, p: 0 };
      paint();
      frame = 0;
      last = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function run() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function move(event: PointerEvent) {
    if (reduced || event.pointerType === 'touch') return;
    const rect = sign.getBoundingClientRect();
    // The pointer's offset from the sign's center, as in the CodePen; held in range
    // so a fast exit can't fling it past the tilt limits.
    const x = Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5));
    const y = Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5));
    pointer = { x, y };
    target.p = 1;
    run();
  }

  function leave() {
    pointer = { x: 0, y: 0 };
    target.p = 0;
    run();
  }

  onDestroy(() => cancelAnimationFrame(frame));
</script>

<a class="tilt-logo" {href} aria-label={label} onpointermove={move} onpointerleave={leave}>
  <span class="sign" bind:this={sign}>
    <img src="/site/ptc-logo.svg" alt="" width="787" height="663" decoding="async" />
    <span class="sheen" aria-hidden="true"></span>
  </span>
</a>

<style>
  .tilt-logo {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    /* A little room around the sign so the tilt starts before the edge. */
    padding: 6px;
    margin: -6px;
    border-radius: 8px;
  }
  .sign {
    position: relative;
    display: block;
    height: var(--logo-height, 78px);
    aspect-ratio: 787 / 663;
    transform-style: preserve-3d;
    will-change: transform;
    isolation: isolate;
    /* A soft shadow that deepens a touch as the sign lifts. */
    filter: drop-shadow(0 calc(2px + 4px * var(--lift, 0)) calc(3px + 6px * var(--lift, 0)) rgb(39 24 14 / calc(0.18 + 0.14 * var(--lift, 0))));
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse 26% 11% at var(--sheen-x, 51%) var(--sheen-y, 49%), #fff 0%, rgb(255 255 255 / 0.6) 45%, transparent 100%);
    mix-blend-mode: overlay;
    opacity: var(--sheen, 0.45);
    -webkit-mask: url('/site/ptc-logo-sign.svg') center / 100% 100% no-repeat;
    mask: url('/site/ptc-logo-sign.svg') center / 100% 100% no-repeat;
  }
  .tilt-logo:focus-visible {
    outline: 3px solid #276777;
    outline-offset: 2px;
  }
</style>
