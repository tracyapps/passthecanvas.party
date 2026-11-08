<!--
  Pull up a chair: your name, camera or avatar, and how you look when your
  camera is off. Signed-in artists can pick one of their cutout avatars or
  their profile photo; anyone can choose the color behind their initials.
  You can switch between camera and avatar any time in the party.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { INITIALS_COLOR_KEYS, INITIALS_COLORS, initialsOf, type InitialsColor, type Look, type Presence } from '@ptc/shared';
  import { accountState, initializeAccount } from '../account/account.svelte';
  import { photoUrl, refresh, studio } from '../account/studio/studio.svelte';
  import CutoutPreview from '../account/studio/CutoutPreview.svelte';
  import { cutoutLook, photoLook } from './looks';

  let { partyId, onjoin, notice = null }: { partyId: string; onjoin: (name: string, presence: Presence, look: Look) => void; notice?: string | null } = $props();

  let name = $state('');
  let presence = $state<Presence>('camera');
  let color = $state<InitialsColor>('teal');
  let choice = $state<string>('initials'); // an avatar id, 'photo' or 'initials'
  let busy = $state(false);
  let prefilled = false;

  onMount(() => {
    void initializeAccount().then(() => {
      if (accountState.userId && !studio.home) void refresh();
    });
  });
  // Fill in what the studio knows, once.
  $effect(() => {
    const profile = studio.home?.profile;
    if (!profile || prefilled) return;
    prefilled = true;
    name ||= profile.name;
    color = profile.avatar.color;
    choice = profile.defaultAvatarId && studio.avatars.some((a) => a.id === profile.defaultAvatarId) ? profile.defaultAvatarId : studio.avatars[0]?.id ?? (profile.photo ? 'photo' : 'initials');
  });
  let profile = $derived(studio.home?.profile ?? null);
  let photo = $derived(profile ? photoUrl(profile.id, profile.photo) : null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    busy = true;
    let image: string | null = null;
    try {
      const avatar = studio.avatars.find((a) => a.id === choice);
      if (avatar) image = await cutoutLook(avatar.design);
      else if (choice === 'photo' && photo) image = await photoLook(photo);
    } catch {
      image = null; // the initials stand in
    }
    onjoin(name.trim(), presence, { initialsColor: color, image });
  }
</script>

<form onsubmit={submit}>
  <p class="tape">Pass the Canvas</p>
  <h1>Pull up a chair</h1>
  {#if notice}<p class="notice" role="alert">{notice}</p>{/if}
  <label>
    <span>Your name</span>
    <input bind:value={name} autocomplete="nickname" required maxlength="40" />
  </label>
  <fieldset class="row">
    <legend>How should you show up?</legend>
    <label><input type="radio" bind:group={presence} value="camera" /> Camera</label>
    <label><input type="radio" bind:group={presence} value="avatar" /> Avatar</label>
  </fieldset>

  <fieldset class="looks">
    <legend>When your camera is off</legend>
    <div class="options">
      {#each studio.avatars as avatar (avatar.id)}
        <label class="look"><input type="radio" name="look" value={avatar.id} bind:group={choice} /><span class="pic"><CutoutPreview design={avatar.design} /></span><span class="cap">{avatar.name}</span></label>
      {/each}
      {#if photo}
        <label class="look"><input type="radio" name="look" value="photo" bind:group={choice} /><span class="pic"><img src={photo} alt="" /></span><span class="cap">My photo</span></label>
      {/if}
      <label class="look"><input type="radio" name="look" value="initials" bind:group={choice} /><span class="pic initials" style:background={INITIALS_COLORS[color].fill}>{initialsOf(name || '?')}</span><span class="cap">My initials</span></label>
    </div>
    {#if choice === 'initials'}
      <div class="colors" role="radiogroup" aria-label="Color behind your initials">
        {#each INITIALS_COLOR_KEYS as key (key)}
          <label class="swatch" title={INITIALS_COLORS[key].label}><input type="radio" name="initials-color" value={key} bind:group={color} aria-label={INITIALS_COLORS[key].label} /><span style:background={INITIALS_COLORS[key].fill}></span></label>
        {/each}
      </div>
    {/if}
    {#if !accountState.userId}
      <p class="hint">Signed in, you can use your own cutout avatars. <a href="/account/avatars/new">Make one</a>.</p>
    {:else if !studio.avatars.length && studio.home}
      <p class="hint"><a href="/account/avatars/new">Make a cutout avatar</a> in your studio.</p>
    {/if}
  </fieldset>

  <button type="submit" disabled={busy}>{busy ? 'Getting your seat ready…' : 'Join the party'}</button>
  <p class="hint">Party: <code>{partyId}</code>. Share this page's link to invite friends. You can switch camera and avatar any time.</p>
  <p class="hint">Already at the party on another device? Don't join twice: <a href="/?link">use a link code</a> to add this one to your seat.</p>
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
  h1 { margin: 0; font-size: 2.25rem; }
  label > span:first-child:not(.pic) { display: block; font-weight: 700; margin-bottom: 0.25rem; }
  input[autocomplete] { width: 100%; min-height: $tap-min; padding: 0 0.75rem; border: 1px solid #b9a483; border-radius: $radius-sm; background: #fff; color: $walnut-900; }
  fieldset { border: 0; padding: 0; margin: 0; }
  legend { font-weight: 700; margin-bottom: 0.5rem; }
  .row { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  .row label { display: flex; align-items: center; gap: 0.5rem; min-height: $tap-min; }
  .row input { width: 1.25rem; height: 1.25rem; accent-color: $cadmium-orange; }
  .options { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .look { position: relative; display: grid; justify-items: center; gap: 0.25rem; width: 5.5rem; padding: 0.375rem; border: 1px solid #c8b695; border-radius: $radius-sm; cursor: pointer; }
  .look input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .look:has(input:checked) { border: 3px solid $walnut-900; background: #fff4cf; }
  .look:has(input:focus-visible) { outline: 3px solid #276777; outline-offset: 2px; }
  .pic { display: grid; place-items: center; width: 3.75rem; height: 5rem; overflow: hidden; }
  .pic img { width: 100%; height: 100%; object-fit: cover; }
  .initials { color: #fff; font-family: $font-display; font-size: 1.5rem; border-radius: $radius-sm; }
  .cap { font-size: 0.8125rem; text-align: center; overflow-wrap: anywhere; }
  .colors { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.75rem; }
  .swatch { position: relative; width: $tap-min; height: $tap-min; cursor: pointer; }
  .swatch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .swatch span { display: block; width: 100%; height: 100%; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #8d7858; }
  .swatch:has(input:checked) span { box-shadow: 0 0 0 3px $walnut-900; }
  .swatch:has(input:focus-visible) { outline: 3px solid #276777; outline-offset: 4px; border-radius: 50%; }
  button { min-height: 3rem; border: 0; border-radius: $radius-pill; background: $walnut-900; color: $cream; font-weight: 700; }
  button:disabled { opacity: 0.7; }
  .hint { margin: 0; font-size: 0.875rem; color: #4a3828; }
  .notice { margin: 0; padding: 0.625rem 0.75rem; border-left: 4px solid $walnut-900; background: #fff4cf; font-weight: 700; }
  a { color: inherit; }
</style>
