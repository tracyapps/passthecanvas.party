<!--
  Edit profile: name, a line about you, a photo (or your initials on a color
  you pick) and links to find you elsewhere. Privacy and email choices live
  in Settings.
-->
<script lang="ts">
  import { cleanSocialLink, INITIALS_COLOR_KEYS, INITIALS_COLORS, MAX_SOCIAL_LINKS, SOCIAL_KIND_KEYS, SOCIAL_KINDS, type InitialsColor, type SocialKind, type SocialLink } from '@ptc/shared';
  import { accountRequest } from '../account.svelte';
  import { go, refresh, studio } from './studio.svelte';
  import PersonBadge from './PersonBadge.svelte';

  const profile = studio.home?.profile ?? null;
  let name = $state(profile?.name ?? '');
  let bio = $state(profile?.bio ?? '');
  let color = $state<InitialsColor>(profile?.avatar.color ?? 'teal');
  let links = $state<SocialLink[]>(profile ? profile.links.map((l) => ({ ...l })) : []);
  let newKind = $state<SocialKind>('instagram');
  let newValue = $state('');
  let linkProblem = $state('');
  let saving = $state(false);
  let photoPreview = $state<string | null>(null);
  let photoData = $state<string | null>(null);
  let photoProblem = $state('');
  let removePhoto = $state(false);

  let preview = $derived({ id: profile?.id ?? 'new', name: name || 'You', photo: removePhoto ? null : profile?.photo ?? null, avatar: { color } });

  const PLACEHOLDER: Partial<Record<SocialKind, string>> = { website: 'https://your-site.com', discord: 'username or https://discord.gg/…', mastodon: 'https://mastodon.art/@you', bluesky: 'https://bsky.app/profile/you.bsky.social' };

  function addLink() {
    let value = newValue.trim();
    // Friendly: "instagram.com/you" without https:// is fine.
    if (newKind !== 'discord' && value && !/^https?:\/\//i.test(value)) value = `https://${value}`;
    const clean = cleanSocialLink({ kind: newKind, value });
    if (!clean) {
      linkProblem = newKind === 'discord' ? 'Use your Discord username, or a discord.com or discord.gg link.' : `That doesn't look like a${SOCIAL_KINDS[newKind].hosts.length ? ` ${SOCIAL_KINDS[newKind].label}` : 'n https'} link.`;
      return;
    }
    links = [...links, clean];
    newValue = '';
    linkProblem = '';
  }

  /** Center-crop to a square, shrink to 400px and re-encode (which also drops camera metadata like location). */
  async function choosePhoto(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    photoProblem = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return void (photoProblem = 'Choose an image file.');
    try {
      const bitmap = await createImageBitmap(file);
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.min(400, side);
      canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
      let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.86));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
      if (!blob || blob.size > 400_000) return void (photoProblem = "That photo is too detailed to save. Try another.");
      photoData = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob!); });
      photoPreview = photoData;
      removePhoto = false;
    } catch {
      photoProblem = "That image couldn't be opened. Try a JPEG or PNG.";
    }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    saving = true;
    studio.error = '';
    try {
      await accountRequest('community/profile', 'PUT', {
        name, bio, avatar: { color }, links,
        share: profile?.share ?? false, allowRequests: profile?.allowRequests ?? true, emailInvites: profile?.emailInvites ?? false, emailReminders: profile?.emailReminders ?? false
      });
      if (photoData) await accountRequest('community/photo', 'PUT', { image: photoData });
      else if (removePhoto && profile?.photo) await accountRequest('community/photo/clear', 'POST', {});
      await refresh();
      go('/account/profile');
      studio.notice = 'Profile saved.';
    } catch (cause) {
      studio.error = cause instanceof Error ? cause.message : 'Your profile could not be saved.';
    } finally {
      saving = false;
    }
  }
</script>

