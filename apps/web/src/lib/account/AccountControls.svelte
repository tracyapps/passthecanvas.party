<script lang="ts">
  import { onMount } from 'svelte';
  import { accountState, initializeAccount, openAccountSignIn, signOutAccount } from './account.svelte';
  onMount(() => { void initializeAccount(); });
</script>

<div class="account-controls">
  {#if !accountState.configured}
    <p>Sign-in is being connected. In the meantime, <a href="/try">make something in the practice studio</a>.</p>
  {:else if accountState.userId}
    <span>Signed in</span><button type="button" onclick={() => void signOutAccount()}>Sign out</button>
  {:else}
    <button type="button" disabled={!accountState.ready} onclick={() => void openAccountSignIn()}>{accountState.ready ? 'Sign in / create account' : 'Loading sign-in…'}</button>
  {/if}
  {#if accountState.error}<p role="status">{accountState.error}</p>{/if}
</div>

<style>
  .account-controls { display:flex; align-items:center; flex-wrap:wrap; gap:.5rem; font-size:.8rem; }
  a { color:inherit; text-underline-offset:3px; }
  button { min-height:44px; padding:.5rem .65rem; color:#f5ebd6; background:#241e16; border:1px solid #ad9871; border-radius:3px; }
  button { cursor:pointer; font:inherit; }
  button:disabled { opacity:.65; cursor:wait; }
  p { max-width:32rem; margin:.5rem 0; }
  :focus-visible { outline:3px solid #f5ed37; outline-offset:3px; }
</style>
