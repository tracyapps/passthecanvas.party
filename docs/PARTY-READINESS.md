# Party readiness

Updated November 8, 2026. Linked devices, separate windows, reconnecting and
room self-view are built and tested locally (unit tests plus a multi-browser
Chromium run). Real phones, tablets, a live video call and the Phase 1
two-computer gate are still unverified.

## Current party controls

| Task | Where to find it | Current behavior |
| --- | --- | --- |
| Join | **Join the party**, after choosing **Camera** or **Avatar** | Avatar choices include saved cutouts, a profile photo where available, or initials. [JoinForm](../apps/web/src/lib/party/JoinForm.svelte) |
| Choose a seat | Bottom call dock, **Room view**. The table menu also offers **Pick a seat in the room** in the lobby or **Go to the room** later. | Click a free **Sit here** marker, or use the **Jump to** list's **Sit here / Move here** buttons. Occupied seats are protected by the server. Your own seat shows your camera when it is on. [RoomView](../apps/web/src/lib/room/RoomView.svelte) · [Party server](../apps/server/src/party.ts) |
| Change viewpoint | Room controls, **From your seat / From the middle of the room** | Available when a rendered viewpoint exists for your chosen seat. [Studio](../apps/web/src/lib/Studio.svelte) |
| Paint again | Bottom call dock, **Back to the canvas** | Room and painting switch within the same window. The table stays mounted while hidden so its layers survive the switch. [Studio](../apps/web/src/lib/Studio.svelte) · [CallDock](../apps/web/src/lib/call/CallDock.svelte) |
| See guests while painting | Table menu, **Show guests** | Opens **Around the table**, with camera or avatar tiles. Away guests are dimmed and labeled "(away)". |
| Control presence and sound | **Switch to avatar / Switch to camera** in the party strip. Bottom dock microphone and camera buttons. | Avatar joining starts with camera and mic off. On a device without the call, the dock says where the video is instead. [Call client](../apps/web/src/lib/call/call.svelte.ts) |
| Use another device | Table menu, **Use another device** | **Paint on a tablet** or **Room and video on a phone or laptop** shows a QR code and a 6-character code (works once, 5 minutes). The other device scans it, or opens `/?link` and types it. It joins your seat, not the party as someone new. Move duties with **Paint on this device / Room and video on this device**; **Unlink** removes a device. [DevicesPanel](../apps/web/src/lib/party/DevicesPanel.svelte) · [LinkEntry](../apps/web/src/lib/party/LinkEntry.svelte) |
| Two windows on one computer | Table menu, **Use another device**, **Open the canvas / the room in its own window** (mouse and wide screens) | Same link, opened in a pop-up window you can drag to another screen. |
| Dropped connection | Automatic | "Reconnecting…" banner; the tab rejoins its seat with a private key (1 s, 2 s, 4 s… up to 15 s). A reload rejoins without the join form. Your canvas reloads from the server. [Connection](../apps/web/src/lib/party/connection.svelte.ts) |
| Save data | Call dock, the signal-bars button | Stops downloading guests' video; their avatar or initials show and voices keep playing. A weak connection gets a "turn off guests' video?" offer. |
| Check local devices | Account **Camera & mic check** | Preview, choose camera/microphone/speakers where supported, then **Save these for parties**. Local only; it does not prove remote call delivery. [DevicesPage](../apps/web/src/lib/account/studio/DevicesPage.svelte) |
| Start and pass | **Start the game**, then **Pass the canvas**. Host also has **Pass everyone on** when applicable. | Each artist paints their assigned canvas in a simultaneous round. Pressing **Pass** on a device without the canvas asks the canvas device to finish its stroke and pass. [Protocol](../packages/shared/src/protocol.ts) |

## How linked devices work (server rules)

- One artist can have up to 4 devices. The server gives **the canvas** to one
  device (only its strokes and snapshots count) and **the call** to one device
  (only it joins LiveKit, since the member id is the LiveKit identity).
- Other devices mirror your canvas live and can use every other control.
- A device that drops keeps its duties for 45 s. After that they move to one of
  your devices that is here. With none here you are **away**: you sit out the
  next round, the host role moves on, and after 2 min (lobby) or 15 min
  (game) you leave the party. Env: `DEVICE_GRACE_SECONDS`, `LOBBY_AWAY_SECONDS`,
  `GAME_AWAY_SECONDS`.
- Each device has its own rejoin key (only a hash is stored). Keys live in the
  tab's `sessionStorage`. **Leave the party** frees your seat at once.
- Code guessing is slowed: 20 tries per address per 10 minutes.

## Verified (Nov 8, local)

- `npm test`: 12 party-server tests (reconnect, away, wrong key, duplicate
  tab, leave, link once only, canvas/call duties, mirroring, pass request,
  duty fallback, unlink) plus link-code and device-label tests.
- Chromium, 3–4 browsers on one party: link by typed code (iPad emulation),
  code reuse refused, start, reload rejoins without the join form, pass from
  the laptop passes on the iPad, room window via **Open the room in its own
  window**, phone-width panel (no sideways scroll), dropped socket shows the
  banner and recovers, away label after the grace period.
- With a local LiveKit dev server and fake cameras: two-way video, your own
  camera at your seat in the room, **Save data** dropping and restoring guest
  video, and linking a room-and-video device (the laptop leaves the call, the
  new device joins, the other guest still sees one video for that artist).
- Hosted: `ptcserver-production.up.railway.app` answers `/health`, mints
  LiveKit tokens, accepts the party WebSocket from `https://passthecanvas.party`
  and refuses other origins; the live site points at that server. The hosted
  server runs the **previous** code until this change is pushed and deployed.

## Still open before launch

- **Real hardware.** QR scanning, iPad Pencil painting while video runs on a
  laptop or phone, phone sleep/wake reconnects, and a real LiveKit call with
  two people. Use [PHASE-1-TEST.md](PHASE-1-TEST.md).
- **Screen readers**: duty changes and reconnects are announced through the
  party live region; check with VoiceOver.
- Strokes painted while a device is offline are lost (the server's history is
  the source of truth on rejoin).
