<!--
  Settings: who can find you, what email you get, and your sign-in.
  (Profile details are in Edit profile; camera and mic in the device check.)
-->
<script lang="ts">
  import PaletteLibrary from './PaletteLibrary.svelte';
  import { manageAccount } from '../account.svelte';
  import { act, go, studio } from './studio.svelte';
  import { AUTOSAVE_CHOICES, INTERFACE_SCALES } from '@ptc/shared';
  import { prefs, savePreferences } from '../../prefs.svelte';

  // Painting & display: these save (and apply) as soon as you change them.
  let prefsNote = $state('');
  async function changePrefs(next: Parameters<typeof savePreferences>[0], what: string) {
    prefsNote = '';
    try { await savePreferences(next); prefsNote = `${what} saved.`; }
    catch { prefsNote = `${what} changed on this device, but couldn't be saved to your account.`; }
  }
  const scaleName = (scale: number) => ({ 0.85: 'Smaller', 1: 'Normal', 1.15: 'Larger', 1.3: 'Even larger', 1.5: 'Largest' } as Record<number, string>)[scale] ?? `${Math.round(scale * 100)}%`;

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
    <section class="card stack" aria-labelledby="display-title">
      <h2 id="display-title">Painting & display</h2>
      <a class="btn quiet" href="/account/views" onclick={(event) => go('/account/views', event)}>Manage saved views</a>
      <label class="field">Auto-save practice pieces
        <select value={String(prefs.autosaveMinutes)} onchange={(e) => changePrefs({ autosaveMinutes: Number(e.currentTarget.value) }, 'Auto-save')}>
          {#each AUTOSAVE_CHOICES as minutes (minutes)}<option value={String(minutes)}>{minutes === 0 ? 'Off' : minutes === 1 ? 'Every minute' : `Every ${minutes} minutes`}</option>{/each}
        </select>
      </label>
      <p class="hint">Copies go to Auto-saves on your <a href="/account/practice" onclick={(e) => go('/account/practice', e)}>Practice table</a> page, never over a piece you saved.</p>
      <label class="field">Interface size
        <select value={String(prefs.interfaceScale)} onchange={(e) => changePrefs({ interfaceScale: Number(e.currentTarget.value) }, 'Interface size')}>
          {#each INTERFACE_SCALES as scale (scale)}<option value={String(scale)}>{scaleName(scale)} ({Math.round(scale * 100)}%)</option>{/each}
        </select>
      </label>
      <p class="hint">Makes buttons, panels and text bigger or smaller everywhere. On the painting table it sizes the controls (the canvas keeps its own zoom).</p>
      <label class="field">Tool view
        <select value={prefs.toolView} onchange={(e) => changePrefs({ toolView: e.currentTarget.value === 'tray' ? 'tray' : e.currentTarget.value === 'grid' ? 'grid' : 'cutouts' }, 'Tool view')}>
          <option value="cutouts">Default cutouts</option>
          <option value="grid">Freeform grid</option>
          <option value="tray">Toolbox tray</option>
        </select>
      </label>
      <p class="hint" role="status">{prefsNote}</p>
    </section>
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

<PaletteLibrary />
