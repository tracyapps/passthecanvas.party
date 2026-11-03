<!--
  Your studio (/account/…): a small app inside the public site.
  The navigation is a plain list of links (they work without JavaScript
  routing too); pages swap in place and focus moves to each page's heading.
  Older links keep working: /account#invite=… and /account#profile=….
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { accountState, initializeAccount, manageAccount, openAccountSignIn, signOutAccount } from '../account.svelte';
  import { clearStudio, go, refresh, route, studio } from './studio.svelte';
  import PersonBadge from './PersonBadge.svelte';
  import Dashboard from './Dashboard.svelte';
  import ProfileView from './ProfileView.svelte';
  import ProfileEdit from './ProfileEdit.svelte';
  import FriendsPage from './FriendsPage.svelte';
  import SettingsPage from './SettingsPage.svelte';
  import PartyForm from './PartyForm.svelte';
  import CalendarPage from './CalendarPage.svelte';
  import HistoryPage from './HistoryPage.svelte';
  import DevicesPage from './DevicesPage.svelte';
  import './studio.scss';

  const NAV = [
    { href: '/account', label: 'Dashboard', match: (p: string) => p === '/account' },
    { href: '/account/profile', label: 'My profile', match: (p: string) => p.startsWith('/account/profile') },
    { href: '/account/avatars', label: 'Avatars', match: (p: string) => p.startsWith('/account/avatars') },
    { href: '/account/friends', label: 'Friends', match: (p: string) => p === '/account/friends' },
    { href: '/account/calendar', label: 'Calendar', match: (p: string) => p === '/account/calendar' },
    { href: '/account/parties/new', label: 'Plan a party', match: (p: string) => p.startsWith('/account/parties') },
    { href: '/account/history', label: 'History & art', match: (p: string) => p === '/account/history' },
    { href: '/account/devices', label: 'Camera & mic check', match: (p: string) => p === '/account/devices' },
    { href: '/account/settings', label: 'Settings', match: (p: string) => p === '/account/settings' }
  ];
  /** Pages that work without signing in. */
  const OPEN = ['/account/devices', '/account/avatars/new'];

  onMount(() => void initializeAccount());

  // Load (or forget) the studio whenever the signed-in person changes.
  let loadedFor: string | null = null;
  $effect(() => {
    const user = accountState.userId;
    if (user === loadedFor) return;
    loadedFor = user;
    clearStudio();
    if (user) void refresh();
  });

  let path = $derived(route.path);
  let profile = $derived(studio.home?.profile ?? null);
  let needsProfile = $derived(!!accountState.userId && !!studio.home && !profile);
  let menuOpen = $state(false);
  let partyId = $derived(path.match(/^\/account\/parties\/([0-9a-f-]{36})$/)?.[1] ?? null);
</script>

