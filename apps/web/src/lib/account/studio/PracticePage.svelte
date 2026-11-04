<!--
  Practice pieces: everything you painted alone at the practice table.
  Private to you. Keep painting any piece, download it full size, or delete it.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { CANVAS_SHAPES, type CanvasShape, type PracticePiece } from '@ptc/shared';
  import { accountRequest, accountToken } from '../account.svelte';
  import { go, studio, when } from './studio.svelte';
  import { fileSlug, saveFile } from '../../download';

  let pieces = $state<PracticePiece[] | null>(null);
  let thumbs = $state<Record<string, string>>({});
  let deleting = $state<string | null>(null);
  const base = (import.meta.env.VITE_ACCOUNT_API_URL ?? '').replace(/\/$/, '');

  async function file(id: string, kind: 'thumb' | 'image'): Promise<Blob> {
    const response = await fetch(`${base}/api/account/community/practice/file?id=${encodeURIComponent(id)}&kind=${kind}`, { headers: { Authorization: `Bearer ${await accountToken()}` } });
    if (!response.ok) throw new Error('That piece could not be loaded.');
    return response.blob();
  }

  async function load() {
    try {
      pieces = await accountRequest<PracticePiece[]>('community/practice');
      for (const piece of pieces) {
        if (thumbs[piece.id]) continue;
        file(piece.id, 'thumb').then((blob) => (thumbs[piece.id] = URL.createObjectURL(blob)), () => {});
      }
    } catch (cause) {
      studio.error = cause instanceof Error ? cause.message : 'Your practice pieces could not load.';
      pieces = [];
    }
  }
  $effect(() => {
    if (studio.home?.profile && pieces === null) void load();
  });
  onDestroy(() => Object.values(thumbs).forEach((url) => URL.revokeObjectURL(url)));

  async function download(piece: PracticePiece) {
    try {
      // Fetched before the tap's gesture runs out? Safari allows a few seconds, which is plenty here.
      const outcome = await saveFile(await onPaper(await file(piece.id, 'image')), `${fileSlug(piece.title, 'practice-piece')}.png`, piece.title);
      studio.notice = outcome === 'cancelled' ? 'Download cancelled.' : `${outcome === 'shared' ? 'Sent' : 'Downloading'} ${piece.title} (${piece.width} × ${piece.height}).`;
    } catch (cause) {
      studio.error = cause instanceof Error ? cause.message : 'That download did not work.';
    }
  }
  /** Newer pieces are saved as paint only; a download puts them back on the paper's color. */
  async function onPaper(picture: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(picture);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e1dfda';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('That download did not work.'))), 'image/png'));
  }
  async function remove(piece: PracticePiece) {
    try {
      await accountRequest('community/practice/delete', 'POST', { id: piece.id });
      pieces = (pieces ?? []).filter((p) => p.id !== piece.id);
      studio.notice = `${piece.title} deleted.`;
    } catch (cause) {
      studio.error = cause instanceof Error ? cause.message : 'That piece could not be deleted.';
    }
    deleting = null;
  }
  let tab = $state<'saved' | 'auto'>('saved');
  let saved = $derived((pieces ?? []).filter((p) => !p.autosave));
  let autos = $derived((pieces ?? []).filter((p) => p.autosave));
  let shown = $derived(tab === 'auto' ? autos : saved);
  /** Arrow keys move between tabs (the usual tab pattern). */
  function tabKey(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    tab = event.key === 'Home' ? 'saved' : event.key === 'End' ? 'auto' : tab === 'saved' ? 'auto' : 'saved';
    document.getElementById(`tab-${tab}`)?.focus();
  }
  const shapeName = (shape: string) => CANVAS_SHAPES[shape as CanvasShape]?.name ?? shape;
</script>

