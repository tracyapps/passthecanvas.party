# Decisions

A running log. Newest first. One line for small calls, a short paragraph for big ones. Agents: add an entry when you make a choice someone might later ask "why?" about.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-28 | Repair the owner's two studio files in place, preserving geometry and camera transforms; keep a native 3D master and a separate photo-cutout experiment | Broken normal wiring caused the black hardwood render; Image Empties caused missing photos. Restore the floor normal, replace four placed references with alpha planes, separate rug/furniture toggles, remove only unused items, add warm practical lights and modest original finishes. Retain the supplied before-cleanup backups; app integration and new spot alignment remain separate. |
| 2026-10-27 | Cream City room exploration is a separate, editable Blender draft: shared 11 × 8 m shell, lime/daylight, red/afternoon and charcoal/evening scenes, plus review and equirectangular renders | The owner asked for a warmer, larger studio and editable bones. HDRIs are flat photos, so architecture is modelled and downloaded Poly Haven scans supply textures and several props. Owner PNGs remain hidden references; cats and some furniture are labelled maquettes. No app panorama or spot coordinates are replaced until the room is chosen and alignment is verified. |
| 2026-10-26 | Paint box: 13 media in three groups (wet brushes, dry media, blenders); `wash` renamed to `watercolor` | No users yet, so renaming was free; the name says what it does. Acrylic carries a `viscosity` setting (0 runny – 1 buttery) that changes width and opacity. |
| 2026-10-26 | Wet tools (water, finger) work on canvas pixels: smudge = drawing the canvas onto itself with low alpha; dilute = `destination-out` fill | Water "dilutes paint" by making it more transparent (never erases the paper, which lives behind the canvas), and the self-drawImage smudge is the cheap smooth smear behind finger blending. Both replay identically on every screen because everyone has the same pixels at that point. |
| 2026-10-26 | All grain/spray/speckle stays seeded from position, never `Math.random()` | Charcoal grain, pastel chalk, airbrush spray and sponge holes must draw identically when replayed on another guest's screen; a test locks this in. |
| 2026-10-26 | Paint mixing = weighted average with a slight darkening (×0.98) | Real pigment mixing is subtractive; this is the honest first approximation until it feels wrong in play. Mixing lives on the palette: toggle "Mix a color", tap two paints, tap the result. |
| 2026-10-26 | Arrow-key panning in the room is **focus-gated**: keyboard control switches on when the room is focused (it's a tab stop), off when focus leaves | Photo Sphere Viewer listens for arrow keys on the window; with `keyboard: 'always'` it would hijack arrows for the whole page. Focus-gating keeps the promise ("arrow keys pan") without side effects. |
| 2026-10-26 | `/api/token` accepts the party **member id** as the LiveKit identity | Video tiles map to guests with no extra bookkeeping — `participant.identity === member.id`. |
| 2026-10-26 | The call fails soft: no LiveKit keys → the dock shows "Video is not set up on the server yet" and the party carries on | Painting, turns and chat must never depend on video being configured. |
| 2026-10-26 | Call UI: dark dock (mic, camera, room/canvas, leave) + one video tile per guest in "Around the table"; camera-off or avatar guests get an initials card | The design canvas's dock; avatar stays an equal citizen, not a downgrade. Leave closes the call + party socket and returns to the join screen. |
| 2026-10-26 | Every new `snapshotUrl` from the server is drawn over the canvas on all clients | Late joiners get history; everyone gets drift correction after each round. |
| 2026-10-26 | Primary domain **passthecanvas.party**; keep **passthe.art** for short share links to finished pieces (phase 4) | The game's name is the domain, and `.party` says what it is. `passthe.art` is short and great for sharing art. |
| 2026-10-26 | npm workspaces monorepo: `apps/web`, `apps/server`, `packages/shared` | Boring, built in, no extra tooling |
| 2026-10-26 | Svelte 5 + Vite + SCSS front end | Components are mostly HTML/SCSS; least JS ceremony for the owner |
| 2026-10-26 | Party server: Node + `ws`, TypeScript | Small and readable; the same language as the front end |
| 2026-10-26 | Canvas sync by **strokes**, snapshot per round | Tiny messages, free replay, simple late-join |
| 2026-10-26 | Room = baked equirectangular panorama + HTML overlays (Photo Sphere Viewer) | Photoreal Blender quality at the cost of one image; works on phones |
| 2026-10-25 | Assets from Poly Haven (CC0), built in Blender with the Patreon add-on | Exactly the look wanted; free for commercial use |
| 2026-10-25 | Video via LiveKit (Cloud first, self-host later) | Open source (Apache 2.0); free tier to start |
| 2026-10-25 | Radio: Radio Browser directory, each client streams directly | Avoids rebroadcasting music (licensing) |

## Open questions

- [ ] **Cats:** filmed clips or rendered 3D loops? Whose cats star?
- [ ] **Video provider:** stay on LiveKit Cloud's free tier for how long?
- [ ] **Party size:** max guests per party (sets spots in the room and video cost)
- [ ] **Where you stand:** always the center, or a panorama per spot (phase 4)?
- [ ] **Take-home:** file only, or a print partner? Who?
- [ ] **Captions provider** for live captions
- [ ] **Hosting** for the party server (small VPS vs Fly.io vs Render)

### 2026-10-28 — Beanbag mosaic pendant and sunset

Added an original three-globe mosaic pendant to the latest owner-edited photo
layout, preserving existing transforms. The pendant has one parent move handle
and actual warm point lights. A separate procedural sunset collection appears
only in the red/afternoon scene; disabling it restores the existing exterior.
No product-photo pixels or additional external dependencies are used.

### 2026-10-28 — Graffiti and transmitting sconce glass

Retained the owner's latest photo layout while refining red-scene graffiti
with packed OFL Bangers text, layered outlines and procedural gradient paint.
Separated the caged sconces' two glass islands from their opaque scanned metal
material; internal bulbs and lights now follow the correct fixture, including
the third duplicate. Shadow-ray transparency provides stable practical lighting
without refractive-caustic rendering. Turkish-lamp colour remains a subtle tint.

### 2026-10-28 — Purple neon readability

Changed the red-scene accent-wall script to purple emission at 1.7 strength,
with a smaller bevel to preserve fine letter gaps. Matching purple wall wash
and three redirected, slightly shifted track lights reduce white light on the
sign. The owner's text, font, sign transform and all other layout transforms
are preserved. Other scene looks retain their existing lights and neon.

### 2026-10-28 — Cream City room is the live panorama

Each room lives in its own folder, `apps/web/public/studio/<room>/`, holding
`panorama.webp` and `spots.json`. The current room is `cream-city`, built from
the owner's `studio/blender/panoramic-v3.webp` render (4096×2048 WebP — PNG at
this size is far heavier and the EXR is for relighting, not the web). The
placeholder HDRI folder stays as a fallback. Re-exporting from Blender later
means overwriting one file in that folder, nothing else.

