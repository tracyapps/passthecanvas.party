<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
  let dialog: HTMLDialogElement;
  onMount(() => {
    const focus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      focus?.focus();
    };
  });
</script>

<dialog
  bind:this={dialog}
  aria-label="Manage saved views"
  oncancel={(event) => event.preventDefault()}
>
  {@render children()}
</dialog>

<style>
  dialog {
    position: fixed;
    inset: 0 0 0 auto;
    margin: 0;
    padding: 0;
    width: min(1400px, 96vw);
    max-width: 100vw;
    height: 100svh;
    max-height: 100svh;
    border: 1px solid #ae9974;
    background: #221b14;
    color: #fff3de;
    overflow: auto;
  }
  dialog::backdrop {
    background: #100c0877;
  }
  @media (max-width: 650px) {
    dialog {
      width: 100vw;
    }
  }
</style>
