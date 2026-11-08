<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, children, onreturn }: { title: string; children: Snippet; onreturn: () => void } = $props();
</script>

<main class="toolbox-window">
  <header><h1>{title}</h1><button type="button" onclick={onreturn}>Return to party</button></header>
  {@render children()}
</main>

<style>
  .toolbox-window { min-height: 100svh; padding: 10px; background: #211c15; color: #fff5e6; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
  h1 { margin: 0; font-size: 20px; }
  button { min-height: 44px; color: inherit; background: #38392e; border: 1px solid #a49b7f; border-radius: 4px; padding: 6px 10px; font-size: 12px; }
</style>
