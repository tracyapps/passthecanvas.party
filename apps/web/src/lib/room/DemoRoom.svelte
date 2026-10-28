<!--
  Demo seating (?demo=seats): fill the room with fake guests so the owner can
  judge how seats and camera frames space out across the real panorama —
  before anyone has a LiveKit key or a webcam. Some guests get a fake video
  track (a painted canvas, see demoVideo.ts), the rest get the initials card,
  exactly like a real party mix.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Member, Spot } from '@ptc/shared';
  import type { GuestVideo } from '../call/call.svelte';
  import { makeFakeVideoTrack } from './demoVideo';
  import RoomView from './RoomView.svelte';

  const PANORAMA = '/studio/cream-city/panorama.webp';
  const SPOTS_URL = '/studio/cream-city/spots.json';

  const NAMES = ['Ada', 'Bo', 'Cleo', 'Dex', 'Efi', 'Gus', 'Hana', 'Iggy', 'Jo', 'Kit'];

  let spots = $state<Spot[]>([]);
  let guestCount = $state(5);
  let cameraCount = $state(3);
  let members = $state<Member[]>([]);
  let videos = $state<GuestVideo[]>([]);

  // Every reshuffle stops the old fake tracks, or the browser keeps painting
  // canvases nobody can see anymore.
  let liveTracks: MediaStreamTrack[] = [];
  onDestroy(() => liveTracks.forEach((t) => t.stop()));

  onMount(async () => {
    const response = await fetch(SPOTS_URL);
    spots = (await response.json()).spots ?? [];
  });

  $effect(() => {
    if (spots.length > 0 && members.length === 0) populate();
  });

  function populate() {
    liveTracks.forEach((t) => t.stop());
    liveTracks = [];

    // Shuffle the spots and take as many as we need guests.
    const picked = [...spots].sort(() => Math.random() - 0.5).slice(0, guestCount);
    const cameraSeats = new Set(picked.slice(0, cameraCount).map((s) => s.id));

    const nextMembers: Member[] = [];
    const nextVideos: GuestVideo[] = [];
    picked.forEach((spot, i) => {
      const name = NAMES[i % NAMES.length]!;
      const id = `demo-${i + 1}`;
      nextMembers.push({ id, name, presence: cameraSeats.has(spot.id) ? 'camera' : 'avatar', isHost: i === 0, spotId: spot.id });
      if (cameraSeats.has(spot.id)) {
        const track = makeFakeVideoTrack(name[0]!, i);
        liveTracks.push(track);
        nextVideos.push({ identity: id, name, track, speaking: false });
      }
    });
    members = nextMembers;
    videos = nextVideos;
  }

  // Keep the camera count possible whenever the guest count shrinks.
  $effect(() => {
    if (cameraCount > guestCount) cameraCount = guestCount;
  });
</script>

<main class="demo">
  <form class="bar" onsubmit={(e) => { e.preventDefault(); populate(); }}>
    <p class="tape">Demo seating</p>
    <label>
      <span>Guests</span>
      <input type="number" min="1" max="10" bind:value={guestCount} onchange={populate} />
    </label>
    <label>
      <span>On camera</span>
      <input type="number" min="0" max={guestCount} bind:value={cameraCount} onchange={populate} />
    </label>
    <button type="submit">Reshuffle</button>
    <p class="status">{members.length} seated, {videos.length} on camera — nothing is saved or sent.</p>
  </form>

  <div class="stage">
    <RoomView panorama={PANORAMA} spotsUrl={SPOTS_URL} {members} youId={null} {videos} />
  </div>
</main>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .demo {
    @include walnut-table;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .bar {
    display: flex;
    align-items: end;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    background: rgb(24 16 11 / 0.8);
    border-radius: $radius-sm;

    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: $cream-muted;

      input {
        width: 4.5rem;
        min-height: $tap-min;
        padding: 0 0.5rem;
        border-radius: $radius-sm;
        border: 1px solid rgb(255 230 200 / 0.25);
        background: rgb(0 0 0 / 0.3);
        color: $cream;
      }
    }

    button {
      min-height: $tap-min;
      padding: 0 1.25rem;
      border: 0;
      border-radius: $radius-pill;
      background: $cadmium-orange;
      color: rgb(24 16 11);
      font-weight: 700;
    }
  }

  .tape {
    @include tape-label;
    margin: 0;
    align-self: center;
    font-size: 1.25rem;
  }

  .status {
    margin: 0;
    align-self: center;
    font-size: 0.875rem;
    color: $cream-muted;
  }

  .stage {
    flex: 1;
    min-height: 0;
  }
</style>
