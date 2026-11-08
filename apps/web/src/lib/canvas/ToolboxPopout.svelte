<script lang="ts">
  import { mount, onMount, unmount, type Snippet } from 'svelte';
  import ToolboxWindowContent from './ToolboxWindowContent.svelte';
  import { prefs } from '../prefs.svelte';
  let { popup, title, children, onclose }: { popup: Window; title: string; children: Snippet; onclose: () => void } = $props();

  $effect(() => { if (!popup.closed) popup.document.title = `${title} — Pass the Canvas`; });
  $effect(() => { if (!popup.closed) popup.document.documentElement.style.setProperty('--ui-scale', String(prefs.interfaceScale)); });

  onMount(() => {
    const doc = popup.document;
    doc.documentElement.lang = document.documentElement.lang || 'en';
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.append(base);
    // The popup uses the same compiled UI and styles, with the party still owning state.
    for (const style of document.head.querySelectorAll('style, link[rel="stylesheet"], link[rel="icon"]')) {
      const copy = style.cloneNode(true) as HTMLElement;
      if (copy instanceof HTMLLinkElement) copy.href = (style as HTMLLinkElement).href;
      doc.head.append(copy);
    }
    const target = doc.createElement('div');
    doc.body.replaceChildren(target);
    const component = mount(ToolboxWindowContent, {
      target,
      props: {
        get title() { return title; },
        get children() { return children; },
        onreturn() { window.focus(); }
      }
    });
    const check = window.setInterval(() => { if (popup.closed) onclose(); }, 400);
    const close = () => popup.close();
    window.addEventListener('pagehide', close);
    popup.addEventListener('pagehide', onclose);
    return () => {
      clearInterval(check);
      window.removeEventListener('pagehide', close);
      popup.removeEventListener('pagehide', onclose);
      void unmount(component);
      popup.close();
    };
  });
</script>
