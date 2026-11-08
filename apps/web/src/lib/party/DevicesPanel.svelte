<!--
  Use another device: one artist, one seat, more than one screen. Paint on
  a tablet while the room and video stay on a laptop or phone, or open the
  canvas and the room in two windows side by side. The party server gives
  the canvas to one device and the call to one device; this panel moves
  them, links new devices with a one-time code (QR or typed), and unlinks.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { encode } from 'uqr';
  import type { DeviceDuty, LinkRole, MyDevice } from '@ptc/shared';
  import type { PartyConnection } from './connection.svelte';

  let { party, partyId }: { party: PartyConnection; partyId: string } = $props();

  /** A window opened for "Open … in its own window", waiting for its code. */
  let pendingWindow: Window | null = null;
  let status = $state('');
  let now = $state(Date.now());
  const clock = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(clock));

  // Windows only make sense with a mouse and room for two (not on phones and tablets).
  const canOpenWindows = matchMedia('(pointer: fine)').matches && innerWidth >= 900;

  let link = $derived(party.link);
  let secondsLeft = $derived(link ? Math.max(0, Math.round((link.expiresAt - now) / 1000)) : 0);
  let linkUrl = $derived(link ? `${location.origin}/?party=${encodeURIComponent(partyId)}#link=${link.code}` : '');
  let qr = $derived(link ? encode(linkUrl, { ecc: 'M', border: 2 }) : null);
  let spaced = $derived(link ? `${link.code.slice(0, 3)}-${link.code.slice(3)}` : '');

  // An expired code is gone; say so once.
  $effect(() => {
    if (link && secondsLeft === 0) {
      party.link = null;
      status = 'That code expired. Make a new one when you are ready.';
    }
  });

  // The code arrived: point the waiting window at it.
  $effect(() => {
    if (!link || !pendingWindow) return;
    const target = pendingWindow;
    pendingWindow = null;
    if (target.closed) return;
    target.location.href = `${linkUrl}&window=1`;
    status = link.role === 'canvas' ? 'The canvas opened in its own window. Drag it next to this one or onto another screen.' : 'The room opened in its own window. Drag it next to this one or onto another screen.';
  });

  function makeLink(role: LinkRole) {
    status = '';
    party.send({ type: 'makeLink', role });
  }

  function openWindow(role: LinkRole) {
    // Open the window now, while this click still counts, or the browser blocks it.
    const opened = window.open('about:blank', `ptc-${role}`, 'popup,width=1100,height=800');
    if (!opened) {
      status = 'Your browser blocked the new window. Allow pop-ups for this site, then try again.';
      return;
    }
    pendingWindow = opened;
    party.send({ type: 'makeLink', role });
  }

  function cancel() {
    party.send({ type: 'cancelLink' });
    party.link = null;
    status = 'Code cancelled.';
  }

  function take(duty: DeviceDuty) {
    party.send({ type: 'takeDuty', duty });
    status = duty === 'canvas' ? 'You paint on this device now.' : 'The room and video are on this device now.';
    party.announcement = status;
  }

  function unlink(device: MyDevice) {
    party.send({ type: 'unlinkDevice', deviceId: device.id });
    status = `${device.label} unlinked.`;
    party.announcement = status;
  }

  function duties(device: MyDevice) {
    const list = [device.canvas && 'painting', device.call && 'room and video'].filter(Boolean);
    return list.length ? list.join(' · ') : 'following along';
  }
  function minutes(seconds: number) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  let mine = $derived(party.devices.find((d) => d.id === party.youDeviceId) ?? null);
</script>

<div class="devices">
  {#if mine}
    <p class="here"><strong>This device</strong> ({mine.label}): {duties(mine)}</p>
    {#if !mine.canvas || !mine.call}
      <div class="row">
        {#if !mine.canvas}<button type="button" onclick={() => take('canvas')}>Paint on this device</button>{/if}
        {#if !mine.call}<button type="button" onclick={() => take('call')}>Room and video on this device</button>{/if}
      </div>
    {/if}
  {/if}

  {#if party.otherDevices.length}
    <h3>Your other devices</h3>
    <ul>
      {#each party.otherDevices as device (device.id)}
        <li>
          <span><strong>{device.label}</strong>: {duties(device)}{device.online ? '' : ' (reconnecting)'}</span>
          <button type="button" class="plain" onclick={() => unlink(device)} aria-label={`Unlink ${device.label}`}>Unlink</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if link && qr}
    <section class="code" aria-labelledby="link-title">
      <h3 id="link-title">{link.role === 'canvas' ? 'Paint on your other device' : 'Room and video on your other device'}</h3>
      <p>Scan this with its camera, or open <strong>{location.host}/?link</strong> and type the code.</p>
      <svg class="qr" viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code that opens this party on your other device" shape-rendering="crispEdges">
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path fill="#000" d={qr.data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ''))).join('')} />
      </svg>
      <p class="big" aria-label={`Code: ${link.code.split('').join(' ')}`}>{spaced}</p>
      <p class="hint" aria-live="off">Works once. Expires in {minutes(secondsLeft)}.</p>
      <button type="button" class="plain" onclick={cancel}>Cancel code</button>
    </section>
  {:else}
    <h3>Add a device</h3>
    <p class="hint">It joins your seat, not the party as someone new. You stay one artist with one canvas.</p>
    <div class="row">
      <button type="button" onclick={() => makeLink('canvas')}>Paint on a tablet</button>
      <button type="button" onclick={() => makeLink('room')}>Room and video on a phone or laptop</button>
    </div>
    {#if canOpenWindows}
      <h3>Two windows on this computer</h3>
      <div class="row">
        <button type="button" onclick={() => openWindow('canvas')}>Open the canvas in its own window</button>
        <button type="button" onclick={() => openWindow('room')}>Open the room in its own window</button>
      </div>
    {/if}
  {/if}

  {#if status}<p class="hint" role="status">{status}</p>{/if}
</div>

<style lang="scss">
  @use '../../styles/tokens' as *;

  .devices {
    display: grid;
    gap: 0.75rem;
  }
  p, h3, ul {
    margin: 0;
  }
  h3 {
    font-size: 0.9375rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  button {
    min-height: $tap-min;
    padding: 0 0.875rem;
    border: 1px solid #9d8c67;
    border-radius: 4px;
    background: transparent;
    color: $cream;
    text-align: left;
  }
  .plain {
    border-color: transparent;
    text-decoration: underline;
  }
  ul {
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.25rem;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem 0.75rem;
  }
  .code {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  .qr {
    width: min(12rem, 100%);
    height: auto;
    border-radius: 4px;
  }
  .big {
    font-family: $font-display;
    font-size: 2rem;
    letter-spacing: 0.15em;
    font-weight: 700;
  }
  .hint {
    font-size: 0.8125rem;
    color: $cream-muted;
  }
</style>
