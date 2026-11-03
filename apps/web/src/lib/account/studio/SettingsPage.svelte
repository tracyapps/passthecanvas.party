<!--
  Settings: who can find you, what email you get, and your sign-in.
  (Profile details are in Edit profile; camera and mic in the device check.)
-->
<script lang="ts">
  import { manageAccount } from '../account.svelte';
  import { act, go, studio } from './studio.svelte';

  const profile = studio.home?.profile;
  let share = $state(profile?.share ?? false);
  let allowRequests = $state(profile?.allowRequests ?? true);
  let emailInvites = $state(profile?.emailInvites ?? false);
  let emailReminders = $state(profile?.emailReminders ?? false);

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!profile) return;
    void act('profile', { name: profile.name, bio: profile.bio, avatar: profile.avatar, links: profile.links, share, allowRequests, emailInvites, emailReminders }, 'Settings saved.', 'PUT');
  }
</script>

<header class="page-head">
  <div><p class="eyebrow">Your studio</p><h1 tabindex="-1">Settings</h1></div>
</header>

<form class="columns" onsubmit={save}>
  <div>
    <section class="card" aria-labelledby="privacy-title">
      <h2 id="privacy-title">Privacy</h2>
      <label class="check"><input type="checkbox" bind:checked={share} /><span>Let signed-in people open my profile with its link. <span class="hint">Friends and people I've sent requests to can always see it.</span></span></label>
      <label class="check"><input type="checkbox" bind:checked={allowRequests} /><span>Allow friend requests through my profile link.</span></label>
    </section>
    <section class="card" aria-labelledby="email-title">
      <h2 id="email-title">Notifications</h2>
      <p class="hint">Party invitations and RSVPs always show on your dashboard. Email is extra, and only once email delivery is switched on for the studio.</p>
      <label class="check"><input type="checkbox" bind:checked={emailInvites} /><span>Email me party invitations from my friends.</span></label>
      <label class="check"><input type="checkbox" bind:checked={emailReminders} /><span>Email me a reminder 15 minutes before parties I host or said yes to.</span></label>
      <p class="hint">Calendar reminders come from your own calendar app once you add a party or subscribe on the <a href="/account/calendar" onclick={(e) => go('/account/calendar', e)}>Calendar</a> page.</p>
    </section>
    <div class="row"><button type="submit" class="btn" disabled={!profile}>Save settings</button></div>
  </div>
  <div>
    <section class="card" aria-labelledby="signin-title">
      <h2 id="signin-title">Sign-in</h2>
      <p>Your email, password and linked accounts (like Discord sign-in) are managed by our sign-in provider. We never show your email on your profile.</p>
      <button type="button" class="btn quiet" onclick={manageAccount}>Sign-in & linked accounts</button>
    </section>
    <section class="card" aria-labelledby="devices-title">
      <h2 id="devices-title">Camera & microphone</h2>
      <p>Pick your camera, mic and speakers once and every party uses them.</p>
      <a class="btn quiet" href="/account/devices" onclick={(e) => go('/account/devices', e)}>Camera & mic check</a>
    </section>
  </div>
</form>