<div class="studio-app">
  {#if !accountState.userId && !OPEN.includes(path)}
    <section class="welcome paper">
      <p class="eyebrow">A place at the table</p>
      <h2>Come on in.</h2>
      <p>Save your studio, find your friends and put a party on the calendar. No webcam needed: your avatar is always welcome.</p>
      {#if !accountState.configured}
        <p>Sign-in is being connected. In the meantime, <a href="/try">make something in the practice studio</a>.</p>
      {:else}
        <button type="button" class="ink" disabled={!accountState.ready} onclick={() => void openAccountSignIn()}>{accountState.ready ? 'Sign in / create account' : 'Loading sign-in…'}</button>
      {/if}
      {#if location.hash.includes('invite=')}<p>You have a party invitation. Sign in to see it and RSVP.</p>{/if}
      {#if location.hash.includes('profile=')}<p>Sign in to open this shared profile.</p>{/if}
      <p class="small">Or, without an account: <a href="/account/avatars/new" onclick={(e) => go('/account/avatars/new', e)}>try the avatar maker</a> · <a href="/account/devices" onclick={(e) => go('/account/devices', e)}>check your camera and mic</a></p>
      {#if accountState.error}<p role="alert">{accountState.error}</p>{/if}
    </section>
  {:else}
    <div class="layout">
      <aside class="side">
        {#if profile}
          <a class="me" href="/account/profile" onclick={(e) => go('/account/profile', e)}>
            <PersonBadge person={profile} size={48} />
            <span><strong>{profile.name}</strong><span class="small">View profile</span></span>
          </a>
        {/if}
        <button type="button" class="menu-toggle" aria-expanded={menuOpen} aria-controls="studio-nav" onclick={() => (menuOpen = !menuOpen)}>Studio menu</button>
        <nav id="studio-nav" class:open={menuOpen} aria-label="Your studio">
          <ul>
            {#each NAV as item (item.href)}
              <li><a href={item.href} aria-current={item.match(path) ? 'page' : undefined} onclick={(e) => { menuOpen = false; go(item.href, e); }}>{item.label}</a></li>
            {/each}
          </ul>
          {#if accountState.userId}
            <div class="account-actions">
              <button type="button" onclick={manageAccount}>Sign-in & linked accounts</button>
              <button type="button" onclick={() => void signOutAccount()}>Sign out</button>
            </div>
          {/if}
        </nav>
      </aside>

      <div class="main" id="studio-page">
        <p class="status" role="status" aria-live="polite">{studio.loading && !studio.home ? 'Opening your studio…' : studio.notice}</p>
        {#if studio.error}<p class="error" role="alert">{studio.error}</p>{/if}
        {#if accountState.userId && !studio.home && !studio.loading}<button type="button" class="ink" onclick={() => void refresh()}>Try loading again</button>{/if}
        {#if needsProfile && !path.startsWith('/account/profile/edit') && !OPEN.includes(path)}
          <section class="paper nudge">
            <h1 tabindex="-1">Let's set up your profile.</h1>
            <p>A name and a color is all it takes. Friends, parties and avatars need a profile first.</p>
            <a class="ink" href="/account/profile/edit" onclick={(e) => go('/account/profile/edit', e)}>Set up my profile</a>
          </section>
        {:else if path === '/account/profile/edit'}
          <ProfileEdit />
        {:else if path === '/account/profile'}
          <ProfileView />
        {:else if path.startsWith('/account/avatars')}
          {#await import('./AvatarsPage.svelte')}
            <p>Getting the paper out…</p>
          {:then { default: AvatarsPage }}
            <AvatarsPage {path} />
          {/await}
        {:else if path === '/account/friends'}
          <FriendsPage />
        {:else if path === '/account/calendar'}
          <CalendarPage />
        {:else if path === '/account/parties/new' || partyId}
          {#key partyId}<PartyForm {partyId} />{/key}
        {:else if path === '/account/history'}
          <HistoryPage />
        {:else if path === '/account/devices'}
          <DevicesPage />
        {:else if path === '/account/settings'}
          <SettingsPage />
        {:else if location.hash.includes('profile=')}
          <ProfileView />
        {:else}
          <Dashboard />
        {/if}
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .studio-app {
    margin-top: 48px;
    color: var(--ink);
  }
  .layout {
    display: grid;
    grid-template-columns: 15rem minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }
  .side {
    position: sticky;
    top: 16px;
    display: grid;
    gap: 12px;
  }
  .me {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    text-decoration: none;
    > span {
      display: grid;
    }
  }
  .small {
    font-size: 14px;
  }
  nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }
  nav a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
    border-left: 4px solid transparent;
    text-decoration: none;
    font-weight: 700;
    font-size: 15px;
    &:hover {
      text-decoration: underline;
    }
    &[aria-current='page'] {
      border-left-color: var(--rust);
      background: #2a261e14;
    }
  }
  .account-actions {
    display: grid;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #8d785866;
    button {
      min-height: 44px;
      text-align: left;
      padding: 0 12px;
      background: transparent;
      color: inherit;
      border: 1px solid #8d7858;
      font-size: 14px;
    }
  }
  .menu-toggle {
    display: none;
  }
  .main {
    display: grid;
    gap: 24px;
    min-width: 0;
  }
  .status {
    min-height: 1.5em;
    margin: 0;
  }
  .error {
    border: 2px solid currentColor;
    padding: 12px 16px;
    margin: 0;
  }
  .welcome,
  .nudge {
    padding: 32px;
    max-width: 44rem;
    color: #2a261e;
  }
  .ink {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 0 20px;
    background: #2a261e;
    color: #fff6e5;
    border: 0;
    font-weight: 700;
    text-decoration: none;
  }
  @media (max-width: 860px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .side {
      position: static;
    }
    .menu-toggle {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 16px;
      background: #2a261e;
      color: #fff6e5;
      border: 0;
      font-weight: 700;
      justify-self: start;
    }
    nav:not(.open) {
      display: none;
    }
  }
</style>
