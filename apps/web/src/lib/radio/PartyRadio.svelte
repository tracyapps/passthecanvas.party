<!--
  The party radio. The host searches the Radio Browser directory and puts a
  station on for everyone; the party server only shares WHICH station is on.
  Each guest's own browser plays the stream (nothing is relayed). It plays
  for everyone by default: the "Join the party" click already counts as the
  gesture browsers require before sound. If a browser still refuses, the
  panel says so and offers Listen. Volume and mute are per guest, starting
  low.

  The <audio> element lives outside the panel, so closing the panel keeps
  the music going.
-->
<script lang="ts">
  import type { PartyConnection } from '../party/connection.svelte';
  import StudioPanel from '../canvas/StudioPanel.svelte';
  import { MOODS, searchStations, type Station } from './radioBrowser';

  let { party, open, compact = false, onclose }: { party: PartyConnection; open: boolean; compact?: boolean; onclose: () => void } = $props();

  let audio: HTMLAudioElement;
  // On by default; "Mute for me" turns it off for this guest only.
  let listening = $state(true);
  let blocked = $state(false);
  let volume = $state(0.3);
  let query = $state('');
  let results = $state<Station[]>([]);
  let searching = $state(false);
  let message = $state('');
  let playError = $state('');

  let radio = $derived(party.state?.radio ?? null);
  let isHost = $derived(party.me?.isHost ?? false);
  let onAir = $derived(!!radio?.playing);

  // Follow the host: a new station, or a stop, changes what this browser plays.
  $effect(() => {
    if (!audio) return;
    const url = onAir ? radio!.streamUrl : '';
    if (!url || !listening) {
      audio.pause();
      playError = '';
      if (!url) audio.removeAttribute('src');
      return;
    }
    if (audio.src !== url) audio.src = url;
    playError = '';
    blocked = false;
    audio.play().catch((error: unknown) => {
      // NotAllowedError = the browser wants a click first; anything else = the stream failed.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        blocked = true;
        listening = false;
      } else playError = 'This station would not play here. The host can try another one.';
    });
  });
  $effect(() => {
    if (audio) audio.volume = volume;
  });

  async function search(text: string, byTag: boolean) {
    searching = true;
    message = '';
    try {
      results = await searchStations(text, byTag);
      message = results.length ? `${results.length} ${results.length === 1 ? 'station' : 'stations'} found.` : 'No playable stations found. Try another word.';
    } catch {
      results = [];
      message = 'The radio directory could not be reached. Try again in a moment.';
    } finally {
      searching = false;
    }
  }

  function putOn(station: Station) {
    party.send({ type: 'setRadio', stationName: station.name, streamUrl: station.streamUrl, playing: true });
    // The host pressed a button, so their own browser may start playing too.
    listening = true;
  }

  function stopForEveryone() {
    if (!radio) return;
    party.send({ type: 'setRadio', stationName: radio.stationName, streamUrl: radio.streamUrl, playing: false });
  }
</script>

<audio bind:this={audio} preload="none" onerror={() => { if (listening && onAir) playError = 'This station stopped streaming.'; }}></audio>

