<!--
  Plan a party (/account/parties/new) or edit one you host (/account/parties/<id>).
  Timing has two ways to work, and the preview shows how it plays out:
  - a set party length: turns share the time (after hellos and the wrap-up),
  - a set turn length: the party runs as long as everyone's turns take.
  The host can change these again during the party; everyone's view follows.
-->
<script lang="ts">
  import { DEFAULT_PARTY_SETTINGS, durationText, planTiming, TURN_LENGTHS, turnLengthText, type PartySettings, type TimingMode } from '@ptc/shared';
  import { accountRequest } from '../account.svelte';
  import { act, go, refresh, studio, when } from './studio.svelte';
  import PartyCard from './PartyCard.svelte';

  let { partyId }: { partyId: string | null } = $props();
  // svelte-ignore state_referenced_locally — the page re-mounts per party ({#key})
  const existing = partyId ? studio.home?.parties.find((p) => p.id === partyId && p.hosting) ?? null : null;
  const start = existing ? new Date(existing.startsAt) : null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let title = $state(existing?.title ?? '');
  let whenText = $state(start ? local(start) : '');
  let settings = $state<PartySettings>(structuredClone($state.snapshot(existing?.settings) ?? DEFAULT_PARTY_SETTINGS));
  let artists = $state(Math.min(6, settings.maxGuests));
  let saving = $state(false);
  // svelte-ignore state_referenced_locally — the page re-mounts per party ({#key})
  let inviteLink = $state(sessionStorageGet(partyId));
  let inviteFriend = $state('');

  function sessionStorageGet(id: string | null) {
    try {
      return id ? sessionStorage.getItem(`ptc-invite-${id}`) ?? '' : '';
    } catch {
      return '';
    }
  }

  let plan = $derived(planTiming(settings.timing, Math.min(artists, settings.maxGuests)));
  let durationMinutes = $derived(Math.max(15, Math.min(240, settings.timing.mode === 'party' ? settings.timing.partyMinutes : Math.ceil(planTiming(settings.timing, settings.maxGuests).totalSeconds / 60))));
  $effect(() => {
    if (artists > settings.maxGuests) artists = settings.maxGuests;
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    studio.error = '';
    const startDate = new Date(whenText);
    // Reject local wall-clock times which disappear during a daylight-saving jump.
    if (Number.isNaN(startDate.getTime()) || local(startDate) !== whenText) return void (studio.error = 'That local time does not exist. Choose another time.');
    const body = { title: title.trim(), startsAt: startDate.toISOString(), timeZone, durationMinutes, settings: $state.snapshot(settings) };
    saving = true;
    try {
      if (existing) {
        await accountRequest('community/parties/update', 'POST', { party: existing.id, ...body });
        await refresh();
        studio.notice = 'Party saved. Guests see the changes on their calendar page.';
      } else {
        const result = await accountRequest<{ id: string; token: string }>('community/parties', 'POST', body);
        const link = `${location.origin}/account#invite=${result.token}`;
        try { sessionStorage.setItem(`ptc-invite-${result.id}`, link); } catch { /* shown below anyway */ }
        await refresh();
        go(`/account/parties/${result.id}`);
        studio.notice = 'Party planned. Share the invitation link below.';
      }
    } catch (cause) {
      studio.error = cause instanceof Error ? cause.message : 'The party could not be saved.';
    } finally {
      saving = false;
    }
  }

  async function newLink() {
    if (!existing) return;
    const result = await act<{ token: string }>('parties/link', { party: existing.id }, 'New invitation link ready. The old link stopped working.');
    if (result) {
      inviteLink = `${location.origin}/account#invite=${result.token}`;
      try { sessionStorage.setItem(`ptc-invite-${existing.id}`, inviteLink); } catch { /* fine */ }
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      studio.notice = 'Copied.';
    } catch {
      studio.notice = 'Copying was blocked. Select the link and copy it yourself.';
    }
  }
  const setMode = (mode: TimingMode) => (settings.timing.mode = mode);
</script>

<header class="page-head">
  <div>
    <p class="eyebrow">{existing ? 'Your party' : 'Make room for a little play'}</p>
    <h1 tabindex="-1">{existing ? existing.title : 'Plan a party'}</h1>
    {#if existing}<p>{when(existing.startsAt)}</p>{/if}
  </div>
  <a class="btn quiet" href="/account/calendar" onclick={(e) => go('/account/calendar', e)}>Calendar</a>
</header>

{#if partyId && !existing}
  <p class="card">This party isn't one you host, or it's no longer on your calendar.</p>
{:else}
<div class="columns">
  <form class="stack" onsubmit={save}>
    <section class="card stack" aria-labelledby="details-title">
      <h2 id="details-title">The details</h2>
      <label class="field">Party name<input maxlength="80" required bind:value={title} /></label>
      <label class="field">Anything guests should know <span class="hint">A theme, what to bring, the vibe. Optional.</span><textarea maxlength="600" rows="3" bind:value={settings.description}></textarea></label>
      <div class="split">
        <label class="field">When<input type="datetime-local" required bind:value={whenText} /><span class="hint">Your time zone: {timeZone}. Guests see their own local time.</span></label>
        <label class="field">Most artists<input type="number" min="2" max="24" required bind:value={settings.maxGuests} /><span class="hint">Up to 24 seats in the studio.</span></label>
      </div>
    </section>

    <section class="card stack" aria-labelledby="timing-title">
      <h2 id="timing-title">Timing</h2>
      <fieldset>
        <legend>How should time work?</legend>
        <label class="check"><input type="radio" name="mode" checked={settings.timing.mode === 'party'} onchange={() => setMode('party')} /><span><strong>Set the party length.</strong> <span class="hint">Turns share the time, so more artists means shorter turns.</span></span></label>
        <label class="check"><input type="radio" name="mode" checked={settings.timing.mode === 'turn'} onchange={() => setMode('turn')} /><span><strong>Set the turn length.</strong> <span class="hint">Everyone gets the same time per canvas; the party runs as long as it takes.</span></span></label>
      </fieldset>
      <div class="split">
        {#if settings.timing.mode === 'party'}
          <label class="field">Party length<select bind:value={settings.timing.partyMinutes}>{#each [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240] as m (m)}<option value={m}>{durationText(m * 60)}</option>{/each}</select></label>
        {:else}
          <label class="field">Each turn<select bind:value={settings.timing.turnSeconds}>{#each [...TURN_LENGTHS, 240, 420, 600].sort((a, b) => a - b) as s (s)}<option value={s}>{turnLengthText(s)}</option>{/each}</select></label>
        {/if}
        <label class="field">Hellos & instructions<select bind:value={settings.timing.introMinutes}>{#each [0, 5, 10, 15, 20] as m (m)}<option value={m}>{m ? `${m} min` : 'None'}</option>{/each}</select></label>
        <label class="field">Times around the circle<select value={settings.timing.laps ?? 1} onchange={(e) => (settings.timing.laps = Number(e.currentTarget.value))}>{#each [1, 2, 3, 4, 5] as n (n)}<option value={n}>{n === 1 ? 'Once (everyone paints every canvas once)' : `${n} times`}</option>{/each}</select></label>
        <label class="field">Wrap-up & reveal<select bind:value={settings.timing.wrapMinutes}>{#each [0, 5, 10, 15, 20, 30] as m (m)}<option value={m}>{m ? `${m} min` : 'None'}</option>{/each}</select></label>
      </div>
      <div class="preview" aria-live="polite">
        <label class="field">Preview with <output>{artists}</output> artists<input type="range" min="2" max={settings.maxGuests} bind:value={artists} /></label>
        <p><strong>{plan.rounds} rounds</strong> (everyone paints every canvas{(settings.timing.laps ?? 1) > 1 ? ` ${settings.timing.laps} times` : ''}, and each canvas goes back to its owner for the last layer) of <strong>{turnLengthText(plan.turnSeconds)}</strong>.</p>
        <p>About {durationText(plan.paintingSeconds)} of painting, {durationText(plan.totalSeconds)} in all.</p>
        {#if plan.tooShort}<p class="warn" role="alert">That's too short for {artists} artists: turns would be under 20 seconds. Make the party longer or plan for fewer artists.</p>{/if}
        <p class="hint">You can change this during the party; everyone's timer follows.</p>
      </div>
    </section>

    <section class="card stack" aria-labelledby="order-title">
      <h2 id="order-title">Passing order</h2>
      <div class="choices">
        <label><input type="radio" name="order" value="seats" bind:group={settings.orderMode} />Clockwise by seat</label>
        <label><input type="radio" name="order" value="random" bind:group={settings.orderMode} />A random circle</label>
        <label><input type="radio" name="order" value="custom" bind:group={settings.orderMode} />I'll arrange it in the room</label>
      </div>
      <p class="hint">Either way, every artist paints on every canvas once.</p>
    </section>

    <div class="row">
      <button type="submit" class="btn" disabled={saving || plan.tooShort}>{saving ? 'Saving…' : existing ? 'Save changes' : 'Plan this party'}</button>
      {#if existing}<button type="button" class="btn danger" onclick={() => void act('parties/cancel', { party: existing.id }, 'Party cancelled. Its invitation link no longer works.').then(() => go('/account/calendar'))}>Cancel party</button>{/if}
    </div>
  </form>

  <div>
    {#if existing}
      <PartyCard party={studio.home?.parties.find((p) => p.id === existing.id) ?? existing} />
      <section class="card stack" aria-labelledby="invite-title">
        <h2 id="invite-title">Invite people</h2>
        {#if inviteLink}
          <label class="field">Invitation link<input readonly value={inviteLink} onfocus={(e) => e.currentTarget.select()} /></label>
          <div class="row">
            <button type="button" class="btn small" onclick={() => copy(inviteLink)}>Copy link</button>
            <a class="btn small quiet" href={`mailto:?subject=${encodeURIComponent(`Come paint with me: ${existing.title}`)}&body=${encodeURIComponent(`You're invited to an art party! Open the invitation for the date and details:\n${inviteLink}`)}`}>Write an email</a>
          </div>
          <p class="hint">The email opens in your own email app. Anyone with the link can RSVP.</p>
        {:else}
          <p>For privacy, invitation links are only shown once. Make a new one to share (the old one stops working).</p>
        {/if}
        <button type="button" class="btn small quiet" onclick={newLink}>{inviteLink ? 'Replace link' : 'Make an invitation link'}</button>
        {#if studio.home?.friends.length}
          <label class="field">Invite a friend<select bind:value={inviteFriend}><option value="">Choose a friend</option>{#each studio.home.friends as friend (friend.id)}<option value={friend.id}>{friend.name}</option>{/each}</select></label>
          <button type="button" class="btn small" disabled={!inviteFriend} onclick={() => void act('parties/invite', { party: existing.id, friend: inviteFriend }, 'Invitation added to their studio.').then(() => (inviteFriend = ''))}>Send invitation</button>
        {/if}
      </section>
    {:else}
      <section class="card">
        <h2>How it works</h2>
        <p>Everyone starts their own canvas. Each round, canvases pass one seat to the left, and the last round brings each canvas home to its owner.</p>
        <p class="hint">After you plan it, you'll get an invitation link and can invite friends from your studio.</p>
      </section>
    {/if}
  </div>
</div>
{/if}

<style>
  .preview { padding: 14px 16px; background: #fff4cf; border: 1px solid #c98a00; }
  .preview p { margin: 6px 0 0; }
  .warn { font-weight: 700; color: #8f1238; }
  input[type='range'] { width: 100%; min-height: 44px; accent-color: #ad175b; }
</style>
