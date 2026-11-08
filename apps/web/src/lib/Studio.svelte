<!--
  The party screen. Everyone starts their own canvas; each round everyone
  paints the canvas in front of them, then all the canvases pass one seat
  clockwise. Three places, one party:
  - the painting table (default): the canvas in front of you this round
  - the 360° room (pick your seat: it sets who you pass to)
  - the gallery, after the reveal: everyone's finished piece in the room
  Host tools (passing order, turn length, start, pass everyone) live in
  "Party setup" and the top bar.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { CANVAS_SHAPES, INITIALS_COLORS, durationText, creditLine, moveInOrder, roundsFor, turnLengthText, type CanvasShape, type OrderMode, type Piece } from '@ptc/shared';
  import type { PartyConnection } from './party/connection.svelte';
  import { Call } from './call/call.svelte';
  import CallDock from './call/CallDock.svelte';
  import VideoTile from './call/VideoTile.svelte';
  import PaintingTable from './canvas/PaintingTable.svelte';
  import StudioPanel from './canvas/StudioPanel.svelte';
  import TimerDial from './ui/TimerDial.svelte';
  import ChatNotepad from './chat/ChatNotepad.svelte';
  import TimeLapse from './canvas/TimeLapse.svelte';
  import PartyRadio from './radio/PartyRadio.svelte';
  import type { GalleryPiece } from './room/leanLayout';
  import TimingControls from './party/TimingControls.svelte';
  import DevicesPanel from './party/DevicesPanel.svelte';
  import { accountRequest, accountState } from './account/account.svelte';
  import { studio } from './account/studio/studio.svelte';
  import { partyUrl } from './party/origin';

  let { party, onleave }: { party: PartyConnection; onleave?: () => void } = $props();

  let view = $state<'paint' | 'room' | 'gallery'>('paint');
  let table: PaintingTable | undefined = $state();
  let guestsOpen = $state(innerWidth > 1100);
  let revealOpen = $state(true);
  let setupOpen = $state(true);
  let timingOpen = $state(false);
  let notesOpen = $state(false);
  let radioOpen = $state(false);
  let devicesOpen = $state(false);
  /** Late joiners (and the reveal) pick a canvas to look at. */
  let watchedId = $state<string | null>(null);
  /** The piece opened in the reveal's detail view. */
  let detailId = $state<string | null>(null);
  const call = new Call();


  let game = $derived(party.state);
  let room = $derived(game?.room ?? 'cream-city');
  let isHost = $derived(party.me?.isHost ?? false);
  let inviteOpen = $state(false);
  let invitedHere = $state<string[]>([]);
  /** This room's party in your studio, when you host it (started or planned there). */
  let plannedHere = $derived(game && isHost ? studio.home?.parties.find((p) => p.roomId === game.partyId && p.hosting) ?? null : null);
  async function inviteFriend(friend: string) {
    if (!plannedHere) return;
    try {
      await accountRequest('community/parties/invite', 'POST', { party: plannedHere.id, friend });
      invitedHere = [...invitedHere, friend];
      party.announcement = 'Invitation sent to their studio.';
    } catch (cause) {
      party.announcement = cause instanceof Error ? cause.message : 'That invitation could not be sent.';
    }
  }
  let me = $derived(party.me);

  // Seat views: the room as seen from your own seat, when one has been rendered
  // (studio/scripts/seat_views.py writes seats/index.json). Otherwise, the middle.
  let seatIds = $state<string[]>([]);
  let fromSeat = $state(true);
  $effect(() => {
    const url = `/studio/${room}/seats/index.json`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : { seats: [] }))
      .then((data) => (seatIds = (data.seats ?? []).map((seat: { id: string }) => seat.id)))
      .catch(() => (seatIds = []));
  });
  let mySeat = $derived(me?.spotId && seatIds.includes(me.spotId) ? me.spotId : null);
  let roomBase = $derived(mySeat && fromSeat ? `/studio/${room}/seats/${mySeat}` : `/studio/${room}`);

  /** The canvas on your table: yours this round, or the one you chose to watch. */
  let viewId = $derived(party.myCanvasId ?? (game?.phase === 'painting' || game?.phase === 'passing' ? watchedId ?? game.pieces[0]?.id ?? null : null));
  let viewPiece = $derived(party.piece(viewId));
  let canvasKey = $derived(viewId ?? 'lobby');
  let canvasSize = $derived(viewPiece ?? CANVAS_SHAPES[me?.canvasShape ?? 'classic']);

  // Watching a canvas that isn't in front of you: ask the server to follow it.
  let following: string | null = null;
  $effect(() => {
    const target = party.myCanvasId ? null : viewId;
    if (target === following) return;
    following = target;
    party.send({ type: 'watch', canvasId: target });
  });

  // When a canvas's history arrives (a new round, or something you started
  // watching), rebuild it on the table with every turn's own layer.
  let applied: object | null = null;
  $effect(() => {
    const current = table;
    const history = viewId ? party.histories[viewId] : undefined;
    const piece = viewPiece;
    if (!current || !history || !piece || history === applied) return;
    applied = history;
    void current.loadHistory(piece.id, piece.width, piece.height, history.strokes, history.complete, history.baseUrl);
  });

  // Your devices: one holds the canvas (only its strokes count), one holds
  // the call. A device without the canvas mirrors it; one without the call
  // stays out of the video (the call is joined once per artist).
  let holdsCanvas = $derived(party.holds('canvas'));
  let holdsCall = $derived(party.holds('call'));
  let canvasDevice = $derived(party.devices.find((d) => d.canvas)?.label ?? 'other device');
  let callDevice = $derived(party.devices.find((d) => d.call)?.label ?? 'other device');
  // A newly linked device opens on what it's for: the room for a room-and-
  // video device, the canvas for a painting device. Later changes (handing a
  // duty over) are announced but never move you; the room and canvas toggle does.
  let lastJob = '';
  $effect(() => {
    if (!party.youDeviceId) return;
    const job = `${holdsCanvas}/${holdsCall}`;
    if (job === lastJob) return;
    const first = lastJob === '';
    lastJob = job;
    if (first && holdsCall && !holdsCanvas) view = 'room';
    if (!first) party.announcement = holdsCanvas && holdsCall ? 'This device has the canvas and the video again.' : holdsCanvas ? `You paint here. The room and video are on your ${callDevice}.` : holdsCall ? `The room and video are here. You paint on your ${canvasDevice}.` : 'This device is following along.';
  });

  $effect(() => {
    const current = table;
    if (!current) return;
    party.onStroke = (stroke) => current.applyRemote(stroke);
    party.onPassRequest = () => pass();
    party.onSnapshotRequest = (round, canvasId) => {
      if (canvasId === viewId) party.send({ type: 'snapshot', round, canvasId, pngDataUrl: current.snapshot() });
    };
  });

  // Join the video call once the party tells us who we are. The member id
  // becomes the LiveKit identity, so tiles line up with guests.
  // Only the device holding the call joins it; handing the call to another
  // device leaves it here.
  $effect(() => {
    const partyId = game?.partyId;
    if (!me || !partyId) return;
    if (holdsCall && call.status === 'off') void call.join(partyId, me.name, me.id, me.presence);
    else if (!holdsCall && call.status !== 'off') call.leave();
  });

  onDestroy(() => call.leave());

  // The room shows everyone's camera at their seat, yours included. The call
  // only lists remote guests, so add your own camera when it is on.
  let roomVideos = $derived(
    me && call.status === 'in-call' && call.camOn && call.localVideo
      ? [...call.videos, { identity: me.id, name: me.name, track: call.localVideo, speaking: false }]
      : call.videos
  );

  function leave() {
    call.leave();
    party.leave();
    onleave?.();
  }

  // Opening the notepad clears the unread count; the connection needs to know
  // whether it is open so it only counts (and announces) notes you missed.
  $effect(() => {
    party.chatOpen = notesOpen;
    if (notesOpen) party.unreadChat = 0;
  });

  function whose(piece: Piece | null) {
    if (!piece) return 'your canvas';
    return piece.ownerId === party.youId ? 'your own canvas' : `${piece.ownerName}'s canvas`;
  }

  let waitingCount = $derived(party.stillPainting.length);
  let timerLabel = $derived(
    game?.overtime ? (party.isPainting ? "Time's up · finish & pass" : "Time's up")
      : party.isPainting ? 'Painting' : party.myCanvasId ? 'Passed' : 'Watching'
  );
  let canvasLabel = $derived(
    !game || game.phase === 'lobby' ? `Your canvas, ${CANVAS_SHAPES[me?.canvasShape ?? 'classic'].name.toLowerCase()}. The game hasn't started.`
      : game.phase === 'reveal' ? 'All the canvases are finished.'
      : `Round ${game.round} of ${game.totalRounds}: ${whose(viewPiece)}.`
  );
  let waitingNote = $derived(
    !game ? 'Connecting…'
      : game.phase === 'lobby' ? (isHost ? 'Pick your seat in the room and your canvas shape, then start when everyone is here.' : 'Pick your seat in the room and your canvas shape. The host starts the game.')
      : game.phase === 'passing' ? 'Passing the canvases…'
      : game.phase === 'reveal' ? 'All rounds done.'
      : me?.watching ? `You joined after the start, so you're watching ${whose(viewPiece)}.`
      : party.myCanvasId && !party.isPainting ? `Passed. Waiting for ${waitingCount} ${waitingCount === 1 ? 'artist' : 'artists'} to finish.`
      : game.overtime ? "Time's up. Finish your stroke, then pass."
      : 'Painting.'
  );

  /** Painter id → name, including people who have since left. */
  let names = $derived(Object.fromEntries([
    ...(game?.pieces ?? []).flatMap((piece) => piece.turns.map((turn) => [turn.painterId, turn.painterName])),
    ...(game?.members ?? []).map((m) => [m.id, m.name])
  ]));

  function finalUrl(piece: Piece) {
    return [...piece.turns].reverse().find((turn) => turn.url)?.url ?? null;
  }
  function credit(piece: Piece) {
    return creditLine(piece.ownerName, piece.turns.map((turn) => turn.painterName));
  }
  /** Your piece first, then everyone else's around the ring. */
  let revealPieces = $derived([...(game?.pieces ?? [])].sort((a, b) => Number(b.ownerId === party.youId) - Number(a.ownerId === party.youId)));

  /** Everyone's finished piece, for the gallery room. */
  let artwork = $derived.by((): GalleryPiece[] =>
    (game?.pieces ?? []).flatMap((piece) => {
      const url = finalUrl(piece);
      return url ? [{ seed: piece.id, aspect: piece.width / piece.height, url, caption: credit(piece) }] : [];
    })
  );

  function openDetail(piece: Piece) {
    detailId = piece.id;
    party.send({ type: 'watch', canvasId: piece.id }); // its strokes, for the time-lapse
  }

  /** Lobby: the host nudges someone one place earlier or later (makes the order "custom"). */
  function move(id: string, step: -1 | 1) {
    if (!game) return;
    const order = moveInOrder(game.order, id, step);
    if (order === game.order) return;
    party.send({ type: 'setOrder', order });
    party.announcement = `${nameOf(id)} is now number ${order.indexOf(id) + 1} of ${order.length}.`;
  }

  /** The devices panel shares the palette dock: it takes the place of setup, invite and timing. */
  function openDevices(open: boolean) {
    devicesOpen = open;
    if (open) setupOpen = inviteOpen = timingOpen = false;
  }

  /**
   * Pass: finish any stroke first so its last stamps arrive before the pass.
   * From a device without the canvas, the server asks the canvas device to
   * finish and pass.
   */
  function pass() {
    if (holdsCanvas) table?.finishStroke();
    party.send({ type: 'passNow' });
    if (!holdsCanvas) party.announcement = `Passing from your ${canvasDevice}.`;
  }

  /** Move focus into a dialog when it opens, so keyboard and screen-reader users land in it. */
  function focusOnOpen(node: HTMLElement) {
    node.focus();
  }

  // The invite is just this party's address. Copy it, or select it by hand.
  let inviteUrl = $derived(game ? `${location.origin}${location.pathname}?party=${encodeURIComponent(game.partyId)}` : '');
  let inviteStatus = $state('');
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      inviteStatus = 'Invite link copied. Paste it to your friends.';
    } catch {
      inviteStatus = 'Copying was blocked. Select the link and copy it yourself.';
    }
    party.announcement = inviteStatus;
  }

  // A planned party's room (/?party=p-…): the host's saved timing and order apply once.
  let appliedPlan = false;
  $effect(() => {
    if (appliedPlan || !game || game.phase !== 'lobby' || !isHost || !accountState.userId) return;
    const planned = studio.home?.parties.find((p) => p.roomId === game.partyId && p.hosting);
    if (!planned) return;
    appliedPlan = true;
    party.send({ type: 'setTiming', timing: $state.snapshot(planned.settings.timing) });
    party.send({ type: 'setOrderMode', mode: planned.settings.orderMode });
  });

  // A saved gallery goes into every signed-in artist's own History & art.
  let recordedArchive: string | null = null;
  $effect(() => {
    const id = game?.archive.id;
    if (!id || id === recordedArchive || !accountState.userId || !studio.home?.profile) return;
    recordedArchive = id;
    const planned = studio.home.parties.find((p) => p.roomId === game!.partyId);
    const title = planned?.title ?? `Party on ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    void accountRequest('community/galleries', 'POST', { archiveId: id, title: title.slice(0, 80) }).catch(() => {});
  });

  /** Camera ↔ avatar, any time: tell the party, then the call. */
  function swapPresence() {
    const next = me?.presence === 'camera' ? 'avatar' : 'camera';
    party.send({ type: 'setPresence', presence: next });
    void call.setPresence(next);
    party.announcement = next === 'camera' ? 'Camera on.' : 'Camera off. Your avatar is showing.';
  }

  function nameOf(id: string) {
    return names[id] ?? 'Guest';
  }

  // The saved gallery (archive): a link anyone can open, made by the host.
  let archiveLink = $derived(game?.archive.id ? `${location.origin}/?archive=${game.archive.id}` : '');
  let deleteLink = $derived(archiveLink && party.archiveDeleteKey ? `${archiveLink}#delete=${party.archiveDeleteKey}` : '');
  let archiveStatus = $state('');
  async function copyText(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      archiveStatus = done;
    } catch {
      archiveStatus = 'Copying was blocked. Select the link and copy it yourself.';
    }
  }
  function seatOf(id: string) {
    return game?.members.find((m) => m.id === id)?.spotId ? '' : ' · no seat yet';
  }
  function closeMenu() {
    document.getElementById('table-actions')?.hidePopover();
  }
  const ORDER_LABELS: Record<OrderMode, string> = { seats: 'By seat, clockwise', random: 'Random circle', custom: 'Custom' };
</script>


<div class="studio">
  <!-- One heading names the page for screen readers; the party strip shows the same name visually. -->
  <header class="sr-only"><h1>Pass the Canvas party{game ? `: ${game.partyId}` : ''}. {view === 'room' ? 'The room' : view === 'gallery' ? 'The gallery' : 'Your painting table'}</h1></header>
  {#if view === 'gallery' && game}
    <!-- Loaded only when opened: the gallery shares the 360° viewer. -->
    {#await import('./room/Gallery.svelte')}
      <p class="loading">Hanging the artwork…</p>
    {:then { default: Gallery }}
      <Gallery {room} {artwork} onback={() => { view = 'paint'; revealOpen = true; }}
        onpiece={(seed) => { const piece = party.piece(seed); if (piece) { view = 'paint'; revealOpen = true; openDetail(piece); } }}
        partyMode={game.galleryMode} onpartymode={isHost ? (mode) => party.send({ type: 'setGalleryMode', mode }) : undefined} />
    {/await}
  {:else if view === 'room'}
    <!-- The painting table (hidden now) has its own <main>; the room is this view's main area. -->
    <main class="room-main">
    <!-- Loaded only when opened: the 360° viewer (three.js) is the heaviest part of the app. -->
    {#await import('./room/RoomView.svelte')}
      <p class="loading">Opening the room…</p>
    {:then { default: RoomView }}
      {#if mySeat}
        <div class="viewpoint" role="group" aria-label="Where you look from">
          <button type="button" aria-pressed={fromSeat} onclick={() => (fromSeat = true)}>From your seat</button>
          <button type="button" aria-pressed={!fromSeat} onclick={() => (fromSeat = false)}>From the middle of the room</button>
        </div>
      {/if}
      <!-- A new viewpoint is a new panorama: rebuild the viewer for it. -->
      {#key roomBase}
        <RoomView
          panorama={`${roomBase}/panorama.webp`}
          spotsUrl={`${roomBase}/spots.json`}
          members={game?.members ?? []}
          youId={party.youId}
          videos={roomVideos}
          looks={party.looks}
          onTakeSpot={(spotId) => party.send({ type: 'takeSpot', spotId })}
        />
      {/key}
    {/await}
    </main>
  {/if}

  <!-- The table stays mounted in the room and gallery too, so the canvas keeps
       its layers; it is just hidden. -->
  {#if game && party.youId}
    <div class="table" hidden={view !== 'paint'}>
      <PaintingTable
        bind:this={table}
        canDraw={party.isPainting && holdsCanvas}
        painterId={party.youId}
        round={game.round}
        {canvasKey}
        {canvasSize}
        label={canvasLabel}
        {waitingNote}
        onstroke={(stroke) => party.send({ type: 'stroke', stroke })}
      >
        {#snippet partyBar()}
          <div class="party-bar">
            <p class="tape">{game.partyId}</p>
            {#if game.phase === 'lobby'}
              <label class="inline">Your canvas
                <select value={me?.canvasShape ?? 'classic'} onchange={(event) => party.send({ type: 'setMyCanvas', shape: event.currentTarget.value as CanvasShape })}>
                  {#each Object.entries(CANVAS_SHAPES) as [id, shape] (id)}<option value={id}>{shape.name}</option>{/each}
                </select>
              </label>
              {#if isHost}
                <button type="button" aria-pressed={setupOpen} onclick={() => (setupOpen = !setupOpen)}>Party setup</button>
                <button type="button" class="primary" onclick={() => party.send({ type: 'start' })}>Start the game</button>
              {:else}
                <p class="note">Turns: {turnLengthText(game.turnSeconds)} · {roundsFor(game.order.length)} rounds{game.timing.mode === 'party' ? ` · a ${durationText(game.timing.partyMinutes * 60)} party` : ''} · waiting for the host</p>
              {/if}
            {/if}
            {#if game.phase === 'painting' || game.phase === 'passing'}
              <p class="round">Round <strong>{game.round}</strong> of {game.totalRounds}<span class="whose">{whose(viewPiece)}</span></p>
              <TimerDial secondsLeft={game.secondsLeft} totalSeconds={game.turnSeconds} label={timerLabel} />
              {#if game.plannedEndAt}<p class="note">Wraps up around {new Date(game.plannedEndAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>{/if}
              {#if isHost}<button type="button" aria-pressed={timingOpen} onclick={() => (timingOpen = !timingOpen)}>Timing</button>{/if}
              {#if me?.watching && game.pieces.length}
                <label class="inline">Watching
                  <select value={viewId} onchange={(event) => (watchedId = event.currentTarget.value)}>
                    {#each game.pieces as piece (piece.id)}<option value={piece.id}>{piece.ownerName}'s canvas</option>{/each}
                  </select>
                </label>
              {/if}
            {/if}
            {#if game.phase === 'painting' && party.isPainting}
              <button type="button" class="primary" class:nudge={game.overtime} onclick={pass}>Pass the canvas</button>
            {:else if game.phase === 'painting' && party.myCanvasId}
              <p class="note" role="status">Waiting for {waitingCount} {waitingCount === 1 ? 'artist' : 'artists'}</p>
            {/if}
            {#if game.phase === 'painting' && isHost && waitingCount > 0 && (game.overtime || !party.isPainting)}
              <button type="button" onclick={() => party.send({ type: 'passEveryone' })}>Pass everyone on</button>
            {/if}
            {#if game.phase === 'reveal'}
              <button type="button" class="primary" onclick={() => (revealOpen = true)}>See the finished pieces</button>
            {/if}
            <button type="button" onclick={swapPresence}>{me?.presence === 'camera' ? 'Switch to avatar' : 'Switch to camera'}</button>
            <button type="button" aria-pressed={radioOpen} onclick={() => (radioOpen = !radioOpen)}>
              Radio{#if game.radio?.playing}<span class="badge" aria-hidden="true">on</span><span class="sr-only">, playing</span>{/if}
            </button>
            <button type="button" aria-pressed={notesOpen} onclick={() => (notesOpen = !notesOpen)}>
              Notes{#if party.unreadChat}<span class="badge">{party.unreadChat}<span class="sr-only"> new</span></span>{/if}
            </button>
          </div>
        {/snippet}
        {#snippet menu()}
          <button type="button" aria-pressed={guestsOpen} onclick={() => { guestsOpen = !guestsOpen; closeMenu(); }}>{guestsOpen ? 'Hide guests' : 'Show guests'}</button>
          <button type="button" aria-pressed={inviteOpen} onclick={() => { inviteOpen = !inviteOpen; closeMenu(); }}>Invite people</button>
          <button type="button" aria-pressed={devicesOpen} onclick={() => { openDevices(!devicesOpen); closeMenu(); }}>Use another device</button>
          <button type="button" onclick={() => { view = 'room'; closeMenu(); }}>{game.phase === 'lobby' ? 'Pick a seat in the room' : 'Go to the room'}</button>
          {#if artwork.length}<button type="button" onclick={() => { view = 'gallery'; closeMenu(); }}>Open the gallery</button>{/if}
          <button type="button" onclick={leave}>Leave the party</button>
        {/snippet}
      </PaintingTable>

      {#if inviteOpen}
        <!-- Invite people, any time: the room link for anyone, and (for a signed-in host) friends' studios. -->
        <StudioPanel title="Invite people" label="invite people" dock="palette" flow={innerWidth <= 1100} onclose={() => (inviteOpen = false)}>
          <div class="setup">
            <label>Party link
              <input type="text" readonly value={inviteUrl} onfocus={(event) => event.currentTarget.select()} />
            </label>
            <button type="button" onclick={copyInvite}>Copy link</button>
            {#if inviteStatus}<p class="hint" role="status">{inviteStatus}</p>{/if}
            <p class="hint">Send it any way you like: text, email, chat. Anyone with the link can join.</p>
            {#if plannedHere && studio.home?.friends.length}
              <fieldset class="modes">
                <legend>Invite friends to their studio</legend>
                {#each studio.home.friends as friend (friend.id)}
                  <label class="friend">
                    <span>{friend.name}</span>
                    {#if invitedHere.includes(friend.id)}<span class="hint">Invited</span>
                    {:else}<button type="button" onclick={() => inviteFriend(friend.id)}>Invite</button>{/if}
                  </label>
                {/each}
              </fieldset>
            {:else if accountState.userId && !plannedHere && isHost}
              <p class="hint">Started from your studio (Start a party now), you can also send invitations straight to friends.</p>
            {/if}
          </div>
        </StudioPanel>
      {/if}

      {#if devicesOpen}
        <StudioPanel title="Use another device" label="your devices" dock="palette" flow={innerWidth <= 1100} onclose={() => (devicesOpen = false)}>
          <DevicesPanel {party} partyId={game.partyId} />
        </StudioPanel>
      {/if}
      {#if isHost && timingOpen && (game.phase === 'painting' || game.phase === 'passing')}
        <StudioPanel title="Timing" label="party timing" dock="palette" flow={innerWidth <= 1100} onclose={() => (timingOpen = false)}>
          <TimingControls {party} {game} />
        </StudioPanel>
      {/if}

      {#if game.phase === 'lobby' && isHost && setupOpen}
        <!-- Host tools: everything that has to be settled before the first round. -->
        <StudioPanel title="Party setup" label="party setup" dock="palette" flow={innerWidth <= 1100} onclose={() => (setupOpen = false)}>
          <div class="setup">
            <TimingControls {party} {game} />
            <p class="hint">
              Everyone paints every canvas; each owner paints the first and last layer.
              When the timer reaches zero, painters finish their stroke and pass. Nothing is cut off.
            </p>
            <fieldset class="modes">
              <legend>Passing order</legend>
              {#each ['seats', 'random', 'custom'] as const as mode (mode)}
                <label><input type="radio" name="order-mode" checked={game.orderMode === mode} disabled={mode === 'custom' && game.orderMode !== 'custom'} onchange={() => party.send({ type: 'setOrderMode', mode })} /> {ORDER_LABELS[mode]}</label>
              {/each}
            </fieldset>
            <p class="hint">Canvases pass to the next person on the list (to your left around the room). The last person passes back to the first.{game.orderMode === 'random' ? ' The circle is shuffled once, so everyone still paints every canvas.' : ''} Moving someone makes the order custom.</p>
            <ol class="order" aria-label="Passing order">
              {#each game.order as id, index (id)}
                <li>
                  <span class="place" aria-hidden="true">{index + 1}</span>
                  <span class="name">{nameOf(id)}{id === party.youId ? ' (you)' : ''}<small>{seatOf(id)}</small></span>
                  <button type="button" aria-label={`Move ${nameOf(id)} earlier`} disabled={index === 0} onclick={() => move(id, -1)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
                  </button>
                  <button type="button" aria-label={`Move ${nameOf(id)} later`} disabled={index === game.order.length - 1} onclick={() => move(id, 1)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </li>
              {/each}
            </ol>
            <label>Invite link
              <input type="text" readonly value={inviteUrl} onfocus={(event) => event.currentTarget.select()} />
            </label>
            <button type="button" onclick={copyInvite}>Copy invite link</button>
            {#if inviteStatus}<p class="hint" role="status">{inviteStatus}</p>{/if}
            <button type="button" class="primary" onclick={() => party.send({ type: 'start' })}>Start the game</button>
          </div>
        </StudioPanel>
      {/if}

      {#if notesOpen}
        <StudioPanel title="Notepad" label="party notes" dock="notes" flow={innerWidth <= 1100} onclose={() => (notesOpen = false)}>
          <ChatNotepad {party} />
        </StudioPanel>
      {/if}

      <PartyRadio {party} open={radioOpen} compact={innerWidth <= 1100} onclose={() => (radioOpen = false)} />

      {#if guestsOpen}
        <StudioPanel title="Around the table" label="guests" dock="guests" flow={innerWidth <= 1100} onclose={() => (guestsOpen = false)}>
          <ul class="guests">
            {#each [...game.order, ...game.members.filter((m) => !game.order.includes(m.id)).map((m) => m.id)] as id (id)}
              {@const member = game.members.find((m) => m.id === id)}
              {#if member}
                <li>
                  <VideoTile
                    name={member.name}
                    away={member.away}
                    you={member.id === party.youId}
                    host={member.isHost}
                    painting={game.phase === 'painting' && !!game.assignments[member.id] && !game.passed.includes(member.id)}
                    track={member.id === party.youId
                      ? call.camOn && call.status === 'in-call'
                        ? call.localVideo
                        : null
                      : call.videos.find((v) => v.identity === member.id)?.track ?? null}
                    speaking={member.id !== party.youId && call.videos.find((v) => v.identity === member.id)?.speaking}
                    look={member.presence === 'avatar' ? party.looks[member.id] ?? null : null}
                    color={INITIALS_COLORS[member.initialsColor]?.fill}
                  />
                </li>
              {/if}
            {/each}
          </ul>
        </StudioPanel>
      {/if}
    </div>
  {:else}
    <p class="loading">Pulling up a chair…</p>
  {/if}

  {#if view !== 'gallery'}
    <CallDock {call} inRoom={view === 'room'} elsewhere={holdsCall ? null : callDevice} onToggleRoom={() => (view = view === 'paint' ? 'room' : 'paint')} onDevices={() => { view = 'paint'; openDevices(true); }} onLeave={leave} />
  {/if}

  {#if game?.phase === 'passing'}
    <div class="pass" role="alertdialog" aria-labelledby="pass-title">
      <div class="card">
        <p class="hand">Round {game.round} done!</p>
        <h2 id="pass-title">{game.round >= game.totalRounds ? 'Bringing the canvases home' : 'Pass to your left'}</h2>
      </div>
    </div>
  {/if}

  {#if game?.phase === 'reveal' && revealOpen && view === 'paint'}
    {@const detail = party.piece(detailId)}
    <div class="pass" role="dialog" aria-modal="true" aria-labelledby="reveal-title">
      <div class="card reveal" tabindex="-1" use:focusOnOpen>
        {#if detail}
          {@const history = party.histories[detail.id]}
          <button type="button" class="plain back" onclick={() => (detailId = null)}>All the pieces</button>
          <h2 id="reveal-title">{detail.ownerId === party.youId ? 'Your piece' : `${detail.ownerName}'s piece`}</h2>
          <p class="credit">{credit(detail)}</p>
          {#if history?.complete && history.strokes.length}
            {#key history}
              <TimeLapse strokes={history.strokes} width={detail.width} height={detail.height} {names} turns={detail.turns} />
            {/key}
          {:else if finalUrl(detail)}
            <img src={partyUrl(finalUrl(detail) ?? '')} alt={`Finished piece: ${credit(detail)}`} />
          {:else}
            <p>Loading the piece…</p>
          {/if}
          <div class="reveal-actions">
            {#if finalUrl(detail)}<a href={partyUrl(finalUrl(detail)!)} download={`pass-the-canvas-${detail.ownerName}.png`}>Download full size</a>{/if}
          </div>
        {:else}
          <h2 id="reveal-title">You made {revealPieces.length === 1 ? 'this' : 'these'} together.</h2>
          <ul class="pieces">
            {#each revealPieces as piece (piece.id)}
              <li>
                <button type="button" class="piece" onclick={() => openDetail(piece)} aria-label={`Open ${piece.ownerName}'s piece: ${credit(piece)}`}>
                  {#if finalUrl(piece)}<img src={partyUrl(finalUrl(piece)!)} alt="" />{:else}<span class="saving">Saving…</span>{/if}
                  <span class="owner">{piece.ownerId === party.youId ? 'Yours' : piece.ownerName}</span>
                </button>
                <p class="credit">{credit(piece)}</p>
              </li>
            {/each}
          </ul>
          {#if game}
            <section class="keep" aria-labelledby="keep-title">
              <h3 id="keep-title">Keep tonight's gallery</h3>
              {#if game.archive.id}
                <p>Saved. Anyone with this link can see the pieces, everyone's names and the time-lapses.</p>
                <div class="link-row">
                  <input type="text" readonly value={archiveLink} aria-label="Gallery link" onfocus={(e) => e.currentTarget.select()} />
                  <button type="button" class="dark" onclick={() => copyText(archiveLink, 'Gallery link copied.')}>Copy link</button>
                </div>
                {#if deleteLink}
                  <p class="hint">Your private delete link. Keep it to yourself; it's shown only to you, only now.</p>
                  <div class="link-row">
                    <input type="text" readonly value={deleteLink} aria-label="Private delete link" onfocus={(e) => e.currentTarget.select()} />
                    <button type="button" class="plain" onclick={() => copyText(deleteLink, 'Delete link copied. Keep it somewhere safe.')}>Copy</button>
                  </div>
                {/if}
                {#if archiveStatus}<p class="hint" role="status">{archiveStatus}</p>{/if}
              {:else if !game.archive.available}
                <p class="hint">Saving galleries isn't switched on for this party server yet.</p>
              {:else if me?.isHost}
                <p class="hint">Saves the finished pieces, the artists' names and the time-lapses behind a link you can share. Never video, audio or notes. You'll get a private link to delete it any time.</p>
                <button type="button" class="dark" disabled={game.archive.saving} onclick={() => party.send({ type: 'saveArchive' })}>
                  {game.archive.saving ? 'Saving…' : 'Save a shareable gallery'}
                </button>
                {#if game.archive.error}<p class="hint" role="alert">{game.archive.error}</p>{/if}
              {:else}
                <p class="hint">{game.archive.saving ? 'The host is saving a shareable gallery…' : 'The host can save a shareable gallery of these pieces.'}</p>
              {/if}
            </section>
          {/if}
        {/if}
        <div class="reveal-actions">
          {#if artwork.length}<button type="button" class="dark" onclick={() => (view = 'gallery')}>Hang them in the gallery</button>{/if}
          <button type="button" class="plain" onclick={() => (revealOpen = false)}>Back to the table</button>
        </div>
      </div>
    </div>
  {/if}

  {#if party.reconnecting}
    <p class="reconnecting" role="status">Connection lost. Reconnecting… your seat and canvas are saved.</p>
  {/if}
  <div class="sr-only" aria-live="polite">{party.announcement}</div>
</div>


<style lang="scss">
  @use '../styles/tokens' as *;
  @use '../styles/mixins' as *;

  .studio {
    @include walnut-table;
    min-height: 100dvh;
  }

  .viewpoint {
    position: fixed;
    top: 0.75rem;
    left: 50%;
    translate: -50% 0;
    z-index: 20;
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: $radius-pill;
    background: rgb(24 16 11 / 0.85);

    button {
      min-height: $tap-min;
      padding: 0 1rem;
      border: 0;
      border-radius: $radius-pill;
      background: transparent;
      color: $cream;

      &[aria-pressed='true'] {
        background: $cream;
        color: $walnut-900;
        font-weight: 700;
      }
    }
  }

  .table[hidden] {
    display: none;
  }
  .reconnecting {
    position: fixed;
    top: 0.75rem;
    left: 50%;
    translate: -50% 0;
    z-index: 40;
    margin: 0;
    padding: 0.625rem 1rem;
    border-radius: $radius-pill;
    background: $cream;
    color: $walnut-900;
    font-weight: 700;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.4);
  }

  .loading {
    margin: 0;
    padding: 2rem;
  }

  .party-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;

    > button:not(.primary) {
      min-height: $tap-min;
      padding: 0 0.875rem;
      border: 1px solid #9d8c67;
      border-radius: 4px;
      background: #1c150fe8;
      color: $cream;

      &[aria-pressed='true'] {
        background: #e8ddbc;
        color: #21160d;
      }
    }

    .badge {
      display: inline-grid;
      place-items: center;
      min-width: 1.375rem;
      height: 1.375rem;
      margin-left: 0.375rem;
      padding: 0 0.25rem;
      border-radius: 999px;
      background: $cadmium-orange;
      color: #21160d;
      font-size: 0.75rem;
      font-weight: 700;
    }
  }

  .tape {
    @include tape-label;
    margin: 0;
    font-size: 1.25rem;
  }

  .round,
  .note {
    margin: 0;
  }

  .note {
    font-size: 0.875rem;
    color: $cream-muted;
  }


  .primary {
    min-height: $tap-min;
    padding: 0 1.125rem;
    border: 0;
    border-radius: $radius-pill;
    background: $cream;
    color: $walnut-900;
    font-weight: 700;
  }

  // A row of small tiles across the top-right, above the brush rail.
  .setup {
    display: grid;
    gap: 0.75rem;

    label {
      display: grid;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 700;
    }
    select {
      min-height: $tap-min;
      font: inherit;
      font-weight: 400;
      color: $cream;
      background: #1c150f;
      border: 1px solid #9d8c67;
      border-radius: 4px;
      padding: 0 0.5rem;
    }
    input {
      min-height: $tap-min;
      padding: 0 0.5rem;
      font: inherit;
      font-weight: 400;
      color: $cream;
      background: #17100c;
      border: 1px solid #9d8c67;
      border-radius: 4px;
    }
    > button:not(.primary) {
      min-height: $tap-min;
      border: 1px solid #9d8c67;
      border-radius: 4px;
      background: transparent;
      color: $cream;
    }
    .hint {
      margin: 0;
      font-size: 0.8125rem;
      color: $cream-muted;
    }
  }

  .order {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.25rem;

    li {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .place {
      width: 1.5rem;
      font-weight: 700;
      color: $cream-muted;
    }
    .name {
      flex: 1;

      small {
        color: $cream-muted;
      }
    }
    button {
      width: $tap-min;
      min-height: $tap-min;
      display: grid;
      place-items: center;
      border: 1px solid #84714e;
      border-radius: 4px;
      background: transparent;
      color: $cream;

      &:disabled {
        opacity: 0.35;
      }
    }
    svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
  }

  // At zero the pass button gently draws the eye; no alarm, no motion if reduced.
  .nudge {
    box-shadow: 0 0 0 3px $cadmium-orange;

    @media (prefers-reduced-motion: no-preference) {
      animation: nudge 2.4s ease-in-out infinite;
    }
  }

  @keyframes nudge {
    50% {
      box-shadow: 0 0 0 6px rgb(232 116 42 / 0.45);
    }
  }

  .guests {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 6.5rem;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;

    li {
      font-size: 0.8125rem;
    }
  }

  .pass {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    background: rgb(20 13 9 / 0.72);

    .card {
      max-width: 32rem;

      &.reveal {
        max-width: min(46rem, 100%);
        transform: none;
      }
      &:focus {
        outline: none;
      }
      max-height: calc(100dvh - 2.5rem);
      overflow: auto;
      padding: 1.75rem 2rem;
      background: $paper;
      color: $walnut-900;
      transform: rotate(-1deg);
      box-shadow: 0 30px 60px rgb(0 0 0 / 0.55);
    }
    .hand {
      margin: 0;
      font-family: $font-hand;
      font-size: 1.875rem;
      color: #8a3b12;
    }
    h2 {
      margin: 0.25rem 0 1rem;
      font-size: 2rem;
    }
    img {
      display: block;
      width: 100%;
      margin-bottom: 1rem;
    }
    a {
      color: $walnut-900;
      font-weight: 700;
    }
  }

  .credit {
    margin: 0.25rem 0 0.75rem;
    font-size: 0.9375rem;
  }

  .back {
    min-height: $tap-min;
    margin-bottom: 0.5rem;
    padding: 0 0.5rem;
    border: 0;
    background: transparent;
    color: $walnut-900;
    text-decoration: underline;
  }

  .pieces {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: 1rem;

    .credit {
      font-size: 0.8125rem;
    }
  }

  .piece {
    width: 100%;
    display: grid;
    gap: 0.375rem;
    padding: 0;
    border: 0;
    background: transparent;
    color: $walnut-900;
    text-align: left;
    cursor: pointer;

    img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: contain;
      margin: 0;
      background: #e1dfda;
      border: 8px solid #6b4426;
    }
    .saving {
      display: grid;
      place-items: center;
      aspect-ratio: 4 / 3;
      background: #e1dfda;
    }
    .owner {
      font-weight: 700;
    }
    &:focus-visible {
      outline: 3px solid $focus;
      outline-offset: 2px;
    }
  }

  .inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;

    select {
      min-height: $tap-min;
      font: inherit;
      color: $cream;
      background: #1c150f;
      border: 1px solid #9d8c67;
      border-radius: 4px;
    }
  }

  .whose {
    display: block;
    font-size: 0.8125rem;
    color: $cream-muted;
  }

  .modes {
    border: 0;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;

    legend {
      font-weight: 700;
      font-size: 0.875rem;
      margin-bottom: 0.25rem;
    }
    label {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      min-height: $tap-min;
      font-weight: 400;
    }
    input {
      width: 1.125rem;
      height: 1.125rem;
      accent-color: $cadmium-orange;
    }
  }


  .reveal-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;

    button,
    a {
      min-height: $tap-min;
      display: inline-flex;
      align-items: center;
    }
    .dark {
      padding: 0 1.125rem;
      border: 0;
      border-radius: $radius-pill;
      background: $walnut-900;
      color: $cream;
      font-weight: 700;
    }
    .plain {
      padding: 0 0.5rem;
      border: 0;
      background: transparent;
      color: $walnut-900;
      text-decoration: underline;
    }
  }

  // Keep tonight's gallery (archive), under the pieces in the reveal.
  .keep {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px dashed #b9a483;
    border-radius: $radius-sm;
    color: $walnut-900;

    h3 {
      margin: 0 0 0.5rem;
      font-size: 1.0625rem;
    }
    p {
      margin: 0 0 0.75rem;
    }
    .hint {
      font-size: 0.9375rem;
    }
    .link-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    input {
      flex: 1 1 16rem;
      min-height: $tap-min;
      padding: 0 0.75rem;
      border: 1px solid #b9a483;
      border-radius: $radius-sm;
      background: #fffaf0;
      color: $walnut-900;
    }
    button {
      min-height: $tap-min;
      padding: 0 1.125rem;
      border-radius: $radius-pill;
      font-weight: 700;
    }
    .dark {
      border: 0;
      background: $walnut-900;
      color: $cream;
      &:disabled {
        opacity: 0.6;
      }
    }
    .plain {
      border: 1px solid #b9a483;
      background: transparent;
      color: $walnut-900;
    }
    button:focus-visible,
    input:focus-visible {
      outline: 3px solid $focus;
      outline-offset: 2px;
    }
  }
</style>