<header class="page-head">
  <div>
    <p class="eyebrow">Just you and the paints</p>
    <h1 tabindex="-1">Practice table</h1>
    <p>Every tool from the party, no timer, no turns. Unwind, try things, make something for yourself. These pieces are private to you.</p>
  </div>
  <a class="btn" href="/?practice">Start a practice canvas</a>
</header>

<!-- Saved pieces and Auto-saves are kept apart: auto-saves are quiet copies (the newest 20), never your saved work. -->
<div class="tabs" role="tablist" aria-label="Practice work">
  {#each [['saved', 'My pieces', saved.length], ['auto', 'Auto-saves', autos.length]] as [id, label, count] (id)}
    <button type="button" role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} tabindex={tab === id ? 0 : -1}
      onclick={() => (tab = id as 'saved' | 'auto')} onkeydown={tabKey}>{label}{#if pieces !== null}<span class="count">{" "}({count})</span>{/if}</button>
  {/each}
</div>

<div class="card" role="tabpanel" tabindex="0" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
  {#if tab === 'auto'}<p class="muted lead">Copies made while you paint, so a reload or a closed tab never loses your work. Only the newest 20 are kept. How often: <a href="/account/settings" onclick={(e) => go('/account/settings', e)}>Settings</a>.</p>{/if}
  {#if pieces === null}
    <p>Opening your pieces…</p>
  {:else if shown.length}
    <ul class="pieces">
      {#each shown as piece (piece.id)}
        {@const source = piece.draftOf ? saved.find((p) => p.id === piece.draftOf) : null}
        <li>
          <a class="thumb" href={`/?practice&piece=${piece.id}`} aria-label={`Keep painting ${piece.title}`}>
            {#if thumbs[piece.id]}<img src={thumbs[piece.id]} alt="" />{/if}
          </a>
          <h3>{piece.title}</h3>
          <p class="muted">{shapeName(piece.shape)} · {when(piece.updatedAt, piece.autosave ? 'full' : 'date')}{#if piece.autosave} · {source ? `from “${source.title}”` : 'never saved'}{/if}</p>
          <div class="row">
            <a class="btn small" href={`/?practice&piece=${piece.id}`}>Keep painting</a>
            <button type="button" class="btn small quiet" onclick={() => download(piece)}>Download PNG</button>
            {#if deleting === piece.id}
              <button type="button" class="btn small danger" onclick={() => remove(piece)}>Yes, delete</button>
              <button type="button" class="btn small quiet" onclick={() => (deleting = null)}>Keep</button>
            {:else}
              <button type="button" class="btn small danger" onclick={() => (deleting = piece.id)}>Delete…</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {:else if tab === 'auto'}
    <p class="empty">No auto-saves yet. While you paint signed in, a copy is saved every few minutes.</p>
  {:else}
    <p class="empty">Nothing saved yet. Open the practice table, paint something, and choose “Save to my pieces”. You can always download a PNG instead.</p>
  {/if}
</div>

<style>
  .pieces { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: 24px; }
  .thumb { display: grid; place-items: center; aspect-ratio: 4 / 3; padding: 8px; background: #6b4426; }
  .thumb img { max-width: 100%; max-height: 100%; background: #e1dfda; box-shadow: 0 4px 10px #0005; }
  h3 { margin: 10px 0 2px; overflow-wrap: anywhere; }
  .muted { margin: 0 0 8px; }
  .lead { margin-bottom: 16px; }
  .tabs { display: flex; gap: 4px; margin: 0 0 -1px; }
  .tabs button { min-height: 44px; padding: 8px 16px; font: inherit; font-weight: 700; color: var(--ink, #2a261e); background: color-mix(in srgb, #fff6e5 60%, transparent); border: 2px solid #2a261e; border-bottom: 0; border-radius: 6px 6px 0 0; cursor: pointer; }
  .tabs button[aria-selected='true'] { background: #fff6e5; }
  .tabs button:focus-visible { outline: 3px solid #c98a00; outline-offset: 2px; }
  .count { font-weight: 400; }
</style>
