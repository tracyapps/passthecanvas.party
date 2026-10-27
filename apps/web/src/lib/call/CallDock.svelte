<!--
  The compact dark dock at the bottom: mic, camera, room/canvas, leave.
  Icon-only buttons carry aria-labels; toggles carry aria-pressed, and the
  off state shows a slash through the icon (never color alone).
-->
<script lang="ts">
  import type { Call } from './call.svelte';

  interface Props {
    call: Call;
    inRoom: boolean; // currently looking at the 360° room?
    onToggleRoom: () => void;
    onLeave: () => void;
  }
  let { call, inRoom, onToggleRoom, onLeave }: Props = $props();

  let videoReady = $derived(call.status === 'in-call');
</script>

<nav class="dock" aria-label="Call controls">
  {#if call.status === 'unavailable' || call.status === 'error'}
    <!-- Keep the honest reason visible; the party works without video. -->
    <p class="note" role="status">{call.note || 'Video is unavailable.'}</p>
  {:else if call.status === 'connecting'}
    <p class="note" role="status">Connecting video…</p>
  {:else}
    <button
      type="button"
      aria-pressed={call.micOn}
      aria-label={call.micOn ? 'Mute microphone' : 'Unmute microphone'}
      onclick={() => call.toggleMic()}
    >
      {#if call.micOn}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      {/if}
    </button>

    <button
      type="button"
      aria-pressed={call.camOn}
      aria-label={call.camOn ? 'Turn camera off' : 'Turn camera on'}
      onclick={() => call.toggleCam()}
    >
      {#if call.camOn}
        <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      {/if}
    </button>
  {/if}

  <button
    type="button"
    aria-pressed={inRoom}
    aria-label={inRoom ? 'Back to the canvas' : 'Room view'}
    onclick={onToggleRoom}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  </button>

  <button type="button" class="leave" aria-label="Leave the party" onclick={onLeave}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
  </button>
</nav>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .dock {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem;
    border-radius: 18px;
    background: rgb(24 16 11 / 0.92);
    border: 1px solid rgb(255 230 200 / 0.16);

    button {
      @include tap-target;
      display: grid;
      place-items: center;
      padding: 0 0.625rem;
      border: 0;
      border-radius: $radius-md;
      background: rgb(243 234 217 / 0.12);
      color: $cream;

      &:hover {
        background: rgb(243 234 217 / 0.2);
      }
      &:focus-visible {
        outline: 3px solid $focus;
        outline-offset: 2px;
      }

      svg {
        width: 22px;
        height: 22px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    }

    // Off toggles read as off: dimmer, and their icon already carries a slash.
    button[aria-pressed='false'] {
      color: $cream-muted;
      background: rgb(243 234 217 / 0.06);
    }

    .leave {
      color: #ff9c9c;
      &:hover {
        background: rgb(179 36 47 / 0.3);
      }
    }

    .note {
      margin: 0;
      padding: 0 0.75rem;
      min-height: $tap-min;
      display: flex;
      align-items: center;
      font-size: 0.875rem;
      color: $cream-muted;
      white-space: nowrap;
    }
  }
</style>
