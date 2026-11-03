<!-- Friends: requests to answer, people you're connected with, and adding someone by their link. -->
<script lang="ts">
  import { act, go, studio } from './studio.svelte';
  import PersonBadge from './PersonBadge.svelte';

  let target = $state('');
  let home = $derived(studio.home);

  function request(event: SubmitEvent) {
    event.preventDefault();
    let id = target.trim();
    try {
      id = new URLSearchParams(new URL(id).hash.slice(1)).get('profile') ?? id;
    } catch {
      /* a plain profile code works too */
    }
    void act('friends', { target: id }, 'Friend request sent. They choose whether to accept.').then(() => (target = ''));
  }
  const visit = (id: string) => (event: MouseEvent) => {
    event.preventDefault();
    history.pushState(null, '', `/account#profile=${id}`);
    location.reload();
  };
</script>

<header class="page-head">
  <div><p class="eyebrow">Your kind of people</p><h1 tabindex="-1">Friends</h1></div>
</header>

<div class="columns">
  <div>
    {#if home?.incoming.length}
      <section class="card" aria-labelledby="incoming-title">
        <h2 id="incoming-title">Wants to connect</h2>
        <ul class="list">
          {#each home.incoming as person (person.id)}
            <li class="person"><PersonBadge {person} size={48} /><a class="grow" href={`/account#profile=${person.id}`} onclick={visit(person.id)}>{person.name}</a>
              <button type="button" class="btn small" onclick={() => void act('friends/respond', { target: person.id, action: 'accept' }, `You and ${person.name} are friends now.`)}>Accept</button>
              <button type="button" class="btn small quiet" onclick={() => void act('friends/respond', { target: person.id, action: 'decline' }, 'Request declined. They cannot send it again.')}>Decline</button></li>
          {/each}
        </ul>
      </section>
    {/if}
    <section class="card" aria-labelledby="friends-title">
      <h2 id="friends-title">Your friends</h2>
      {#if home?.friends.length}
        <ul class="list">
          {#each home.friends as person (person.id)}
            <li class="person"><PersonBadge {person} size={48} /><a class="grow" href={`/account#profile=${person.id}`} onclick={visit(person.id)}>{person.name}</a>
              <button type="button" class="btn small quiet" onclick={() => void act('friends/respond', { target: person.id, action: 'remove' }, `Removed ${person.name} from your friends.`)}>Remove</button></li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No friends connected yet. Share your profile link to find each other.</p>
      {/if}
      {#if home?.outgoing.length}<p class="muted">Waiting for a reply: {home.outgoing.map((p) => p.name).join(', ')}.</p>{/if}
    </section>
  </div>
  <div>
    <section class="card" aria-labelledby="add-title">
      <h2 id="add-title">Add a friend</h2>
      <form class="stack" onsubmit={request}>
        <label class="field">Their profile link or code<input bind:value={target} required /></label>
        <button type="submit" class="btn">Send friend request</button>
      </form>
      <p class="hint">Your own link is on <a href="/account/profile" onclick={(e) => go('/account/profile', e)}>your profile</a>.</p>
    </section>
  </div>
</div>
