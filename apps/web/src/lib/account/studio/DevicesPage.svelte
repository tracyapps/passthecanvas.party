<!--
  Camera & mic check: see yourself in the seat frame, watch your mic level,
  play a test sound, and save the devices you like for every party.
  Everything stays in this browser: nothing is recorded or uploaded, and
  the camera turns off when you leave this page.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { saveDevices, savedDevices } from '../../call/devices';

  let stream: MediaStream | null = null;
  let video: HTMLVideoElement | null = $state(null);
  let started = $state(false);
  let problem = $state('');
  let saved = $state('');
  let cameras = $state<MediaDeviceInfo[]>([]);
  let mics = $state<MediaDeviceInfo[]>([]);
  let speakers = $state<MediaDeviceInfo[]>([]);
  const initial = savedDevices();
  let cameraId = $state(initial.cameraId ?? '');
  let micId = $state(initial.micId ?? '');
  let speakerId = $state(initial.speakerId ?? '');
  let level = $state(0);
  let audio: AudioContext | null = null;
  let frame = 0;
  const canPickSpeaker = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  let mirrored = $state(true);

  async function start() {
    problem = '';
    stop();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId } } : true,
        audio: micId ? { deviceId: { exact: micId } } : true
      });
    } catch (error) {
      const name = (error as DOMException)?.name;
      problem = name === 'NotAllowedError' ? 'Your browser blocked the camera or microphone. Allow them in the address bar (the camera icon), then try again.'
        : name === 'NotFoundError' ? 'No camera or microphone was found. You can still join parties as an avatar.'
        : name === 'OverconstrainedError' ? 'That device is no longer available. Pick another one.'
        : 'The camera or microphone could not start. Another app might be using it.';
      started = false;
      return;
    }
    started = true;
    // Labels only appear after permission is granted.
    const all = await navigator.mediaDevices.enumerateDevices();
    cameras = all.filter((d) => d.kind === 'videoinput');
    mics = all.filter((d) => d.kind === 'audioinput');
    speakers = all.filter((d) => d.kind === 'audiooutput');
    cameraId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? cameraId;
    micId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? micId;
    if (video) video.srcObject = stream;
    meter();
  }

  function meter() {
    if (!stream?.getAudioTracks().length) return;
    audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    audio.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      level = Math.min(100, Math.round((peak / 128) * 160));
      frame = requestAnimationFrame(tick);
    };
    tick();
  }

  function stop() {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void audio?.close();
    audio = null;
    level = 0;
  }
  onDestroy(stop);

  /** A short, gentle two-note chime through the chosen speakers. */
  async function testSound() {
    const context = new AudioContext();
    const out = context.createMediaStreamDestination();
    const gain = context.createGain();
    gain.gain.value = 0.15;
    gain.connect(out);
    [523.25, 783.99].forEach((hz, i) => {
      const osc = context.createOscillator();
      osc.frequency.value = hz;
      osc.connect(gain);
      osc.start(context.currentTime + i * 0.25);
      osc.stop(context.currentTime + i * 0.25 + 0.35);
    });
    const player = new Audio();
    player.srcObject = out.stream;
    if (speakerId && canPickSpeaker) await (player as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(speakerId).catch(() => {});
    await player.play().catch(() => {});
    setTimeout(() => { player.pause(); void context.close(); }, 1000);
  }

  function save() {
    saved = saveDevices({ cameraId: cameraId || null, micId: micId || null, speakerId: speakerId || null })
      ? 'Saved. Parties in this browser will use these.'
      : "This browser wouldn't save them (private mode?). You can still pick them in the party.";
  }
  let levelText = $derived(level < 8 ? 'quiet' : level < 40 ? 'picking you up' : level < 85 ? 'nice and clear' : 'very loud');
</script>

<header class="page-head">
  <div>
    <p class="eyebrow">Before a party</p>
    <h1 tabindex="-1">Camera & mic check</h1>
    <p>See how you'll look in your seat, check your mic and speakers, and save the ones you like. Nothing is recorded or uploaded.</p>
  </div>
</header>

<div class="columns">
  <div>
    <section class="card stack" aria-labelledby="look-title">
      <h2 id="look-title">How you'll look in the room</h2>
      <div class="frames">
        <figure class="seat">
          <div class="frame">
            <!-- svelte-ignore a11y_media_has_caption — a live self-view, no speech to caption -->
            <video bind:this={video} autoplay muted playsinline class:mirrored></video>
            {#if !started}<span class="off">Camera off</span>{/if}
          </div>
          <figcaption>In your seat</figcaption>
        </figure>
        <p class="hint">Seats are portrait, so the sides of your camera are trimmed evenly. Sit near the middle of the picture.</p>
      </div>
      {#if !started}
        <button type="button" class="btn" onclick={start}>Turn on camera & mic</button>
      {:else}
        <div class="row">
          <button type="button" class="btn quiet" onclick={() => { stop(); started = false; if (video) video.srcObject = null; }}>Turn off</button>
          <label class="check"><input type="checkbox" bind:checked={mirrored} /><span>Mirror my preview (others always see you un-mirrored)</span></label>
        </div>
      {/if}
      {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
    </section>
  </div>

  <div>
    <section class="card stack" aria-labelledby="pick-title">
      <h2 id="pick-title">Your devices</h2>
      {#if started}
        <label class="field">Camera<select bind:value={cameraId} onchange={start}>{#each cameras as d, i (d.deviceId)}<option value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>{/each}</select></label>
        <label class="field">Microphone<select bind:value={micId} onchange={start}>{#each mics as d, i (d.deviceId)}<option value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>{/each}</select></label>
        <div class="field">
          <span id="level-label">Mic level <span class="hint">Say hello. It should move when you talk.</span></span>
          <div class="meter" role="meter" aria-labelledby="level-label" aria-valuemin="0" aria-valuemax="100" aria-valuenow={level} aria-valuetext={levelText}><span style:width={`${level}%`}></span></div>
        </div>
        {#if canPickSpeaker && speakers.length}
          <label class="field">Speakers<select bind:value={speakerId}><option value="">System default</option>{#each speakers as d, i (d.deviceId)}<option value={d.deviceId}>{d.label || `Speakers ${i + 1}`}</option>{/each}</select></label>
        {:else}
          <p class="hint">Speakers follow your system sound settings in this browser.</p>
        {/if}
        <div class="row">
          <button type="button" class="btn quiet" onclick={testSound}>Play a test sound</button>
          <button type="button" class="btn" onclick={save}>Save these for parties</button>
        </div>
        <p class="hint" role="status">{saved}</p>
      {:else}
        <p>Turn on the camera and mic to see your choices. Your browser will ask first.</p>
        <button type="button" class="btn quiet" onclick={testSound}>Play a test sound</button>
      {/if}
    </section>
  </div>
</div>

<style>
  .frames { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 20px; align-items: center; }
  @media (max-width: 520px) { .frames { grid-template-columns: minmax(0, 1fr); justify-items: center; } }
  .seat { margin: 0; text-align: center; }
  /* The same 3:4 portrait frame as the 360° room, a bit bigger. */
  .frame { position: relative; width: 168px; height: 224px; border: 4px solid #fffaf0; box-shadow: 0 8px 20px #0005; background: #3b3631; overflow: hidden; }
  video { width: 100%; height: 100%; object-fit: cover; }
  video.mirrored { transform: scaleX(-1); }
  .off { position: absolute; inset: 0; display: grid; place-items: center; color: #fff6e5; font-weight: 700; }
  figcaption { margin-top: 8px; font-weight: 700; }
  .meter { height: 18px; background: #e6dcc6; border: 1px solid #8d7858; overflow: hidden; }
  .meter span { display: block; height: 100%; background: linear-gradient(90deg, #07616a, #2f6b2f 70%, #b23c0f); transition: width 80ms linear; }
  .problem { font-weight: 700; color: #8f1238; }
  @media (prefers-reduced-motion: reduce) { .meter span { transition: none; } }
</style>
