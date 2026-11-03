<!--
  A cutout avatar, drawn from its (already sanitized) design. The SVG is
  built by @ptc/shared's cutoutSvg from fixed shapes, hex colors and numbers,
  so it is safe to insert as markup.
-->
<script lang="ts" module>
  let next = 0;
</script>

<script lang="ts">
  import { cutoutSvg, type AvatarDesign } from '@ptc/shared';
  let { design, label = '', shadow = true }: { design: AvatarDesign; label?: string; shadow?: boolean } = $props();
  const id = `cp${++next}`;
  // The wrapper carries the name; the SVG inside is presentational.
  let svg = $derived(cutoutSvg(design, { id, shadow }));
</script>

<div class="cutout" role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}>{@html svg}</div>

<style>
  .cutout {
    width: 100%;
    aspect-ratio: 130 / 180;
  }
  .cutout :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
