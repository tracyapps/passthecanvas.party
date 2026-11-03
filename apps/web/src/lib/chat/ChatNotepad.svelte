<!--
  The party notepad: a paper pad for chat. A real <form>, an ordered list
  with role="log" (screen readers hear new notes politely), and your own
  notes marked in words, not only by position.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { PartyConnection } from '../party/connection.svelte';

  let { party }: { party: PartyConnection } = $props();
  let draft = $state('');
  let list: HTMLOListElement;

  function send(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    party.send({ type: 'chat', text: text.slice(0, 500) });
    draft = '';
  }

  // Keep the newest note in view.
  $effect(() => {
    void party.chat.length;
    void tick().then(() => list?.lastElementChild?.scrollIntoView({ block: 'nearest' }));
  });

  function time(at: number) {
    return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
</script>

<div class="pad">
  {#if party.chat.length === 0}
    <p class="empty">No notes yet. Say hi to the table.</p>
  {/if}
  <ol bind:this={list} role="log" aria-label="Party notes">
    {#each party.chat as note (note.at + note.fromId + note.text)}
      <li class:mine={note.fromId === party.youId}>
        <span class="who">{note.fromId === party.youId ? 'You' : note.name}</span>
        <time datetime={new Date(note.at).toISOString()}>{time(note.at)}</time>
        <p>{note.text}</p>
      </li>
    {/each}
  </ol>
  <form onsubmit={send}>
    <label for="note-draft" class="sr-only">Write a note to the party</label>
    <input id="note-draft" bind:value={draft} maxlength="500" autocomplete="off" placeholder="Write a note…" />
    <button type="submit" disabled={!draft.trim()}>Send</button>
  </form>
</div>

<style lang="scss">
  @use '../../styles/tokens' as *;

  .pad {
    display: grid;
    gap: 0.5rem;
    // Ruled notepad paper.
    background: repeating-linear-gradient(transparent 0 1.6rem, rgb(80 110 160 / 0.18) 1.6rem calc(1.6rem + 1px));
  }

  .empty {
    margin: 0;
    font-size: 0.875rem;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 16rem;
    overflow-y: auto;
    display: grid;
    gap: 0.5rem;
  }

  li {
    font-size: 0.9375rem;
    line-height: 1.6rem;

    p {
      margin: 0;
      font-family: $font-hand;
      font-size: 1.25rem;
      overflow-wrap: anywhere;
    }
  }

  .who {
    font-weight: 700;
  }

  .mine .who {
    color: #8a3b12;
  }

  time {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    color: #5a4634;
  }

  form {
    display: flex;
    gap: 0.5rem;
  }

  input {
    flex: 1;
    min-width: 0;
    min-height: $tap-min;
    padding: 0 0.625rem;
    border: 1px solid #b9a483;
    border-radius: $radius-sm;
    background: #fff;
    color: $walnut-900;
    font: inherit;
  }

  button {
    min-height: $tap-min;
    padding: 0 1rem;
    border: 0;
    border-radius: $radius-sm;
    background: $walnut-900;
    color: $cream;
    font-weight: 700;

    &:disabled {
      opacity: 0.5;
    }
  }
</style>
