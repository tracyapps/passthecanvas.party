<script lang="ts">
  import { onMount } from 'svelte';
  import { accountState, initializeAccount, openAccountSignIn, signOutAccount } from './account.svelte';
  onMount(() => { void initializeAccount(); });
</script>

<div class="account-controls">
  {#if !accountState.configured}
    <details><summary>Account sign-in not configured</summary><p>Local saved views work on this browser. Account saves need Clerk and the account server configured.</p></details>
  {:else if accountState.userId}
    <span>Signed in</span><button type="button" onclick={() => void signOutAccount()}>Sign out</button>
  {:else}
    <button type="button" disabled={!accountState.ready} onclick={() => void openAccountSignIn()}>{accountState.ready ? 'Sign in / create account' : 'Loading sign-in…'}</button>
  {/if}
  {#if accountState.error}<p role="status">{accountState.error}</p>{/if}
</div>

<style>
  .account-controls { display:flex; align-items:center; flex-wrap:wrap; gap:.5rem; font-size:.8rem; }
  button,summary { min-height:44px; padding:.5rem .65rem; color:#f5ebd6; background:#241e16; border:1px solid #ad9871; border-radius:3px; }
  button { cursor:pointer; font:inherit; }
  button:disabled { opacity:.65; cursor:wait; }
  summary { display:flex; align-items:center; cursor:pointer; }
  details p,p[role=status] { max-width:32rem; margin:.5rem 0; }
  :focus-visible { outline:3px solid #f5ed37; outline-offset:3px; }
</style>
