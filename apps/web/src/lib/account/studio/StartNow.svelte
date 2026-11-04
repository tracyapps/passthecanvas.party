<!--
  Start a party now (/account/parties/now): like starting a call. Name it,
  pick how time works, and you're in the room; invite people from there
  (or right here) with a link or straight to your friends' studios.
-->
<script lang="ts">
  import { DEFAULT_PARTY_SETTINGS, durationText, planTiming, roomIdFor, turnLengthText, type PartySettings } from '@ptc/shared';
  import { accountRequest } from '../account.svelte';
  import { go, refresh, studio } from './studio.svelte';

  const name = studio.home?.profile?.name ?? 'My';
  let title = $state(`${name}'s party`);
  let settings = $state<PartySettings>(structuredClone(DEFAULT_PARTY_SETTINGS));
  let invite = $state<string[]>([]);
  let starting = $state(false);
  let plan = $derived(planTiming(settings.timing, Math.max(2, invite.length + 1)));

  async function start(event: SubmitEvent) {
    event.preventDefault();
    starting = true;
    studio.error = '';
    try {
      const durationMinutes = Math.max(15, Math.min(240, settings.timing.mode === 'party' ? settings.timing.partyMinutes : Math.ceil(planTiming(settings.timing, settings.maxGuests).totalSeconds / 60)));
      const result = await accountRequest<{ id: string; token: string }>('community/parties/now', 'POST', { title: title.trim() || `${name}'s party`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, durationMinutes, settings: $state.snapshot(settings) });
      // Friends you picked get the invitation in their studio right away.
      await Promise.all(invite.map((friend) => accountRequest('community/parties/invite', 'POST', { party: result.id, friend }).catch(() => null)));
      await refresh();
      location.href = `/?party=${roomIdFor(result.id)}`;
    } catch (cause) {
      studio.error = cause instanceof Error ? cause.message : 'The party could not start.';
      starting = false;
    }
  }
</script>

<header class="page-head">
  <div>
    <p class="eyebrow">No planning needed</p>
    <h1 tabindex="-1">Start a party now</h1>
    <p>Open a room right away and bring people in, like starting a call. Want to set a date instead? <a href="/account/parties/new" onclick={(e) => go('/account/parties/new', e)}>Plan a party</a>.</p>
  </div>
</header>

<form class="columns" onsubmit={start}>
  <div>
    <section class="card stack" aria-labelledby="now-title">
      <h2 id="now-title">Your party</h2>
      <label class="field">Party name<input maxlength="80" required bind:value={title} /></label>
      <fieldset>
        <legend>How should time work?</legend>
        <label class="check"><input type="radio" name="mode" checked={settings.timing.mode === 'turn'} onchange={() => (settings.timing.mode = 'turn')} /><span><strong>Set the turn length</strong> <span class="hint">(the party runs as long as it takes)</span></span></label>
        <label class="check"><input type="radio" name="mode" checked={settings.timing.mode === 'party'} onchange={() => (settings.timing.mode = 'party')} /><span><strong>Set the party length</strong> <span class="hint">(turns share the time)</span></span></label>
      </fieldset>
      {#if settings.timing.mode === 'party'}
        <label class="field">Party length<select bind:value={settings.timing.partyMinutes}>{#each [30, 45, 60, 90, 120] as m (m)}<option value={m}>{durationText(m * 60)}</option>{/each}</select></label>
      {:else}
        <label class="field">Each turn<select bind:value={settings.timing.turnSeconds}>{#each [60, 90, 120, 180, 300, 420, 600] as s (s)}<option value={s}>{turnLengthText(s)}</option>{/each}</select></label>
      {/if}
      <p class="hint">You can change all of this in the room, any time.</p>
    </section>
  </div>
  <div>
    <section class="card stack" aria-labelledby="who-title">
      <h2 id="who-title">Who's coming?</h2>
      {#if studio.home?.friends.length}
        <fieldset>
          <legend>Invite friends now <span class="hint">(it shows on their dashboard)</span></legend>
          {#each studio.home.friends as friend (friend.id)}
            <label class="check"><input type="checkbox" value={friend.id} bind:group={invite} /><span>{friend.name}</span></label>
          {/each}
        </fieldset>
      {/if}
      <p class="hint">In the room you'll get a link to send anyone (text, email, chat), and you can invite more friends from there.</p>
      <p class="muted">With {Math.max(2, invite.length + 1)} artists: {plan.rounds} rounds of {turnLengthText(plan.turnSeconds)}, about {durationText(plan.totalSeconds)}.</p>
    </section>
    <div class="row"><button type="submit" class="btn" disabled={starting}>{starting ? 'Opening the room…' : 'Start the party'}</button></div>
  </div>
</form>