<header class="page-head">
  <div>
    <p class="eyebrow">Your profile</p>
    <h1 tabindex="-1">{profile ? 'Edit profile' : 'Set up your profile'}</h1>
    <p>Friends see this. Privacy and email choices are in <a href="/account/settings" onclick={(e) => go('/account/settings', e)}>Settings</a>.</p>
  </div>
  {#if profile}<a class="btn quiet" href="/account/profile" onclick={(e) => go('/account/profile', e)}>View profile</a>{/if}
</header>

<form class="columns" onsubmit={save}>
  <div>
    <section class="card stack" aria-labelledby="basics-title">
      <h2 id="basics-title">The basics</h2>
      <label class="field">Display name<input maxlength="40" required bind:value={name} autocomplete="nickname" /></label>
      <label class="field">A little about you <span class="hint">Up to 280 characters.</span><textarea maxlength="280" rows="3" bind:value={bio}></textarea></label>
    </section>

    <section class="card stack" aria-labelledby="links-title">
      <h2 id="links-title">Find me elsewhere</h2>
      <p class="hint">Instagram, Bluesky, Discord, your website… Only full https links are shown (or a Discord username).</p>
      {#if links.length}
        <ul class="list">
          {#each links as link, i (i)}
            <li class="row link-row"><strong>{SOCIAL_KINDS[link.kind].label}</strong><span class="grow">{link.value}</span>
              <button type="button" class="btn small quiet" aria-label={`Remove ${SOCIAL_KINDS[link.kind].label} link`} onclick={() => (links = links.filter((_, j) => j !== i))}>Remove</button></li>
          {/each}
        </ul>
      {/if}
      {#if links.length < MAX_SOCIAL_LINKS}
        <div class="add-link">
          <label class="field">Where<select bind:value={newKind}>{#each SOCIAL_KIND_KEYS as kind (kind)}<option value={kind}>{SOCIAL_KINDS[kind].label}</option>{/each}</select></label>
          <label class="field">Link{newKind === 'discord' ? ' or username' : ''}<input bind:value={newValue} placeholder={PLACEHOLDER[newKind] ?? `https://${SOCIAL_KINDS[newKind].hosts[0] ?? ''}/you`} aria-describedby="link-problem" onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} /></label>
          <button type="button" class="btn quiet" onclick={addLink} disabled={!newValue.trim()}>Add link</button>
        </div>
        <p class="hint" id="link-problem" role="alert">{linkProblem}</p>
      {/if}
    </section>
  </div>

  <div>
    <section class="card stack" aria-labelledby="picture-title">
      <h2 id="picture-title">Your picture</h2>
      <div class="picture"><PersonBadge person={preview} preview={removePhoto ? null : photoPreview} size={120} label="Preview of your picture" /></div>
      <label class="field">Upload a photo <span class="hint">Cropped to a circle. Optional, and you can remove it any time.</span>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/heic" onchange={choosePhoto} />
      </label>
      {#if photoProblem}<p class="hint" role="alert">{photoProblem}</p>{/if}
      {#if (profile?.photo || photoPreview) && !removePhoto}
        <button type="button" class="btn small quiet" onclick={() => { removePhoto = true; photoData = null; photoPreview = null; }}>Use my initials instead</button>
      {/if}
      <fieldset>
        <legend>Color behind your initials</legend>
        <div class="choices">
          {#each INITIALS_COLOR_KEYS as key (key)}
            <label><input type="radio" name="initials-color" value={key} bind:group={color} /><span class="swatch" style:background={INITIALS_COLORS[key].fill}></span>{INITIALS_COLORS[key].label}</label>
          {/each}
        </div>
      </fieldset>
    </section>
    <div class="row">
      <button type="submit" class="btn" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Save profile'}</button>
      {#if profile}<a class="btn quiet" href="/account/profile" onclick={(e) => go('/account/profile', e)}>Cancel</a>{/if}
    </div>
  </div>
</form>

<style>
  .picture { display: flex; justify-content: center; padding: 8px 0; }
  .swatch { width: 18px; height: 18px; border-radius: 50%; box-shadow: 0 0 0 2px #fff9ed; }
  .add-link { display: grid; grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr) auto; gap: 12px; align-items: end; }
  @media (max-width: 640px) { .add-link { grid-template-columns: minmax(0, 1fr); } }
  .link-row .grow { flex: 1 1 10rem; overflow-wrap: anywhere; }
</style>
