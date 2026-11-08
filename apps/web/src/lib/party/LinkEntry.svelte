<!--
  Add this device to your seat: type the 6-character code shown on your
  other device (or scan its QR code, which skips this page). The code only
  joins your seat in that one party. It never signs anyone in.
-->
<script lang="ts">
  import { LINK_CODE, normalizeLinkCode } from '@ptc/shared';
  import { partyUrl } from './origin';

  let code = $state('');
  let error = $state('');
  let busy = $state(false);
  let input: HTMLInputElement;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const clean = normalizeLinkCode(code);
    if (!LINK_CODE.test(clean)) {
      error = 'Codes are 6 letters and numbers, like K7P-3QM.';
      input.focus();
      return;
    }
    busy = true;
    error = '';
    try {
      const response = await fetch(partyUrl(`/api/link/${clean}`));
      if (response.status === 429) throw new Error('Too many tries. Wait a few minutes, then make a new code.');
      if (!response.ok) throw new Error("That code didn't work. Codes work once, for 5 minutes. Make a new one on your other device.");
      const { party } = await response.json();
      // The code goes in the fragment, so it never reaches a server log.
      location.assign(`/?party=${encodeURIComponent(party)}#link=${clean}`);
    } catch (cause) {
      error = cause instanceof Error && !(cause instanceof TypeError) ? cause.message : "Couldn't reach the party server. Check your connection and try again.";
      busy = false;
      input.focus();
    }
  }
</script>

<form onsubmit={submit} aria-describedby="link-help">
  <p class="tape">Pass the Canvas</p>
  <h1>Add this device to your seat</h1>
  <p id="link-help">On the device you're already using at the party, open <strong>Menu → Use another device</strong>. Type the code it shows.</p>
  <label>
    <span>Link code</span>
    <input bind:this={input} bind:value={code} autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" inputmode="text" maxlength="9" required aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'link-error' : undefined} />
  </label>
  {#if error}<p class="error" id="link-error" role="alert">{error}</p>{/if}
  <button type="submit" disabled={busy}>{busy ? 'Finding your seat…' : 'Link this device'}</button>
  <p class="hint">New here? <a href="/">Start or join a party</a> instead.</p>
</form>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  form {
    width: min(30rem, 100%);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem;
    background: $paper;
    color: $walnut-900;
    box-shadow: 0 24px 50px rgb(0 0 0 / 0.5);
    transform: rotate(-0.6deg);
  }
  .tape { @include tape-label; align-self: flex-start; margin: 0; font-size: 1.5rem; }
  h1 { margin: 0; font-size: 2rem; }
  p { margin: 0; }
  label > span { display: block; font-weight: 700; margin-bottom: 0.25rem; }
  input {
    width: 100%;
    min-height: 3.5rem;
    padding: 0 0.75rem;
    border: 1px solid #b9a483;
    border-radius: $radius-sm;
    background: #fff;
    color: $walnut-900;
    font-family: $font-display;
    font-size: 1.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .error { padding: 0.625rem 0.75rem; border-left: 4px solid #8a2a12; background: #fde6dc; font-weight: 700; }
  button { min-height: 3rem; border: 0; border-radius: $radius-pill; background: $walnut-900; color: $cream; font-weight: 700; }
  button:disabled { opacity: 0.7; }
  .hint { font-size: 0.875rem; color: #4a3828; }
  a { color: inherit; }
</style>
