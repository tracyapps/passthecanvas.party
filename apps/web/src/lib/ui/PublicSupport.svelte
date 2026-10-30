<script lang="ts">
  import { supportOptions } from './public-site-content';
  let status = $state('');

  async function copyHandle(provider: string, handle: string) {
    try {
      await navigator.clipboard.writeText(handle);
      status = `${provider} handle copied: ${handle}`;
    } catch {
      // The visible handle remains selectable if clipboard access is unavailable.
      status = `Could not copy automatically. Select and copy ${handle} instead.`;
    }
  }
</script>

<section class="support-options" aria-label="Optional ways to support the developer">
  <h2>A little support goes a long way.</h2>
  <p>Help keep the lights on, food in the cat bowl, or snacks on my desk. Always optional. Always appreciated.</p>
  <ul>
    {#each supportOptions as option}
      <li>
        <a href={option.url} target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">
          <span><strong>{option.name}</strong><span class="handle">{option.handle}</span></span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
          <span class="sr-only">(opens in a new tab)</span>
        </a>
        <button type="button" aria-label={`Copy ${option.name} handle ${option.handle}`} onclick={() => void copyHandle(option.name, option.handle)}>Copy</button>
      </li>
    {/each}
  </ul>
  <p class="payment-note">Choose any amount in the payment app. This site doesn’t process payments or see your payment details.</p>
  <p class="copy-status" role="status" aria-live="polite" aria-atomic="true">{status}</p>
</section>

<style>
  h2 { font-size: 28px; }
  p { font-size: 15px; }
  ul { list-style: none; margin: 24px 0 16px; padding: 0; }
  li { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; align-items: center; border-top: 1px solid #b8a580; padding: 10px 0; }
  li:last-child { border-bottom: 1px solid #b8a580; }
  a { display: flex; gap: 12px; align-items: center; justify-content: space-between; min-height: 56px; padding: 6px 8px; color: #35281e; text-decoration: none; }
  a:hover { background: #e9dcc1; }
  a>span:first-child { min-width: 0; }
  strong { display: block; font-size: 16px; }
  .handle { display: block; font-family: ui-monospace, monospace; font-size: 13px; overflow-wrap: anywhere; user-select: text; }
  svg { flex-shrink: 0; }
  button { min-width: 54px; min-height: 44px; padding: 8px; color: #35281e; background: #eee0c2; border: 1px solid #9e8963; }
  .payment-note { font-size: 13px; line-height: 1.6; }
  .copy-status { min-height: 24px; font-size: 13px; margin-bottom: 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; clip-path: inset(50%); overflow: hidden; }
</style>
