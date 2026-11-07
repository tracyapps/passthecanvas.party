<script lang="ts">
  import type { PaletteSwatch } from '@ptc/shared';
  let { colors }: { colors: PaletteSwatch[] } = $props();
  let split = $derived(colors.length > 12 ? Math.ceil(colors.length / 2) : colors.length);
  function wedges(swatches: PaletteSwatch[]) {
    return `conic-gradient(${swatches.map((color, index) => `${color.hex} ${index / swatches.length * 100}% ${(index + 1) / swatches.length * 100}%`).join(',')})`;
  }
</script>

<span class="disc" aria-hidden="true" style:background={wedges(colors.slice(0, split))}>
  {#if split < colors.length}<span class="inner" style:background={wedges(colors.slice(split))}></span>{/if}
  <span class="pin"></span>
</span>

<style>
  .disc { display: block; position: relative; width: 100%; aspect-ratio: 1; border: 3px solid #d2b98e; border-radius: 50%; box-shadow: inset 0 0 0 1px #33291c88, 1px 4px 5px #0008; }
  .inner { position: absolute; inset: 25%; border: 2px solid #e4d5b9; border-radius: 50%; }
  .pin { position: absolute; inset: 46%; background: #cab18b; border: 1px solid #513d27; border-radius: 50%; }
</style>
