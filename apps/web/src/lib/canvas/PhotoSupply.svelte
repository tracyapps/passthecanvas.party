<script lang="ts">
  let { image, label, moveLabel, selected = false, muted = false, compact = false, tile = false, moving = false, masked = false, hovered = false, unavailableReason = '', hit = [0, 0, 100, 100], onclick, onpointerdown, onpointermove, onpointerup, onkeydown }: {
    image: string; label: string; moveLabel?: string; selected?: boolean; muted?: boolean; unavailableReason?: string;
    compact?: boolean; tile?: boolean; moving?: boolean; hit?: number[]; onclick: () => void;
    /** Mouse and touch pick this supply by its shape (the table hit-tests the photo's outline); the button stays for keyboard and screen readers. */
    masked?: boolean;
    /** The pointer is over this supply's shape: show its name. */
    hovered?: boolean;
    onpointerdown?: (event: PointerEvent) => void; onpointermove?: (event: PointerEvent) => void;
    onpointerup?: (event: PointerEvent) => void; onkeydown?: (event: KeyboardEvent) => void;
  } = $props();
  const descriptionId = $props.id();
</script>
<!-- The photo may overhang its target; transparent image boxes must never steal a neighbor's clicks. -->
<div class="photo" class:selected class:muted class:compact class:tile class:moving class:masked class:hovered>
  {#if !compact}<img src={image} alt="" draggable="false" />{/if}
  <button type="button" aria-label={moveLabel ?? label} aria-describedby={unavailableReason ? descriptionId : undefined}
    aria-disabled={!!unavailableReason} aria-pressed={selected} {onclick} {onpointerdown} {onpointermove} {onpointerup} {onkeydown} onpointercancel={onpointerup}
    style:left={`${hit[0]}%`} style:top={`${hit[1]}%`} style:width={`${hit[2]}%`} style:height={`${hit[3]}%`}>
    {#if compact}<img src={image} alt="" draggable="false" />{/if}
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
  button:hover .name, button:focus-visible .name, .hovered .name { opacity: 1; }
  .masked button { pointer-events: none; }
  button:focus-visible { outline: 3px solid #fff; outline-offset: 4px; border-radius: 4px; z-index: 5; }
  .moving button { touch-action: none; cursor: grab; }
  .compact button { inset: 0 !important; width: 100% !important; height: 100% !important; display: flex; flex-direction: column; overflow: hidden; border-radius: 4px; }
  .compact .name { position: static; transform: none; opacity: 1; width: 100%; max-width: 100%; padding: 4px 3px; font-size: 12px; line-height: 1.25; overflow-wrap: anywhere; flex: none; border: 0; background: #1d150ef2; border-radius: 0; }
  .compact img { position: static; width: 100%; height: 0; min-height: 0; flex: 1 1 0; object-fit: contain; filter: none; padding: 3px; }
  .compact.muted img { filter: saturate(0.35) brightness(0.75); }
  .compact.selected button { box-shadow: inset 0 0 0 2px #f5f325; border-radius: 4px; }
  .tile { background: #38291d; border: 1px solid #897451; border-radius: 4px; }
  @media (prefers-reduced-motion: reduce) { img { transition: none; } }
</style>
