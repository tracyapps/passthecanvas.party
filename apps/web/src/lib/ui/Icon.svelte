<script lang="ts">
  /** Decorative artwork. Its button or adjacent text supplies the accessible name. */
  let { src, pattern = false }: { src: string; pattern?: boolean } = $props();
</script>

<span class="icon" class:pattern style:--icon={`url("${src}")`} aria-hidden="true"></span>

<style>
  .icon {
    display: inline-block;
    flex: none;
    width: 1em;
    height: 1em;
    background: currentColor;
    mask: var(--icon) center / contain no-repeat;
    pointer-events: none;
  }
  .pattern {
    display: block;
    width: 100%;
    height: 8px;
    border-radius: 2px;
    mask-size: 14px 8px;
    mask-repeat: repeat-x;
    opacity: .35;
  }
</style>
