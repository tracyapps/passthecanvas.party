# Party readiness

November 8, 2026 source review. The controls below exist in the repository. This review did not check credentials, deployed services or a live call. Real-device performance, accessibility and the Phase 1 two-computer gate remain unverified.

## Current party controls

| Task | Where to find it | Current behavior |
| --- | --- | --- |
| Join | **Join the party**, after choosing **Camera** or **Avatar** | Avatar choices include saved cutouts, a profile photo where available, or initials. [JoinForm](../apps/web/src/lib/party/JoinForm.svelte) |
| Choose a seat | Bottom call dock, **Room view**. The table menu also offers **Pick a seat in the room** in the lobby or **Go to the room** later. | Click a free **Sit here** marker, or use the **Jump to** list's **Sit here / Move here** buttons. Occupied seats are protected by the server. [RoomView](../apps/web/src/lib/room/RoomView.svelte) · [Party server](../apps/server/src/party.ts) |
| Change viewpoint | Room controls, **From your seat / From the middle of the room** | Available when a rendered viewpoint exists for your chosen seat. [Studio](../apps/web/src/lib/Studio.svelte) |
| Paint again | Bottom call dock, **Back to the canvas** | Room and painting switch within the same window. The table stays mounted while hidden so its layers survive the switch. [Studio](../apps/web/src/lib/Studio.svelte) · [CallDock](../apps/web/src/lib/call/CallDock.svelte) |
| See guests while painting | Table menu, **Show guests** | Opens **Around the table**, with camera or avatar tiles. It starts open on wide screens. [Studio](../apps/web/src/lib/Studio.svelte) |
| Control presence and sound | **Switch to avatar / Switch to camera** in the party strip. Bottom dock microphone and camera buttons. | Avatar joining starts with camera and mic off. Switching to camera also enables the mic if muted. Switching to avatar preserves the existing mic state. [Call client](../apps/web/src/lib/call/call.svelte.ts) |
| Check local devices | Account **Camera & mic check** | Preview, choose camera/microphone/speakers where supported, then **Save these for parties**. This checks the local devices and does not prove remote call delivery. [DevicesPage](../apps/web/src/lib/account/studio/DevicesPage.svelte) |
| Start and pass | **Start the game**, then **Pass the canvas**. Host also has **Pass everyone on** when applicable. | Each artist paints their assigned canvas in a simultaneous round. Zero is a finish cue. The server owns assignments and passing. [Studio](../apps/web/src/lib/Studio.svelte) · [Protocol](../packages/shared/src/protocol.ts) |

## Launch-required gaps

- **Paired devices remain unimplemented.** There is no flow to attach an iPad canvas and laptop or phone room/call to one artist and seat. A normal second browser join receives a fresh member ID and becomes another guest, or a watcher after the game starts. Signing into the same account does not pair party connections. Pairing needs server authorization, one active painting controller, handoff and reconnect behavior. [Party server](../apps/server/src/party.ts) · [Protocol](../packages/shared/src/protocol.ts)
- **Separate room/video and canvas windows remain unimplemented.** The current view toggle shows one at a time. Manually opening the party twice creates two members. A unified participant across split desktop windows or companion hardware needs explicit support. Earlier standalone toolbox windows are paused and removed from the current painting UI.
- **Room self-view needs a browser check.** Studio passes the remote-video list to room markers. Its guest panel separately adds the local camera. This suggests your own occupied room seat can display its avatar while your camera is on. Verify and resolve before calling seat video complete. [Studio](../apps/web/src/lib/Studio.svelte) · [Call client](../apps/web/src/lib/call/call.svelte.ts)
- **Hosted reachability needs live verification.** Source supports a party-server origin through `VITE_PARTY_URL`, with `VITE_ACCOUNT_API_URL` fallback. This establishes routing capability, while deployed configuration, WebSocket reachability, LiveKit and camera permissions still require testing. [Origin helper](../apps/web/src/lib/party/origin.ts)

Use [PHASE-1-TEST.md](PHASE-1-TEST.md) to record two-computer results, followed by a real phone/tablet test of seats, avatar/camera, room/canvas switching, painting, passing and reconnect. Companion and split-window acceptance tests can pass only after those flows exist. [ROADMAP.md](ROADMAP.md) keeps these requirements pending.
