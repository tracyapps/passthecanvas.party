<script lang="ts">
  import { onMount } from 'svelte';
  import type { PartyConnection } from './connection.svelte';
  import DevicesPanel from './DevicesPanel.svelte';

  let { party, partyId, onclose }: { party: PartyConnection; partyId: string; onclose: () => void } = $props();
  let dialog: HTMLDialogElement;
  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  });
</script>

<dialog bind:this={dialog} aria-labelledby="devices-title" oncancel={(event) => { event.preventDefault(); onclose(); }}>
  <header><h2 id="devices-title">Your devices</h2><button type="button" onclick={onclose}>Close devices</button></header>
  <DevicesPanel {party} {partyId} />
</dialog>

<style lang="scss">
  @use '../../styles/tokens' as *;
  dialog {
    width: min(680px, calc(100vw - 24px));
    max-width: calc(100vw - 24px);
    max-height: calc(100svh - 24px);
    padding: 20px;
    border: 1px solid #ae9974;
    border-radius: 8px;
    background: #221b14;
    color: $cream;
    overflow: auto;
  }
  dialog::backdrop { background: #100c0899; }
  header { position: sticky; top: -20px; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; padding-block: 8px; background: #221b14; }
  h2 { margin: 0; font-size: 1.25rem; }
  button { min-height: 44px; padding: 8px 12px; border: 1px solid #9d8c67; border-radius: 4px; background: transparent; color: $cream; font: inherit; }
  button:focus-visible { outline: 3px solid $focus; outline-offset: 2px; }
  @media (max-width: 480px) { dialog { padding: 12px; } header { top: -12px; } }
</style>
