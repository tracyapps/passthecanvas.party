<!--
  Top-level screen switch: join form → studio.
  Party id comes from the URL (?party=maya-30th); one is made up if missing.
-->
<script lang="ts">
  import type { Presence } from '@ptc/shared';
  import { PartyConnection } from './lib/party/connection.svelte';
  import Studio from './lib/Studio.svelte';

  const params = new URLSearchParams(location.search);
  const partyId = params.get('party') ?? `party-${Math.random().toString(36).slice(2, 8)}`;

  const party = new PartyConnection();
  let name = $state('');
  let presence = $state<Presence>('camera');
  let joined = $state(false);

  function join(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    history.replaceState(null, '', `?party=${partyId}`);
    party.join(partyId, name.trim(), presence);
    joined = true;
  }
</script>

{#if !joined}
  <main class="join">
    <form onsubmit={join}>
      <p class="tape">Pass the Canvas</p>
      <h1>Pull up a chair</h1>
      <label>
        <span>Your name</span>
        <input bind:value={name} autocomplete="nickname" required maxlength="40" />
      </label>
      <fieldset>
        <legend>How should you show up?</legend>
        <label><input type="radio" bind:group={presence} value="camera" /> Camera</label>
        <label><input type="radio" bind:group={presence} value="avatar" /> Avatar</label>
      </fieldset>
      <button type="submit">Join the party</button>
      <p class="hint">Party: <code>{partyId}</code>. Share this page's link to invite friends.</p>
    </form>
  </main>
{:else}
  <Studio {party} onleave={() => (joined = false)} />
{/if}

<style lang="scss">
  @use './styles/tokens' as *;
  @use './styles/mixins' as *;

  .join {
    @include walnut-table;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 1rem;
  }

  form {
    width: min(26rem, 100%);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem;
    background: $paper;
    color: $walnut-900;
    box-shadow: 0 24px 50px rgb(0 0 0 / 0.5);
    transform: rotate(-0.6deg);
  }

  .tape {
    @include tape-label;
    align-self: flex-start;
    margin: 0;
    font-size: 1.5rem;
  }

  h1 {
    margin: 0;
    font-size: 2.25rem;
  }

  label > span {
    display: block;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  input:not([type='radio']) {
    width: 100%;
    min-height: $tap-min;
    padding: 0 0.75rem;
    border: 1px solid #b9a483;
    border-radius: $radius-sm;
    background: #fff;
    color: $walnut-900;
  }

  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;

    legend {
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: $tap-min;
    }
    input {
      width: 1.25rem;
      height: 1.25rem;
      accent-color: $cadmium-orange;
    }
  }

  button {
    min-height: 3rem;
    border: 0;
    border-radius: $radius-pill;
    background: $walnut-900;
    color: $cream;
    font-weight: 700;
  }

  .hint {
    margin: 0;
    font-size: 0.875rem;
    color: #4a3828;
  }
</style>
