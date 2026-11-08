# Phase 1: LiveKit setup and shared painting test

Phase 1 stays open until two people on different computers paint the same
canvas while on a video call, with the room visible. A credential check or two
tabs on one computer does not pass that gate.

## 1. Create the LiveKit Cloud project

1. Sign in at [LiveKit Cloud](https://cloud.livekit.io/) and create a project
   for Pass the Canvas testing. Review any plan or billing choice yourself.
2. Open the project's **Settings → Keys**. Create/copy its API key and secret,
   and copy the project's WebSocket URL from the dashboard.
3. At the repository root, create the local environment file **only if it does
   not already exist**:

   ```bash
   test -f apps/server/.env || cp apps/server/.env.example apps/server/.env
   chmod 600 apps/server/.env
   ```

4. Edit `apps/server/.env` locally and fill `LIVEKIT_URL`, `LIVEKIT_API_KEY`
   and `LIVEKIT_API_SECRET`. All three must belong to the same project. Keep
   the URL's `wss://` prefix. This file is ignored by Git; do not paste secrets
   into chat, screenshots, frontend variables or source files.
5. Run `npm run check:livekit` from the repository root. It makes a read-only
   room-list request to verify the credentials, discards the response and prints
   no room names, tokens or credential values. Failure exits with status 1.
6. Restart `npm run dev` after editing the environment file. Open
   `http://localhost:5173/?party=phase-one-test` for the local browser check.

Provider references: [project/key setup](https://livekit.com/blog/mini-tutorial-setting-up-a-livekit-cloud-project),
[current key location](https://community.livekit.io/t/where-to-find-the-livekit-api-key-and-secret/92).

## 2. Prepare two-computer access

Both guests must open the same frontend origin and `?party=phase-one-test`
link. For a same-computer smoke test, localhost works. A second computer's
localhost refers to itself; a plain HTTP LAN address generally cannot access
camera/microphone because browsers require a secure context.

Before the real gate, provide a trusted HTTPS test origin forwarding **all**
frontend traffic through the running Vite server, including `/api`, `/party`
WebSocket upgrades and `/snapshots`. Vite already proxies those paths to the
local party server on port 8787. Choose and configure that access method
separately; do not expose the development editors. Start the local server with
`SPOTS_EDITOR=0` before sharing access. If a tunnel is used, configure only its
exact trusted hostname in Vite rather than disabling host checking globally.

The current [party origin helper](../apps/web/src/lib/party/origin.ts) uses
`VITE_PARTY_URL`, falling back to `VITE_ACCOUNT_API_URL`, for party WebSockets,
video tokens and snapshots. With neither variable it uses the frontend origin.
For a hosted test, verify the built frontend points to the intended reachable
HTTPS party server, that WebSocket upgrades and allowed origins work, and that
LiveKit is configured there. Current deployed routing and credentials have not
been verified by this checklist. The older multiplayer section of
PUBLIC-DEPLOYMENT.md predates this helper.

## 3. Run the browser checks

- Join the same party using two different guest names and camera presence.
  Allow camera and microphone. Confirm each person hears the other and sees
  their camera; use headphones to avoid feedback.
- Toggle each microphone off/on. Confirm the other person hears silence/speech
  and the button's accessible name/state follows the change.
- Toggle each camera off/on. Confirm the other person sees the initials card
  and then live video, including in a selected room seat.
- Join once with avatar presence. Confirm no camera/microphone prompt occurs,
  the initials card is usable, and the guest can still watch and paint.
- Use **Start the game** as host. Each participating artist paints the canvas
  assigned to them in the simultaneous round. Draw a recognizable mark, pass it,
  and confirm it arrives on the next computer. A watcher must not add marks.
- Use **Pass the canvas** and confirm the next round assigns the expected canvas
  to each artist. Confirm earlier marks remain. Rejoin after a round snapshot
  and check existing art; a new join after the start currently becomes a watcher.
- Switch to **Room view**, choose seats and pan the room. Verify camera/avatar
  markers and the call while the room is visible. Return to the canvas.
- Leave one guest's party. Confirm their camera/mic stop and their tile clears
  on the other computer. Rejoin and check the call again.
- Linked devices: on a laptop, **Menu → Use another device → Paint on a
  tablet**. Scan the QR code with an iPad (and once by typing the code at
  `/?link`). Confirm the iPad paints, the laptop mirrors the strokes and keeps
  the video, the other guest sees one artist (not two), and **Pass the canvas**
  on the laptop passes from the iPad. Try **Room and video on a phone**, then
  **Paint on this device** / **Room and video on this device** and **Unlink**.
- Two windows: **Open the canvas in its own window** on a desktop; drag it to a
  second screen. Paint in it while the room window shows the video.
- Reconnect: lock the iPad or turn wifi off for ~20 s mid-round. Confirm the
  "Reconnecting…" banner, then the same seat and canvas. Over a minute: the
  other computer shows "(away)"; coming back still works within 15 minutes.
  Reload a tab: it returns without the join form.
- Repeat controls with keyboard only, inspect names/states using VoiceOver,
  and check 360px and 1440px widths plus reduced motion. Test physical touch
  on a real device; record any untested combination explicitly.

Do not record video/audio. Record only pass/fail notes, browser/device names,
date, and any art screenshots the testers agree to keep. The timer reaching zero
is a finish cue. Artists use **Pass the canvas**, and the host can use
**Pass everyone on**. Confirm this handoff and final-stroke preservation.

## Evidence and roadmap updates

This checklist provides setup and test steps. It makes no assertion about the
current environment file or credentials. No fresh live-provider or real
two-computer result is recorded by the November 8 source review. The Phase 1
gate remains open. See [PARTY-READINESS.md](PARTY-READINESS.md).

After actual setup, tick the LiveKit setup task in ROADMAP.md. Tick the call task
and mark the Phase 1 gate passed only after the browser test succeeds. Note
remaining real-device/accessibility failures before starting Phase 2.