{#if open}
  <StudioPanel title="Party radio" label="party radio" dock="radio" flow={compact} {onclose}>
    <div class="radio">
      <!-- The tube radio: a walnut cabinet drawn in CSS. The real controls are
           the button and the range input; the knob just turns to match. -->
      <section aria-label="Now playing" class="cabinet" class:on={onAir && listening}>
        <div class="grille" aria-hidden="true"></div>
        <div class="dial">
          <span class="needle" aria-hidden="true" style:left={`${12 + ((radio?.stationName.length ?? 0) * 7) % 76}%`}></span>
          {#if onAir}
            <p class="station"><span class="sr-only">On air: </span>{radio!.stationName}</p>
          {:else}
            <p class="station off">{isHost ? 'Off · pick a station below' : 'Off · the host picks the station'}</p>
          {/if}
        </div>
        <div class="tubes" aria-hidden="true"><i></i><i></i><i></i></div>
        {#if onAir}
          <div class="controls">
            <button type="button" class="power" aria-pressed={listening} onclick={() => (listening = !listening)}>{listening ? 'Mute for me' : 'Listen'}</button>
            <label class="volume">
              <span class="knob" aria-hidden="true" style:rotate={`${-135 + volume * 270}deg`}></span>
              <span>Volume <output>{Math.round(volume * 100)}%</output></span>
              <input type="range" min="0" max="1" step="0.05" bind:value={volume} aria-valuetext={`${Math.round(volume * 100)}%`} />
            </label>
          </div>
        {/if}
      </section>
      {#if blocked}<p class="error" role="status">Your browser paused the radio. Press Listen to hear it.</p>{/if}
      {#if playError}<p class="error" role="status">{playError}</p>{/if}

      {#if isHost}
        <section aria-label="Choose a station" class="pick">
          <form onsubmit={(event) => { event.preventDefault(); void search(query, false); }}>
            <label for="station-search">Find a station</label>
            <div class="row">
              <input id="station-search" bind:value={query} maxlength="60" autocomplete="off" placeholder="Name, like “jazz FM”" />
              <button type="submit" disabled={searching || !query.trim()}>Search</button>
            </div>
          </form>
          <div class="moods" role="group" aria-label="Moods">
            {#each MOODS as mood (mood)}<button type="button" onclick={() => search(mood, true)}>{mood}</button>{/each}
          </div>
          <p class="status" role="status">{searching ? 'Searching…' : message}</p>
          {#if results.length}
            <ul class="results">
              {#each results as station (station.id)}
                <li>
                  <span class="name">{station.name}
                    <small>{[station.country, station.tags.join(', '), station.bitrate ? `${station.bitrate} kbps` : ''].filter(Boolean).join(' · ')}</small>
                  </span>
                  <button type="button" aria-label={`Play ${station.name} for everyone`} onclick={() => putOn(station)}>Play</button>
                </li>
              {/each}
            </ul>
          {/if}
          {#if onAir}<button type="button" onclick={stopForEveryone}>Turn the radio off for everyone</button>{/if}
          <p class="fine">Stations come from the free Radio Browser directory. Each guest's browser streams the station directly.</p>
        </section>
      {/if}
    </div>
  </StudioPanel>
{/if}

<style lang="scss">
  @use '../../styles/tokens' as *;

  .radio {
    display: grid;
    gap: 0.75rem;
    font-size: 0.9375rem;
  }

  p {
    margin: 0;
  }

  // ---------- the tube radio cabinet ----------
  .cabinet {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem 0.75rem;
    padding: 0.75rem;
    border-radius: 14px 14px 6px 6px;
    color: #fff5e6;
    // Walnut: a warm base, soft grain stripes, a lit top edge and a dark foot.
    background:
      repeating-linear-gradient(97deg, rgb(255 255 255 / 0.03) 0 2px, transparent 2px 9px),
      linear-gradient(180deg, #7a4a2a, #4d2c17 70%, #331d0f);
    box-shadow:
      inset 0 2px 0 rgb(255 220 180 / 0.25),
      inset 0 -6px 10px rgb(0 0 0 / 0.35),
      0 6px 14px rgb(0 0 0 / 0.35);
  }

  .grille {
    grid-row: span 2;
    width: 5rem;
    min-height: 5rem;
    border-radius: 50% 50% 8px 8px;
    border: 3px solid #2b180c;
    // Woven speaker cloth.
    background:
      repeating-linear-gradient(45deg, rgb(0 0 0 / 0.25) 0 2px, transparent 2px 5px),
      repeating-linear-gradient(-45deg, rgb(0 0 0 / 0.25) 0 2px, transparent 2px 5px),
      #b89a6a;
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .dial {
    position: relative;
    grid-column: 1;
    padding: 0.5rem 0.625rem 0.375rem;
    border-radius: 6px;
    border: 2px solid #c9a86a;
    // The glass tuning window with its printed scale.
    background:
      repeating-linear-gradient(90deg, rgb(60 35 15 / 0.45) 0 1px, transparent 1px 12px) bottom / 100% 6px no-repeat,
      linear-gradient(#f3e2b8, #d9bf86);
    color: #2b1d12;
  }

  .on .dial {
    // Lit from behind when it's playing for you.
    box-shadow: 0 0 14px rgb(255 190 90 / 0.55), inset 0 0 10px rgb(255 200 110 / 0.6);
  }

  // The tuning needle sits on the printed scale, under the station name.
  .needle {
    position: absolute;
    bottom: 0.125rem;
    height: 0.75rem;
    width: 2px;
    background: #a3261b;
  }

  .station {
    position: relative;
    margin: 0;
    font-weight: 700;
    font-size: 0.875rem;
    overflow-wrap: anywhere;

    &.off {
      font-weight: 400;
      font-style: italic;
    }
  }

  .tubes {
    grid-column: 1;
    display: flex;
    gap: 0.375rem;

    i {
      width: 0.75rem;
      height: 1.25rem;
      border-radius: 40% 40% 3px 3px;
      background: rgb(255 255 255 / 0.12);
      border: 1px solid rgb(255 255 255 / 0.2);
    }
  }

  .on .tubes i {
    background: radial-gradient(circle at 50% 70%, #ffb347, #c4541c 60%, rgb(255 255 255 / 0.1));
  }

  @media (prefers-reduced-motion: no-preference) {
    .on .tubes i {
      animation: glow 3s ease-in-out infinite alternate;
    }
    .on .tubes i:nth-child(2) {
      animation-delay: -1s;
    }
  }

  @keyframes glow {
    to {
      filter: brightness(1.25);
    }
  }

  .controls {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .power {
    background: #2b180c;
    border-color: #c9a86a;
    color: #fff5e6;

    &[aria-pressed='true'] {
      background: #2b180c;
      color: #fff5e6;
    }
    &[aria-pressed='false'] {
      background: #f3e2b8;
      color: #2b1d12;
    }
  }

  .cabinet .volume {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0 0.5rem;
    color: #fff5e6;

    input {
      grid-column: 1 / -1;
      accent-color: #c9a86a;
    }
    output {
      float: none;
    }
  }

  // A bakelite knob with a pointer line; turns with the volume.
  .knob {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #6b4a2f, #2b180c 70%);
    box-shadow: 0 2px 3px rgb(0 0 0 / 0.5);
    position: relative;

    &::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 0.25rem;
      width: 2px;
      height: 0.75rem;
      background: #f3e2b8;
      translate: -50% 0;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .knob {
      transition: rotate 120ms ease-out;
    }
  }


  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .volume {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;

    input {
      flex: 1;
      min-height: $tap-min;
      accent-color: #8a3b12;
    }
  }

  form label {
    font-weight: 700;
    font-size: 0.875rem;
  }

  input:not([type='range']) {
    flex: 1;
    min-width: 0;
    min-height: $tap-min;
    padding: 0 0.625rem;
    border: 1px solid #b9a483;
    border-radius: $radius-sm;
    background: #fff;
    color: $walnut-900;
    font: inherit;
  }

  button {
    min-height: $tap-min;
    padding: 0 0.875rem;
    border: 1px solid #8f7a58;
    border-radius: $radius-sm;
    background: $walnut-900;
    color: $cream;
    font: inherit;
    font-weight: 700;

    &:disabled {
      opacity: 0.5;
    }
    &[aria-pressed='true'] {
      background: transparent;
      color: $walnut-900;
    }
  }

  .moods {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;

    button {
      background: transparent;
      color: $walnut-900;
      font-weight: 400;
    }
  }

  .status,
  .fine,
  small {
    font-size: 0.8125rem;
    color: #5a4634;
  }

  .error {
    margin-top: 0.5rem;
    color: #8a1c12;
    font-weight: 700;
  }

  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 14rem;
    overflow-y: auto;
    display: grid;
    gap: 0.375rem;

    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    small {
      display: block;
    }
  }

  .pick {
    display: grid;
    gap: 0.5rem;
  }
</style>
