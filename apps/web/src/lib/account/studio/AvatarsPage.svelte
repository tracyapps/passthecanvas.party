<!--
  Avatars: every cutout you've made, in a grid. Pick your default (the one
  that stands in for you when your camera is off), rename, duplicate, edit,
  or delete. /account/avatars/new and /account/avatars/<id> open the maker.
-->
<script lang="ts">
  import type { AvatarDesign, SavedAvatar } from '@ptc/shared';
  import { MAX_AVATARS } from '@ptc/shared';
  import { accountState } from '../account.svelte';
  import { act, go, studio, when } from './studio.svelte';
  import AvatarEditor from './AvatarEditor.svelte';
  import CutoutPreview from './CutoutPreview.svelte';

  let { path }: { path: string } = $props();
  let editingId = $derived(path.match(/^\/account\/avatars\/([0-9a-f-]{36})$/)?.[1] ?? null);
  let making = $derived(path === '/account/avatars/new');
  let editing = $derived(editingId ? studio.avatars.find((a) => a.id === editingId) ?? null : null);
  let defaultId = $derived(studio.home?.profile?.defaultAvatarId ?? null);
  let canSave = $derived(!!accountState.userId && !!studio.home?.profile);
  let renaming = $state<string | null>(null);
  let renameText = $state('');
  let deleting = $state<string | null>(null);

  async function save(name: string, design: AvatarDesign) {
    const result = await act<{ id: string }>('avatars', { id: editing?.id ?? null, name, design }, `${name} saved.`);
    if (result) {
      go('/account/avatars');
      studio.notice = `${name} saved.`;
    }
  }
  function duplicate(a: SavedAvatar) {
    void act('avatars', { id: null, name: `${a.name} copy`.slice(0, 40), design: a.design }, `Made a copy of ${a.name}.`);
  }
  function rename(a: SavedAvatar, event: SubmitEvent) {
    event.preventDefault();
    void act('avatars', { id: a.id, name: renameText.trim() || a.name, design: a.design }, 'Renamed.').then(() => (renaming = null));
  }
</script>

{#if making || editingId}
  <header class="page-head">
    <div><p class="eyebrow">Avatar maker</p><h1 tabindex="-1">{editing ? `Edit ${editing.name}` : 'Make an avatar'}</h1>
      <p>Pick a paper shape, choose your paper, then color it in.</p></div>
  </header>
  {#if editingId && !editing}
    <p class="card">{studio.loading ? 'Opening your avatar…' : "This avatar isn't in your studio."}</p>
  {:else}
    {#key editingId}
      <AvatarEditor avatar={editing} {canSave} onsave={save} oncancel={() => go(accountState.userId ? '/account/avatars' : '/account')} />
    {/key}
  {/if}
{:else}
  <header class="page-head">
    <div><p class="eyebrow">Your studio</p><h1 tabindex="-1">Avatars</h1>
      <p>Your default avatar stands in for you whenever your camera is off. You can switch between camera and avatar any time during a party.</p></div>
    <a class="btn" href="/account/avatars/new" onclick={(e) => go('/account/avatars/new', e)} aria-disabled={studio.avatars.length >= MAX_AVATARS}>Make a new avatar</a>
  </header>

  {#if studio.avatars.length}
    <ul class="tiles avatars">
      {#each studio.avatars as a (a.id)}
        <li class="card tile" class:is-default={a.id === defaultId}>
          <a class="art" href={`/account/avatars/${a.id}`} onclick={(e) => go(`/account/avatars/${a.id}`, e)} aria-label={`Edit ${a.name}`}><CutoutPreview design={a.design} /></a>
          {#if renaming === a.id}
            <form class="stack" onsubmit={(e) => rename(a, e)}>
              <label class="field">New name<input maxlength="40" bind:value={renameText} /></label>
              <div class="row"><button type="submit" class="btn small">Save</button><button type="button" class="btn small quiet" onclick={() => (renaming = null)}>Cancel</button></div>
            </form>
          {:else}
            <h2 class="name">{a.name}</h2>
            <p class="muted">{a.id === defaultId ? 'Your default' : `Updated ${when(a.updatedAt, 'date')}`}</p>
          {/if}
          {#if a.id === defaultId}
            <span class="tag going">Default</span>
          {:else}
            <button type="button" class="btn small" onclick={() => void act('avatars/default', { id: a.id }, `${a.name} is your default avatar now.`)}>Use as default</button>
          {/if}
          <details class="more">
            <summary class="btn small quiet">More<span class="sr"> for {a.name}</span></summary>
            <div class="stack menu">
              <a class="btn small quiet" href={`/account/avatars/${a.id}`} onclick={(e) => go(`/account/avatars/${a.id}`, e)}>Edit</a>
              <button type="button" class="btn small quiet" onclick={() => { renaming = a.id; renameText = a.name; }}>Rename</button>
              <button type="button" class="btn small quiet" disabled={studio.avatars.length >= MAX_AVATARS} onclick={() => duplicate(a)}>Duplicate</button>
              {#if deleting === a.id}
                <button type="button" class="btn small danger" onclick={() => void act('avatars/delete', { id: a.id }, `${a.name} deleted.`).then(() => (deleting = null))}>Yes, delete</button>
              {:else}
                <button type="button" class="btn small danger" onclick={() => (deleting = a.id)}>Delete…</button>
              {/if}
            </div>
          </details>
        </li>
      {/each}
    </ul>
    <p class="muted">{studio.avatars.length} of {MAX_AVATARS} avatars.</p>
  {:else}
    <section class="card">
      <h2>No avatars yet</h2>
      <p>Cut out a paper shape and color it in. It's how you show up when your camera is off.</p>
      <a class="btn" href="/account/avatars/new" onclick={(e) => go('/account/avatars/new', e)}>Make my first avatar</a>
    </section>
  {/if}
{/if}

<style>
  .avatars { list-style: none; margin: 0; padding: 0; }
  .tile { display: grid; gap: 8px; align-content: start; padding: 16px; }
  .tile.is-default { box-shadow: 0 0 0 4px #07616a, 2px 12px 18px #27180e35; }
  .art { display: block; padding: 8px; background: #ece3cf; }
  .art:hover { background: #e3d6bb; }
  .name { font-size: 18px; margin: 0; overflow-wrap: anywhere; }
  .muted { margin: 0; }
  .tag { justify-self: start; }
  .more summary { list-style: none; }
  .more summary::-webkit-details-marker { display: none; }
  .menu { margin-top: 8px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
