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
  import type { DeviceDuty, DeviceScreen, LinkRole, MyDevice } from '@ptc/shared';
  import type { PartyConnection } from './connection.svelte';

  let { party, partyId }: { party: PartyConnection; partyId: string } = $props();

  /** A window opened for "Open … in its own window", waiting for its code. */
  let pendingWindow: Window | null = null;
  let status = $state('');
  let pending = $state<{ kind: DeviceDuty | 'screen' | 'unlink'; deviceId: string; label: string; screen?: DeviceScreen; until: number; errorVersion: number } | null>(null);
  let busy = $derived(!party.connected || !!pending);
  let canvasDevice = $derived(party.devices.find(device => device.canvas));
  let callDevice = $derived(party.devices.find(device => device.call));
  let mine = $derived(party.devices.find(device => device.id === party.youDeviceId));
  function deviceName(device: MyDevice) {
    // A second phone or window may have the same browser label; number those labels.
    const matches = party.devices.filter(item => item.label === device.label);
    const number = matches.length > 1 ? ` ${matches.findIndex(item => item.id === device.id) + 1}` : '';
    return `${device.label}${number}${device.id === party.youDeviceId ? ' (this device)' : ''}`;
  }
  $effect(() => {
    if (!pending) return;
    const target = party.devices.find(device => device.id === pending!.deviceId);
    const confirmed = pending.kind === 'unlink' ? !target : pending.kind === 'screen' ? target?.screen === pending.screen : target?.[pending.kind];
    if (confirmed) {
      status = pending.kind === 'unlink' ? `${pending.label} unlinked.` : pending.kind === 'screen'
        ? `${deviceName(target!)} now shows the ${pending.screen === 'room' ? 'room' : 'canvas'}.`
        : `${pending.kind === 'canvas' ? 'Painting' : 'Camera and microphone'} moved to ${deviceName(target!)}.`;
      pending = null;
    } else if (party.errorVersion !== pending.errorVersion) {
      status = party.lastError;
      pending = null;
    } else if (!party.connected || !target?.online) {
      status = 'The connection changed before this assignment was confirmed. Reconnect and try again.';
      pending = null;
    } else if (now >= pending.until) {
      status = 'The move was not confirmed. Check the current assignments, then try again.';
      pending = null;
    }
  });
  function assign(kind: DeviceDuty | 'screen', deviceId: string, screen?: DeviceScreen) {
    const device = party.devices.find(device => device.id === deviceId);
    if (busy || !device?.online) return;
    pending = { kind, deviceId, label: deviceName(device), screen, until: Date.now() + 8000, errorVersion: party.errorVersion };
    status = 'Waiting for the device assignment…';
    if (kind === 'screen' && screen) party.send({ type: 'setDeviceScreen', deviceId, screen });
    else if (kind !== 'screen') party.send({ type: 'takeDuty', duty: kind, deviceId });
  }
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

  function unlink(device: MyDevice) {
    if (busy) return;
    pending = { kind: 'unlink', deviceId: device.id, label: deviceName(device), until: Date.now() + 8000, errorVersion: party.errorVersion };
    party.send({ type: 'unlinkDevice', deviceId: device.id });
    status = `Unlinking ${deviceName(device)}…`;
  }

  function duties(device: MyDevice) {
    const list = [device.canvas && 'painting', device.call && 'camera and microphone'].filter(Boolean);
    return list.length ? list.join(' · ') : 'following along';
  }
  function minutes(seconds: number) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

</script>

<div class="devices">
  <p>One artist, one seat. Choose a device for each job. What a screen shows is separate from painting and camera/mic.</p>
  {#if !party.connected}<p role="status">Reconnecting… Device assignments will be available when the party reconnects.</p>{/if}
  {#if mine}
    <fieldset disabled={busy}>
      <legend>Painting and video</legend>
      <label>Painting on
        <select value={canvasDevice?.id ?? ''} onchange={(event) => { assign('canvas', event.currentTarget.value); event.currentTarget.value = canvasDevice?.id ?? ''; }}>
          {#each party.devices as device (device.id)}<option value={device.id} disabled={!device.online}>{deviceName(device)}{device.online ? '' : ' — reconnecting'}</option>{/each}
        </select>
      </label>
      <label>Camera and microphone on
        <select value={callDevice?.id ?? ''} onchange={(event) => { assign('call', event.currentTarget.value); event.currentTarget.value = callDevice?.id ?? ''; }}>
          {#each party.devices as device (device.id)}<option value={device.id} disabled={!device.online}>{deviceName(device)}{device.online ? '' : ' — reconnecting'}</option>{/each}
        </select>
      </label>
    </fieldset>
    <section aria-labelledby="screens-title">
      <h3 id="screens-title">Your screens</h3>
      <p class="hint">Room and canvas choices do not move the camera or microphone. Room screens without video use avatars.</p>
      <ul>
        {#each party.devices as device (device.id)}
          <li>
            <div class="device-info"><strong>{deviceName(device)}</strong><span>{duties(device)}{device.online ? '' : ' · reconnecting'}</span></div>
            <label>Show on {deviceName(device)}
              <select disabled={busy || !device.online} value={device.screen ?? 'canvas'} onchange={(event) => { assign('screen', device.id, event.currentTarget.value as DeviceScreen); event.currentTarget.value = device.screen ?? 'canvas'; }}>
                <option value="canvas">Canvas</option><option value="room">Room</option>
              </select>
            </label>
            {#if device.id !== party.youDeviceId}<button type="button" class="plain" disabled={busy} onclick={() => unlink(device)} aria-label={`Unlink ${deviceName(device)}`}>Unlink</button>{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <p class="assignment-status" role="status">{status}</p>

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
      <button type="button" class="plain" disabled={!party.connected} onclick={cancel}>Cancel code</button>
    </section>
  {:else}
    <h3>Add a device</h3>
    <p class="hint">It joins your seat, not the party as someone new. You stay one artist with one canvas.</p>
    <div class="row">
      <button type="button" disabled={busy} onclick={() => makeLink('canvas')}>Paint on a tablet</button>
      <button type="button" disabled={busy} onclick={() => makeLink('room')}>Room and video on a phone or laptop</button>
    </div>
    {#if canOpenWindows}
      <h3>Two windows on this computer</h3>
      <div class="row">
        <button type="button" disabled={busy} onclick={() => openWindow('canvas')}>Open the canvas in its own window</button>
        <button type="button" disabled={busy} onclick={() => openWindow('room')}>Open the room in its own window</button>
      </div>
    {/if}
  {/if}

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
    gap: 8px 12px;
    padding: 12px;
    border: 1px solid #766448;
    border-radius: 4px;
  }
  fieldset { display: grid; gap: 12px; border: 1px solid #9d8c67; min-width: 0; padding: 12px; }
  legend { padding: 0 4px; font-weight: 700; }
  label { display: grid; gap: 4px; flex: 1 1 200px; min-width: 0; }
  select { width: 100%; min-width: 0; min-height: 44px; padding: 8px; font: inherit; color: $cream; background: #30261b; border: 1px solid #9d8c67; border-radius: 4px; }
  .device-info { display: grid; gap: 4px; flex: 1 1 100%; overflow-wrap: anywhere; }
  .device-info span { font-size: 0.8125rem; color: $cream-muted; }
  section { display: grid; gap: 8px; }
  .assignment-status { min-height: 1.5em; font-size: 0.875rem; }
  button:disabled, select:disabled { opacity: .65; }
  button:focus-visible, select:focus-visible { outline: 3px solid $focus; outline-offset: 2px; }
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
