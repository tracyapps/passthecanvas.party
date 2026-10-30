<script lang="ts">
  let { image, label, selected = false, muted = false, compact = false, moving = false, unavailableReason = '', hit = [0, 0, 100, 100], onclick, onpointerdown, onpointermove, onpointerup, onkeydown }: {
    image: string; label: string; selected?: boolean; muted?: boolean; unavailableReason?: string;
    compact?: boolean; moving?: boolean; hit?: number[]; onclick: () => void;
    onpointerdown?: (event: PointerEvent) => void; onpointermove?: (event: PointerEvent) => void;
    onpointerup?: (event: PointerEvent) => void; onkeydown?: (event: KeyboardEvent) => void;
  } = $props();
  const descriptionId = $props.id();
</script>
<!-- The photo may overhang its target; transparent image boxes must never steal a neighbor's clicks. -->
<div class="photo" class:selected class:muted class:compact class:moving>
  <img src={image} alt="" draggable="false" />
  <button type="button" aria-label={label} aria-describedby={unavailableReason ? descriptionId : undefined}
    aria-disabled={!!unavailableReason} aria-pressed={selected} {onclick} {onpointerdown} {onpointermove} {onpointerup} {onkeydown} onpointercancel={onpointerup}
    style:left={`${hit[0]}%`} style:top={`${hit[1]}%`} style:width={`${hit[2]}%`} style:height={`${hit[3]}%`}>
    <span class="name">{label}</span>
  </button>
  {#if unavailableReason}<span id={descriptionId} class="sr-only">{unavailableReason}</span>{/if}
</div>
<style lang="scss">
  .photo { position: relative; width: 100%; height: 100%; pointer-events: none; }
  button { position: absolute; display: block; min-width: 44px; min-height: 44px; padding: 0; border: 0; color: #fff9eb; background: transparent; pointer-events: auto; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; filter: drop-shadow(3px 7px 4px #000b); transition: filter 160ms ease; }
  .muted img { filter: saturate(0.3) brightness(0.62) drop-shadow(3px 7px 4px #000b); }
  .selected img { filter: url('#supply-selection') drop-shadow(3px 7px 4px #000b); }
  .name { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: max-content; max-width: 160%; padding: 6px 10px; font-size: 13px; font-weight: 700; background: #1d150ef2; border: 1px solid #b5a47b; border-radius: 3px; opacity: 0; pointer-events: none; }
  button:hover .name, button:focus-visible .name { opacity: 1; }
  button:focus-visible { outline: 3px solid #fff; outline-offset: 4px; border-radius: 4px; z-index: 5; }
  .moving button { touch-action: none; cursor: grab; }
  .compact button { inset: 0 !important; width: 100% !important; height: 100% !important; }
  .compact .name { bottom: 0; left: 0; right: 0; transform: none; opacity: 1; margin: auto; width: auto; max-width: 100%; padding: 4px; font-size: 12px; }
  .compact img { height: calc(100% - 36px); object-fit: contain; }
</style>
