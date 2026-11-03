<!--
  A profile page: yours (/account/profile), or someone else's from their
  shared link (/account#profile=<id>).
-->
<script lang="ts">
  import { SOCIAL_KINDS, socialHref, type StudioProfile } from '@ptc/shared';
  import { accountRequest } from '../account.svelte';
  import { act, go, studio } from './studio.svelte';
  import PersonBadge from './PersonBadge.svelte';

  const visitingId = new URLSearchParams(location.hash.slice(1)).get('profile');
  let visiting = $state<StudioProfile | null>(null);
  let problem = $state('');
  let copied = $state('');
  let own = $derived(studio.home?.profile ?? null);

  $effect(() => {
    if (!visitingId || !studio.home || visitingId === own?.id) return;
    accountRequest<StudioProfile>(`community/profile?id=${encodeURIComponent(visitingId)}`).then((p) => (visiting = p), (e) => (problem = e instanceof Error ? e.message : 'This profile is unavailable.'));
  });

  let person = $derived(visitingId && visitingId !== own?.id ? visiting : own);
  let mine = $derived(!!person && person.id === own?.id);
  let friend = $derived(!!person && !!studio.home?.friends.some((f) => f.id === person!.id));
  let pending = $derived(!!person && !!studio.home?.outgoing.some((f) => f.id === person!.id));
  let shareLink = $derived(own ? `${location.origin}/account#profile=${own.id}` : '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareLink);
      copied = 'Profile link copied.';
    } catch {
      copied = 'Copying was blocked. Select the link and copy it yourself.';
    }
  }
  const display = (value: string) => value.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
</script>

{#if person}
  <header class="page-head">
    <div>
      <p class="eyebrow">{mine ? 'Your profile' : 'Studio profile'}</p>
      <h1 tabindex="-1">{person.name}</h1>
    </div>
    {#if mine}<a class="btn" href="/account/profile/edit" onclick={(e) => go('/account/profile/edit', e)}>Edit profile</a>{/if}
  </header>

  <div class="columns">
    <div>
      <section class="card profile">
        <PersonBadge {person} size={132} />
        <div class="about">
          {#if person.bio}<p class="bio">{person.bio}</p>{:else if mine}<p class="muted">Add a line about yourself in Edit profile.</p>{/if}
          {#if person.links.length}
            <h2 class="sr">Find {mine ? 'me' : person.name} elsewhere</h2>
            <ul class="links">
              {#each person.links as link, i (i)}
                {@const href = socialHref(link)}
                <li>
                  <span class="kind">{SOCIAL_KINDS[link.kind].label}</span>
                  {#if href}<a {href} target="_blank" rel="noopener noreferrer me">{display(link.value)}</a>{:else}<span>{link.value}</span>{/if}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </section>
    </div>
    <div>
      {#if mine}
        <section class="card" aria-labelledby="share-title">
          <h2 id="share-title">Share your profile</h2>
          {#if person.share}
            <label class="field">Your profile link<input readonly value={shareLink} onfocus={(e) => e.currentTarget.select()} /></label>
            <button type="button" class="btn small" onclick={copy}>Copy link</button>
            <p class="hint" role="status">{copied}</p>
          {:else}
            <p>Your profile is private. Turn on sharing in <a href="/account/settings" onclick={(e) => go('/account/settings', e)}>Settings</a> to give friends a link.</p>
          {/if}
        </section>
      {:else}
        <section class="card">
          {#if friend}<p>You're friends.</p>
          {:else if pending}<p>Friend request sent. They choose whether to accept.</p>
          {:else}<button type="button" class="btn" disabled={!person.allowRequests || !person.share || !own} onclick={() => void act('friends', { target: person!.id }, 'Friend request sent.')}>Add friend</button>
            {#if !person.allowRequests}<p class="hint">{person.name} isn't taking friend requests right now.</p>{/if}
          {/if}
        </section>
      {/if}
    </div>
  </div>
{:else if problem}
  <header class="page-head"><h1 tabindex="-1">Profile unavailable</h1></header>
  <p class="card">{problem}</p>
{:else}
  <p>Opening the profile…</p>
{/if}

<style>
  .profile { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 24px; align-items: start; }
  @media (max-width: 560px) { .profile { grid-template-columns: minmax(0, 1fr); } }
  .bio { font-size: 18px; white-space: pre-line; }
  .links { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .links li { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; min-height: 44px; border-top: 1px solid #c8b695; }
  .kind { font-weight: 700; min-width: 7rem; }
  .links a { overflow-wrap: anywhere; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
