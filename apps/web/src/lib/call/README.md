# Video and audio (LiveKit)

Phase 1 task. Status: **1–4 built** (`call.svelte.ts`, `CallDock.svelte`, `VideoTile.svelte`); step 5 shows your own camera at the table spot until spot picking lands in phase 3. Plan:

1. `GET /api/token?party=<id>&name=<name>&identity=<memberId>` on the party server returns `{ token, url }`.
2. `livekit-client`: `new Room()` → `room.connect(url, token)` → publish camera and mic.
3. `CallDock.svelte`: mic / camera toggles (`aria-pressed`, label changes "Mute microphone" / "Unmute microphone").
4. `VideoTile.svelte`: attaches a participant's track to a `<video>`; initials card when the camera is off or presence is avatar.
5. In the 360° room, a guest's tile renders inside their spot's marker.

Rules: never record. Avatar is a full option, not a downgrade. If LiveKit isn't configured, the dock says so and the party continues without video.
