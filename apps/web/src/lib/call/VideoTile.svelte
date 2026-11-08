<!--
  One guest around the table: their camera when it's on, an avatar card
  (initials on paper) when it's not. Avatar is an equal citizen, not a fallback
  look — same size, same seat.
-->
<script lang="ts">
  import { attachTrack } from './call.svelte';

  interface Props {
    name: string;
    track?: MediaStreamTrack | null;
    speaking?: boolean;
    painting?: boolean; // it's this guest's turn
    you?: boolean;
    host?: boolean;
    /** Their avatar picture (cutout or photo), shown when the camera is off. */
    look?: string | null;
    /** The color behind their initials. */
    color?: string;
    /** Their connection dropped; their seat is waiting for them. */
    away?: boolean;
  }
  let { name, track = null, speaking = false, painting = false, you = false, host = false, look = null, color, away = false }: Props = $props();

  let videoEl = $state<HTMLVideoElement>();

  // The track can appear (camera turns on) or disappear while mounted,
  // so attaching lives in an effect, not onMount.
  $effect(() => {
    if (videoEl && track) attachTrack(videoEl, track);
  });

  const initials = $derived(
    name
      .split(/\s+/)
      .map((word) => word[0] ?? '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
  // Spoken summary for screen readers, since the visuals are just pixels.
  const description = $derived(
    `${name}${you ? ' (you)' : ''}${host ? ', host' : ''}${painting ? ', painting now' : ''}${away ? ', away (reconnecting)' : track ? ', camera on' : ', avatar'}`
  );
</script>

<figure class="tile" class:speaking class:painting class:away aria-label={description}>
  <div class="frame">
    {#if track}
      <!-- muted: LiveKit plays everyone's audio separately, this element is picture only -->
      <video bind:this={videoEl} muted autoplay playsinline></video>
    {:else}
      {#if look}<img class="look" src={look} alt="" />{:else}<span class="avatar" aria-hidden="true" style:background={color} class:colored={!!color}>{initials}</span>{/if}
    {/if}
  </div>
  <figcaption>
    {name}{you ? ' (you)' : ''}{host ? ' (host)' : ''}{away ? ' (away)' : ''}
  </figcaption>
</figure>

<style lang="scss">
  @use '../../styles/tokens' as *;
  // Away: dimmed, and the caption says so (never the dimming alone).
  .tile.away .frame {
    opacity: 0.45;
  }

  .tile {
    margin: 0;
  }

  .frame {
    // Portrait 3:4, the same height the old 4:3 tile had (56.25% of the
    // width × 4/3 = 75% of the width); the camera is cropped evenly left/right.
    aspect-ratio: 3 / 4;
    width: 56.25%;
    margin-inline: auto;
    border-radius: $radius-sm;
    overflow: hidden;
    background: rgb(243 234 217 / 0.08);
    display: grid;
    place-items: center;

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  // Who's talking: a warm ring. Paired with the name below, so it's never color alone.
  .speaking .frame {
    box-shadow: 0 0 0 3px $focus;
  }

  .painting .frame {
    box-shadow: 0 0 0 3px $cadmium-orange;
  }

  .avatar {
    font-family: $font-display;
    font-weight: 800;
    font-size: 1.75rem;
    color: $walnut-900;
    width: 3.25rem;
    height: 3.25rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: $paper;
    box-shadow: inset 0 0 0 3px rgb(122 83 56 / 0.25);
  }

  .look {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .avatar.colored {
    color: #fff;
    box-shadow: none;
  }

  figcaption {
    margin-top: 0.375rem;
    font-size: 0.875rem;
    color: $cream-muted;

    .painting & {
      color: $cadmium-orange;
      font-weight: 700;
    }
  }
</style>
