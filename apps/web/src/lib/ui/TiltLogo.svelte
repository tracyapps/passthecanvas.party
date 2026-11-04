<!--
  The Pass the Canvas sign, tilting toward the mouse in 3D: slow, subtle and
  limited, like a sign hanging in a jar of molasses.

  - Small range: at most 12° side to side and 8° up and down.
  - Slow: a two-stage ease (the sign chases a point that chases the mouse),
    so it starts gently, glides, and arrives softly. Nothing snaps on enter
    or leave, and no CSS transition takes over midway.
  - The lift, shadow and sheen swell in and fade out with a "presence" value.
  - The loop stops once the sign has settled, so it costs nothing at rest.

  The sheen replaces the SVG's overlay ellipse: a soft highlight that slides
  across the sign opposite the tilt, like light catching it, masked to the
  sign's own shape. Mouse and pen only (touch just taps through); under
  reduced motion the sign stays still and the sheen sits where it was drawn.
  (The first version followed Tapps's CodePen: 0.208 easing, up to 60°.)
-->
<script lang="ts">
  import { onDestroy } from 'svelte';

  let { href = '/', label = 'Pass the Canvas home' }: { href?: string; label?: string } = $props();

  const TILT_Y = 22; // degrees, side to side, with the mouse at the sign's edge
  const TILT_X = 18; // degrees, up and down
  const EASING = 0.085; // per 60 fps frame, each stage, while following the mouse
  const EASING_HOME = 0.038; // a touch slower when settling back to flat
  const LIFT = 0.00; // scale when fully "present"

  let sign: HTMLSpanElement;
  let pointer = { x: 0, y: 0 }; // offset from the sign's center, -0.5…0.5
  let target = { x: 0, y: 0, p: 0 };
  let middle = { x: 0, y: 0 }; // the point the sign chases (it chases the mouse)
  let current = { x: 0, y: 0, p: 0 };
  let frame = 0;
  let last = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function paint() {
    const { x, y, p } = current;
    // x, y are -1…1, turning the same ways as the CodePen did.
    sign.style.transform = `perspective(900px) rotateX(${(y * TILT_X).toFixed(3)}deg) rotateY(${(x * TILT_Y).toFixed(3)}deg) scale(${(1 + LIFT * p).toFixed(4)})`;
    // The highlight moves against the tilt (a fixed light, a turning sign).
    sign.style.setProperty('--sheen-x', `${(51 - x * 16).toFixed(2)}%`);
    sign.style.setProperty('--sheen-y', `${(49 - y * 14).toFixed(2)}%`);
    sign.style.setProperty('--sheen', (0.45 + 0.3 * p).toFixed(3));
    sign.style.setProperty('--lift', p.toFixed(3));
  }

  function tick(now: number) {
    // Frame-rate independent version of "move 3.5% of the way each frame".
    // A slow frame (a busy tab) counts as two at most, so it can't lurch.
    const dt = last ? Math.min(34, now - last) : 16.67;
    last = now;
    const k = 1 - Math.pow(1 - (target.p ? EASING : EASING_HOME), dt / 16.67);
    // A gentle curve near the middle, so small moves give small tilts.
    const shape = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 1.2);
    target.x = shape(pointer.x * 2) * target.p;
    target.y = shape(pointer.y * 2) * target.p;
    // Two stages: the middle point chases the mouse, the sign chases the middle point.
    middle.x += (target.x - middle.x) * k;
    middle.y += (target.y - middle.y) * k;
    current.x += (middle.x - current.x) * k;
    current.y += (middle.y - current.y) * k;
    current.p += (target.p - current.p) * k * 1.4;
    paint();
    const still = (a: number, b: number) => Math.abs(a - b) < 0.0005;
    const settled = still(target.x, middle.x) && still(target.y, middle.y) && still(middle.x, current.x) && still(middle.y, current.y) && Math.abs(target.p - current.p) < 0.002;
    if (settled && target.p === 0) {
      middle = { x: 0, y: 0 };
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
    // The pointer's offset from the sign's center, held in range so a fast
    // exit can't fling it past the tilt limits.
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
