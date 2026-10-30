<script lang="ts">
  import { onMount } from 'svelte';
  import type { CommunityHome, ScheduledParty, SharedParty, StudioProfile, StudioAvatar as Avatar } from '@ptc/shared';
  import { accountState, accountRequest, initializeAccount, manageAccount } from './account.svelte';
  import AccountControls from './AccountControls.svelte';
  import StudioAvatar from './StudioAvatar.svelte';
  import { partyCalendar } from './calendar';
  let home = $state<CommunityHome | null>(null);
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');
  let name = $state(''); let bio = $state(''); let share = $state(false); let allowRequests = $state(true); let emailInvites = $state(false); let emailReminders = $state(false);
  let avatar = $state<Avatar>({ color: 'teal', mark: 'brush' });
  let target = $state(''); let title = $state(''); let when = $state(''); let duration = $state(60);
  let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let partyLink = $state(''); let partyLinkId = $state(''); let inviteFriend = $state('');
  let shared = $state<SharedParty | null>(null); let visiting = $state<StudioProfile | null>(null);
  const context = new URLSearchParams(location.hash.slice(1));
  const invitationToken = context.get('invite') ?? '';
  const profileId = context.get('profile') ?? '';
  const colors: Avatar['color'][] = ['magenta', 'teal', 'violet', 'gold'];
  const marks: Avatar['mark'][] = ['brush', 'star', 'cat', 'swirl'];
  onMount(() => { void initializeAccount(); });
  $effect(() => {
    const user = accountState.userId;
    home = null; shared = null; visiting = null; partyLink = ''; notice = ''; error = '';
    name = ''; bio = ''; share = false; allowRequests = true; emailInvites = false; emailReminders = false; avatar = { color: 'teal', mark: 'brush' };
    if (user) void refresh();
  });
  async function refresh() {
    busy = true; error = '';
    try {
      const data = await accountRequest<CommunityHome>('community');
      home = data;
      if (data.profile) { name = data.profile.name; bio = data.profile.bio; share = data.profile.share; allowRequests = data.profile.allowRequests; emailInvites = data.profile.emailInvites; emailReminders = data.profile.emailReminders; avatar = { ...data.profile.avatar }; }
      if (invitationToken) shared = await accountRequest<SharedParty>(`community/invitation?token=${encodeURIComponent(invitationToken)}`);
      if (profileId) visiting = await accountRequest<StudioProfile>(`community/profile?id=${encodeURIComponent(profileId)}`);
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Your studio could not load.'; }
    finally { busy = false; }
  }
  async function act(path: string, value: unknown, message: string) {
    busy = true; error = ''; notice = '';
    try {
      await accountRequest(`community/${path}`, 'POST', value);
      await refresh(); notice = message;
    } catch (cause) { error = cause instanceof Error ? cause.message : 'That change could not be saved.'; }
    finally { busy = false; }
  }
  async function saveProfile(event: SubmitEvent) {
    event.preventDefault(); busy = true; error = ''; notice = '';
    try {
      await accountRequest('community/profile', 'PUT', { name, bio, avatar, share, allowRequests, emailInvites, emailReminders });
      await refresh(); notice = 'Profile saved.';
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Your profile could not be saved.'; }
    finally { busy = false; }
  }
  async function schedule(event: SubmitEvent) {
    event.preventDefault(); busy = true; error = ''; notice = '';
    try {
      const start = new Date(when);
      // Reject local wall-clock times which disappear during the daylight-saving jump.
      const pad = (n: number) => String(n).padStart(2, '0');
      const local = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
      if (local !== when) throw new Error('That local time does not exist. Choose another time.');
      const result = await accountRequest<{ id: string; token: string }>('community/parties', 'POST', { title, startsAt: start.toISOString(), timeZone, durationMinutes: duration });
      partyLinkId = result.id; partyLink = `${location.origin}/account#invite=${result.token}`;
      await refresh(); notice = 'Party scheduled. Save or share its invitation link below.'; title = ''; when = '';
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Your party could not be scheduled.'; }
    finally { busy = false; }
  }
  async function newLink(id: string) {
    busy = true; error = '';
    try {
      const result = await accountRequest<{ token: string }>('community/parties/link', 'POST', { party: id });
      partyLinkId = id; partyLink = `${location.origin}/account#invite=${result.token}`;
      notice = 'New invitation link ready. Any previous link for this party has stopped working.';
    } catch (cause) { error = cause instanceof Error ? cause.message : 'A link could not be created.'; }
    finally { busy = false; }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); notice = 'Link copied.'; }
    catch { error = 'Automatic copy is unavailable. Select and copy the visible link.'; }
  }
  function friendRequest(event: SubmitEvent) {
    event.preventDefault();
    let id = target.trim();
    try { id = new URLSearchParams(new URL(id).hash.slice(1)).get('profile') ?? id; } catch { /* A plain profile code is also supported. */ }
    void act('friends', { target: id }, 'Friend request sent. They choose whether to accept.');
  }
  function calendar(party: ScheduledParty) {
    const url = URL.createObjectURL(new Blob([partyCalendar(party)], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'pass-the-canvas-party.ics'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice = 'Calendar file downloaded. Import it in your calendar to enable its 15-minute reminder.';
  }
  function date(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
</script>

<div class="account-studio">
  <div class="account-entry paper">
    {#if !accountState.userId}<div class="welcome"><p class="eyebrow">A place at the table</p><h2>Come on in.</h2><p>Save your studio, find your friends and make room for your next art party.</p></div>{/if}
    <AccountControls />
    {#if accountState.userId}<button type="button" onclick={manageAccount}>Sign-in & linked accounts</button><button type="button" disabled={busy} onclick={() => void refresh()}>Refresh studio</button>
    {:else}<p class="hint">No webcam needed. Your studio avatar is always welcome.</p>{/if}
    {#if invitationToken && !accountState.userId}<p>You have a party invitation. Sign in to view it and RSVP.</p>{/if}
    {#if profileId && !accountState.userId}<p>Sign in to open this shared profile.</p>{/if}
  </div>
  <p class="studio-status" role="status" aria-live="polite">{busy ? 'Opening your studio…' : notice}</p>
  {#if error}<p class="studio-error" role="alert">{error}</p>{/if}
  {#if accountState.userId && !home && !busy}<button type="button" onclick={() => void refresh()}>Try loading again</button>{/if}

  {#if shared}<section class="invitation-paper paper"><p class="eyebrow">You’re invited</p><h2>{shared.title}</h2><p>Hosted by {shared.hostName} · {date(shared.startsAt)} in your time zone.<br/>{shared.durationMinutes} minutes · host’s time zone: {shared.timeZone}</p><button type="button" disabled={busy || !home?.profile} onclick={() => void act('parties/join', { token: invitationToken }, 'You’re on the guest list.')}>Accept invitation</button>{#if !home?.profile}<p>Save your profile below before accepting.</p>{/if}<p>Planning is open; the multiplayer painting party is still being connected.</p></section>{/if}
  {#if visiting}<section class="invitation-paper paper"><div class="person-avatar"><StudioAvatar avatar={visiting.avatar} name={`${visiting.name}’s avatar`} /></div><h2>{visiting.name}</h2><p>{visiting.bio}</p>{#if visiting.id !== home?.profile?.id}<button type="button" disabled={busy || !home?.profile || !visiting.allowRequests || !visiting.share} onclick={() => void act('friends', { target: visiting!.id }, 'Friend request sent.')}>Add friend</button>{/if}<p>Paintings only appear here when their owners deliberately share them. Saved artwork is still being connected.</p></section>{/if}

  <details class="profile-fold paper" open={!!accountState.userId}>
    <summary>{accountState.userId ? 'Your studio profile' : 'Try a studio avatar'}</summary>
  <form class="profile-paper" onsubmit={saveProfile}>
    <div><p class="eyebrow">Come as you are</p><h2>{home?.profile ? 'Your studio profile.' : 'Make yourself at home.'}</h2><p>Your avatar can always take your place on camera. No selfie or webcam needed.</p></div>
    <div class="avatar-preview"><StudioAvatar {avatar} name="Your avatar preview" /></div>
    {#if accountState.userId}<label>Display name<input maxlength="40" required bind:value={name} autocomplete="nickname" /></label>
    <label>A little about you<textarea maxlength="280" rows="3" bind:value={bio}></textarea></label>{/if}
    <fieldset><legend>Avatar color</legend><div class="avatar-options">{#each colors as color}<button type="button" class:selected={avatar.color === color} aria-pressed={avatar.color === color} onclick={() => avatar = { ...avatar, color }}>{color}</button>{/each}</div></fieldset>
    <fieldset><legend>Avatar mark</legend><div class="avatar-options">{#each marks as mark}<button type="button" class:selected={avatar.mark === mark} aria-pressed={avatar.mark === mark} onclick={() => avatar = { ...avatar, mark }}>{mark}</button>{/each}</div></fieldset>
    {#if accountState.userId}<label class="check"><input type="checkbox" bind:checked={share} />Let signed-in people open my profile with its link. Friends and people I request can see my profile too.</label>
    <label class="check"><input type="checkbox" bind:checked={allowRequests} />Allow friend requests through my shared profile link.</label>
    <label class="check"><input type="checkbox" bind:checked={emailInvites} />Email me party invitations from connected friends, when delivery is enabled.</label>
    <label class="check"><input type="checkbox" bind:checked={emailReminders} />Email me a reminder 15 minutes before parties I host or accept, when delivery is enabled.</label>
    <button type="submit" disabled={busy || !accountState.userId || !home}>Save profile</button>{/if}
    {#if !accountState.userId}<p class="hint">This is a preview until you sign in. Nothing here is uploaded or saved.</p>{/if}
    {#if home?.profile}<div class="profile-share"><label>Your profile link<input readonly value={`${location.origin}/account#profile=${home.profile.id}`} /></label><button type="button" disabled={!home.profile.share} onclick={() => void copy(`${location.origin}/account#profile=${home!.profile!.id}`)}>Copy profile link</button>{#if !home.profile.share}<p>Save with profile sharing on before sharing this link.</p>{/if}</div>{/if}
  </form>
  </details>

  {#if home?.profile}
    <section class="friends-paper paper"><p class="eyebrow">Your kind of people</p><h2>Friends, with paint.</h2>
      <form onsubmit={friendRequest}><label>Friend’s profile link or code<input bind:value={target} required /></label><button type="submit" disabled={busy}>Send friend request</button></form>
      {#if home.incoming.length}<h3>They’d like to connect</h3>{#each home.incoming as person}<div class="person"><div class="person-avatar"><StudioAvatar avatar={person.avatar} /></div><a href={`/account#profile=${person.id}`} onclick={() => { location.href = `/account#profile=${person.id}`; location.reload(); }}>{person.name}</a><button type="button" disabled={busy} onclick={() => void act('friends/respond', { target: person.id, action: 'accept' }, 'Friend added.')}>Accept</button><button type="button" disabled={busy} onclick={() => void act('friends/respond', { target: person.id, action: 'decline' }, 'Request declined. They cannot send it again.')}>Decline</button></div>{/each}{/if}
      {#if home.friends.length}{#each home.friends as person}<div class="person"><div class="person-avatar"><StudioAvatar avatar={person.avatar} /></div><a href={`/account#profile=${person.id}`} onclick={() => { location.href = `/account#profile=${person.id}`; location.reload(); }}>{person.name}</a><button type="button" disabled={busy} onclick={() => void act('friends/respond', { target: person.id, action: 'remove' }, 'Friend connection removed.')}>Remove connection</button></div>{/each}{:else}<p>No friends connected yet. Share a profile link to find each other.</p>{/if}
      {#if home.outgoing.length}<p>Waiting for a reply: {home.outgoing.map(p => p.name).join(', ')}.</p>{/if}
    </section>

    <section class="schedule-paper paper"><p class="eyebrow">Make room for a little play</p><h2>Put a party on the calendar.</h2><p>Plan a date and invite your people now. Live multiplayer hosting is still in development.</p>
      <form onsubmit={schedule}><label>Party name<input maxlength="80" required bind:value={title} /></label><label>When<input type="datetime-local" required bind:value={when} /></label><p>Times use your device’s time zone: {timeZone}. Invitations display each guest’s local time.</p><label>Party length<select bind:value={duration}><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={90}>90 minutes</option><option value={120}>2 hours</option></select></label><button type="submit" disabled={busy}>Schedule party</button></form>
      {#if partyLink}<div class="share-party"><label>Invitation link<input readonly value={partyLink} /></label><button type="button" onclick={() => void copy(partyLink)}>Copy invitation</button><a href={`mailto:?subject=${encodeURIComponent('Come make something with me')}&body=${encodeURIComponent(`You’re invited to an art party! Open the invitation for the date and details:\n${partyLink}\n\nParty planning is open; live multiplayer is still in development.`)}`}>Compose an email invitation</a><p>Opens your own email app. This site has not sent an email.</p><label>Invite a connected friend<select bind:value={inviteFriend}><option value="">Choose a friend</option>{#each home.friends as friend}<option value={friend.id}>{friend.name}</option>{/each}</select></label><button type="button" disabled={busy || !inviteFriend} onclick={() => void act('parties/invite', { party: partyLinkId, friend: inviteFriend }, 'Invitation added to their studio.')}>Send account invitation</button></div>{/if}
    </section>
    <section class="parties-paper paper"><h2>Your party plans.</h2>{#if !home.parties.length}<p>No parties on your calendar yet. Your next great idea has room.</p>{/if}{#each home.parties as party}<article class="party-plan"><h3>{party.title}</h3>{#each home.mail.filter(mail => mail.partyId === party.id) as mail}<p>{mail.kind === 'reminder' ? 'Email reminder' : 'Email invitation'}: {({pending:'Queued',processing:'Sending',sent:'Accepted by email provider',skipped:'Not sent',failed:'Needs delivery review'} as Record<string,string>)[mail.state] ?? 'Unavailable'}</p>{/each}<p>{date(party.startsAt)} · {party.durationMinutes} minutes · {party.hosting ? 'You’re hosting' : `Hosted by ${party.hostName}`}</p>{#if party.cancelled}<p>Cancelled</p>{:else}<p>{party.hosting ? 'Share an invitation to gather your people.' : `Your RSVP: ${party.response === 'pending' ? 'Awaiting your reply' : party.response === 'yes' ? 'Going' : 'Not going'}`}</p>{#if new Date(party.startsAt).getTime() > Date.now()}<div class="party-actions"><button type="button" onclick={() => calendar(party)}>Calendar + reminder</button>{#if party.hosting}<button type="button" disabled={busy} onclick={() => void newLink(party.id)}>Create / replace invitation link</button><button type="button" disabled={busy} onclick={() => void act('parties/cancel', { party: party.id }, 'Party cancelled. Its invitation link no longer works.')}>Cancel party</button>{:else}<button type="button" disabled={busy} onclick={() => void act('parties/respond', { party: party.id, response: 'yes' }, 'RSVP saved: going.')}>Going</button><button type="button" disabled={busy} onclick={() => void act('parties/respond', { party: party.id, response: 'no' }, 'RSVP saved: not going.')}>Not going</button>{/if}</div>{/if}{/if}</article>{/each}<p class="hint">Calendar reminders are handled by your calendar after import. Email reminders require your profile opt-in and configured delivery. If a party changes, replace its calendar entry.</p></section>
    <section class="history-paper paper"><p class="eyebrow">The things you made together</p><h2>Your painting history.</h2>{#if !home.history.length}<p>No completed parties or saved paintings yet. After verified party history is connected, your recaps will live here.</p>{:else}{#each home.history as party}<article><h3>{party.title}</h3><p>{date(party.endedAt)} · {party.artworkCount} paintings</p></article>{/each}{/if}<p>The planned recap hangs the artwork in the room and lists the people who were there—with profile links, Add friend and paintings they’ve chosen to share. No webcam photos are saved.</p></section>
  {/if}
</div>

<style>
  .account-studio { margin-top: 48px; display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:32px; align-items:start; }
  .paper { padding:30px; color:#2a261e; }
  .account-entry,.studio-status,.studio-error,.invitation-paper,.profile-fold,.history-paper { grid-column:1/-1; }
  .account-entry { display:flex; flex-wrap:wrap; align-items:center; gap:12px; }
  .welcome { flex-basis:100%; max-width:42rem; }
  .welcome h2 { margin:.25rem 0 1rem; }
  .profile-fold summary { cursor:pointer; min-height:44px; font-weight:700; padding:10px 0; }
  .profile-fold[open] summary { margin-bottom:20px; }
  summary:focus-visible { outline:3px solid #156879; outline-offset:4px; }
  .account-entry p { flex-basis:100%; margin:0; }
  .studio-status { min-height:26px; margin:0; } .studio-error { border:2px solid currentColor; padding:16px; }
  .profile-paper { display:grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap:20px 32px; }
  h2 { font-size:clamp(27px,3vw,40px); } h3 { font-size:24px; letter-spacing:-.02em; }
  .avatar-preview { width:150px; justify-self:center; transform:rotate(4deg); }
  label { display:flex; flex-direction:column; gap:6px; font-weight:700; font-size:15px; }
  input,textarea,select { width:100%; min-width:0; min-height:44px; font:inherit; color:#2a261e; background:#fff9ed; border:1px solid #8d7858; padding:10px; }
  textarea { resize:vertical; }
  fieldset { margin:0; padding:16px; min-width:0; border:1px solid #8d7858; }
  legend { font-size:14px; padding:0 6px; } .avatar-options { display:flex; gap:8px; flex-wrap:wrap; }
  button { min-height:44px; padding:10px 14px; font:inherit; font-size:14px; background:#30291f; color:#fff3d8; border:2px solid #30291f; cursor:pointer; }
  button.selected { color:#30291f; background:#ffda57; text-decoration:underline; text-underline-offset:5px; }
  button:disabled { opacity:.55; cursor:default; }
  .check { grid-column:1/-1; display:flex; flex-direction:row; align-items:center; font-weight:400; }
  .check input { flex:0 0 24px; width:24px; min-height:44px; accent-color:#ad175b; }
  .hint { font-size:14px; } .profile-share { grid-column:1/-1; }
  form:not(.profile-paper) { display:grid; gap:16px; } form p { margin:0; font-size:14px; }
  .person { display:flex; align-items:center; gap:12px; flex-wrap:wrap; border-top:1px solid #ad9874; padding:16px 0; }
  .person-avatar { width:64px; flex-shrink:0; } .person a { flex:1; overflow-wrap:anywhere; }
  .share-party { margin-top:24px; border:2px solid #94794c; padding:16px; display:grid; gap:12px; }
  a { display:inline-flex; min-height:44px; align-items:center; color:inherit; overflow-wrap:anywhere; }
  .party-plan { padding:20px 0; border-top:1px solid #ad9874; } .party-actions { display:flex; flex-wrap:wrap; gap:10px; }
  :is(input,textarea,select,button,a):focus-visible { outline:3px solid #156879; outline-offset:4px; }
  @media(max-width:800px) { .account-studio,.profile-paper { grid-template-columns:minmax(0,1fr); } .paper { padding:24px 20px; } .avatar-preview { grid-row:2; } }
</style>