### 2026-10-28 — Spots editor at `?spots=<room>`

Spot coordinates come from clicking the real panorama, not from guessing
numbers. The editor page (`SpotsEditor.svelte`) loads a room, aims a form at
whatever yaw/pitch you click (PSV reports yaw 0–360; spots.json speaks
−180–180, so it normalizes), and saves via `PUT /api/spots/:room`. The server
validates with the shared `sanitizeSpots()` (safe ids, max 64 spots, clamped
angles) and writes atomically. **Dev-only tool: it is disabled with
`SPOTS_EDITOR=0` and must stay off (or behind owner auth) before the server is
ever public.** Multiple scenes later = more folders, same editor.

### 2026-10-28 — Sitting down: spot picking and seat markers

Free spots render as "· Sit here" pill markers in the room and as a
keyboard-friendly "Jump to" list beside it (equal paths, one is not the
fallback). Sitting sends `takeSpot` to the party server, which owns who sits
where. A seated guest appears at their spot as a paper-framed marker with
their LiveKit camera feed when it's available, and their initials on a taped
card when it isn't — the avatar stays a first-class look, not a downgrade.

### 2026-10-28 — Demo seating for judging the room

`?demo=seats` fills the room with fake guests — some with a fake video track
(a painted canvas captured as a real MediaStreamTrack, so it flows through
the exact `<video>` path a LiveKit camera will use), some with the initials
card. Nothing connects, nothing is saved. The owner uses it to judge seat
spacing and framing before LiveKit keys exist.

### 2026-10-28 — Wall art regions: art.json + flat editor at `?art=<room>`

Each room can carry an `art.json` next to its `spots.json`: named boxes
(yaw/pitch center + angular width/height) marking every blank canvas on the
walls, for the planned feature that hangs each party's artwork there and
exports a social photo plus a shareable pan-able room. The editor draws on
the **flat equirectangular panorama** — the same rectangle-on-image way of
thinking as masking in Photoshop — rather than in the 3D view, because a
straight drag is the simplest honest way to say "this rectangle on this
wall"; the 3D-correct hang (with perspective) comes with the feature itself.
Saved via dev-gated `PUT /api/art/:room` (same SPOTS_EDITOR switch as spots).

### 2026-10-28 — Art boxes became warpable quads

Rectangles (center + size) can't follow how the flattened panorama skews a
canvas, so a box is now four corner points (yaw/pitch each). In the editor
the selected box shows corner handles (drag one to warp), edge handles
(resize) and a body drag (move); arrows nudge a focused corner or the whole
box. The sanitizer unwraps corners around the back seam, so a canvas that
straddles yaw ±180 stays one connected quad. The four-point model is also
exactly what corner-pinning real artwork onto the 3D wall will need.
