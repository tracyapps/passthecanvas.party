<!--
  The overview: what needs you (invitations, friend requests), what's coming
  up, and your corner of the studio at a glance. Two stacked columns, so
  cards never leave gaps; one column on narrow screens.
-->
<script lang="ts">
  import type { SharedParty } from '@ptc/shared';
  import { accountRequest } from '../account.svelte';
  import { act, go, studio, when } from './studio.svelte';
  import PersonBadge from './PersonBadge.svelte';
  import CutoutPreview from './CutoutPreview.svelte';
  import PartyCard from './PartyCard.svelte';
  import { isPast, statusOf } from './parties';

  const inviteToken = new URLSearchParams(location.hash.slice(1)).get('invite') ?? '';
  let shared = $state<SharedParty | null>(null);
  let sharedError = $state('');
  $effect(() => {
    if (!inviteToken || !studio.home) return;
    accountRequest<SharedParty>(`community/invitation?token=${encodeURIComponent(inviteToken)}`).then((p) => (shared = p), (e) => (sharedError = e instanceof Error ? e.message : 'This invitation is unavailable.'));
  });

  let home = $derived(studio.home);
  let profile = $derived(home?.profile ?? null);
  let upcoming = $derived((home?.parties ?? []).filter((p) => !isPast(p) && !p.cancelled).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  let needsReply = $derived(upcoming.filter((p) => statusOf(p) === 'invited'));
  let next = $derived(upcoming.filter((p) => statusOf(p) !== 'invited' && statusOf(p) !== 'declined').slice(0, 4));
  let defaultAvatar = $derived(studio.avatars.find((a) => a.id === profile?.defaultAvatarId) ?? studio.avatars[0] ?? null);
  const nav = (path: string) => (event: MouseEvent) => go(path, event);
</script>

<header class="page-head">
  <div>
    <p class="eyebrow">Your studio</p>
    <h1 tabindex="-1">{profile ? `Hi, ${profile.name}.` : 'Your studio.'}</h1>
  </div>
  <div class="row">
    <a class="btn" href="/account/parties/new" onclick={nav('/account/parties/new')}>Plan a party</a>
    <a class="btn quiet" href="/account/avatars/new" onclick={nav('/account/avatars/new')}>Make an avatar</a>
  </div>
</header>

{#if inviteToken}
  <section class="card invite" aria-labelledby="invite-title">
    {#if shared}
      <p class="eyebrow">You're invited</p>
      <h2 id="invite-title">{shared.title}</h2>
      <p>Hosted by {shared.hostName} · {when(shared.startsAt)} (your time) · {shared.durationMinutes} minutes</p>
      {#if shared.description}<p class="description">{shared.description}</p>{/if}
      <button type="button" class="btn" onclick={() => void act('parties/join', { token: inviteToken }, "You're on the guest list. It's on your calendar page now.")}>Accept the invitation</button>
    {:else if sharedError}
      <h2 id="invite-title">Invitation unavailable</h2>
      <p>{sharedError}</p>
    {:else}
      <p id="invite-title">Opening your invitation…</p>
    {/if}
  </section>
{/if}

<div class="columns">
  <div>
    {#if needsReply.length || home?.incoming.length}
      <section class="card" aria-labelledby="needs-title">
        <h2 id="needs-title">Waiting on you</h2>
        <div class="stack">
          {#each needsReply as party (party.id)}<PartyCard {party} compact />{/each}
          {#if home?.incoming.length}
            <p>{home.incoming.length === 1 ? `${home.incoming[0]!.name} wants to connect.` : `${home.incoming.length} people want to connect.`} <a href="/account/friends" onclick={nav('/account/friends')}>See friend requests</a></p>
          {/if}
        </div>
      </section>
    {/if}

    <section class="card" aria-labelledby="next-title">
      <div class="row head"><h2 id="next-title">Coming up</h2><a href="/account/calendar" onclick={nav('/account/calendar')}>Full calendar</a></div>
      {#if next.length}
        <div class="stack">{#each next as party (party.id)}<PartyCard {party} />{/each}</div>
      {:else}
        <p class="empty">Nothing on the calendar yet. Your next great idea has room. <a href="/account/parties/new" onclick={nav('/account/parties/new')}>Plan a party</a></p>
      {/if}
    </section>

    <section class="card" aria-labelledby="art-title">
      <div class="row head"><h2 id="art-title">Recent art</h2><a href="/account/history" onclick={nav('/account/history')}>History & art</a></div>
      {#if home?.galleries.length}
        <ul class="list">
          {#each home.galleries.slice(0, 4) as gallery (gallery.archiveId)}
            <li><a href={`/?archive=${gallery.archiveId}`}>{gallery.title}</a> <span class="muted">· {when(gallery.savedAt, 'date')}</span></li>
          {/each}
        </ul>
      {:else}
        <p class="empty">When a host saves a party's gallery, your pieces land here.</p>
      {/if}
    </section>
  </div>

  <div>
    {#if profile}
      <section class="card me" aria-labelledby="me-title">
        <div class="person">
          <PersonBadge person={profile} size={72} />
          <div class="grow">
            <h2 id="me-title">{profile.name}</h2>
            {#if profile.bio}<p class="muted">{profile.bio}</p>{/if}
          </div>
        </div>
        <div class="row">
          <a class="btn small" href="/account/profile/edit" onclick={nav('/account/profile/edit')}>Edit profile</a>
          <a class="btn small quiet" href="/account/profile" onclick={nav('/account/profile')}>View profile</a>
        </div>
      </section>
    {/if}

    <section class="card" aria-labelledby="avatar-title">
      <div class="row head"><h2 id="avatar-title">Your avatar</h2><a href="/account/avatars" onclick={nav('/account/avatars')}>All avatars</a></div>
      {#if defaultAvatar}
        <div class="avatar-pair">
          <div class="cutout-wrap"><CutoutPreview design={defaultAvatar.design} label={`${defaultAvatar.name}, your default avatar`} /></div>
          <p>{defaultAvatar.name} stands in for you when your camera is off. {studio.avatars.length > 1 ? `You have ${studio.avatars.length} to choose from.` : ''}</p>
        </div>
      {:else}
        <p>Cut a paper shape and color it in. It stands in for you whenever your camera is off.</p>
        <a class="btn small" href="/account/avatars/new" onclick={nav('/account/avatars/new')}>Make my first avatar</a>
      {/if}
    </section>

    <section class="card" aria-labelledby="friends-title">
      <div class="row head"><h2 id="friends-title">Friends</h2><a href="/account/friends" onclick={nav('/account/friends')}>Manage</a></div>
      {#if home?.friends.length}
        <ul class="faces">
          {#each home.friends.slice(0, 8) as friend (friend.id)}<li><PersonBadge person={friend} size={44} label={friend.name} /></li>{/each}
        </ul>
        <p class="muted">{home.friends.length} {home.friends.length === 1 ? 'friend' : 'friends'} in your studio.</p>
      {:else}
        <p>Share your profile link to find each other.</p>
      {/if}
    </section>

    <section class="card" aria-labelledby="ready-title">
      <h2 id="ready-title">Before a party</h2>
      <p>Check your camera, microphone and speakers, and save the ones you like.</p>
      <a class="btn small quiet" href="/account/devices" onclick={nav('/account/devices')}>Camera & mic check</a>
    </section>
  </div>
</div>

<style>
  .head { justify-content: space-between; margin-bottom: 12px; }
  .head h2 { margin: 0; }
  .head a { min-height: 44px; display: inline-flex; align-items: center; font-weight: 700; }
  .invite { border-left: 8px double #c98a00; }
  .description { white-space: pre-line; }
  .me .row { margin-top: 16px; }
  .me h2 { margin: 0; overflow-wrap: anywhere; }
  .avatar-pair { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 16px; align-items: center; }
  .avatar-pair p { margin: 0; }
  .faces { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
</style>
