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

### Painting workspace direction — 2026-10-29

The owner supplied five artboards and a first interaction brief. Use the photos,
silhouettes and dimensional canvas as the painting-view visual target; button
styles remain provisional. Separate physical tool, medium and paint load in the
design model, with standalone eraser/dry texture sponge. Timer expiry should
gently cue a pass rather than forcibly stop painting. Collage and mnemonic tool
shortcuts move to v2; keyboard accessibility does not. See
[PAINTING-WORKSPACE.md](PAINTING-WORKSPACE.md) for proposed behavior and delivery
gates. These are design requirements, not implemented protocol changes.

Research/asset extracts stay beside the ignored `_design` sources for review;
tracked docs retain the measurements and handoff. No new dependency, service,
protocol, account storage, or public asset promotion is selected by this round.
Personal online snapshots require a deliberate update to the existing
party-only storage policy before implementation.

### 2026-10-29 — Lean spaces, host hang modes, export preview, share links

The owner chose the layered mechanic: pieces hang on wall quads first, then
overflow "leans" in freeform areas. A lean area is just another quad in
`art.json` with `role: "lean"` — drawn in the same `?art=` editor with the
same corner warp (floor areas need it most), styled dashed-teal, and
show/hide filters separate the two groups so each can be worked on alone.
How many pieces fit a lean area is decided by dimensions at hang time
(`leanLayout.ts`): columns ≈ area shape ÷ piece shape, so two tall canvases
share the spot a landscape takes alone.

The gallery preview (`?demo=art`, or a shared `?gallery=room#g=…`) gets a
host panel: hang mode (walls + overflow / walls only / lean only), piece
count, reshuffle. "Preview export" composes the current view into a PNG —
it copies the viewer's WebGL canvas when the browser allows, else
re-projects the panorama per pixel through PSV's own inverse mapping
(half-res, smoothed), then paints each piece with an affine-subdivided quad
mesh (`quadMesh.ts`). The shareable room link packs the whole arrangement
into the URL hash (base64url JSON, `galleryLink.ts`) — no server storage,
self-contained, and the same shape a server-saved room can use later. The
camera gently swings to face the first piece when an arrangement lands
off-view (instant under reduced motion).

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

### 2026-10-28 — Artwork pinned into the 3D room with a screen-space homography

`?demo=art` hangs a deterministic placeholder painting in every `art.json`
quad, live in the 360° room. Rendering is *corner-pinning, not 3D*: on every
camera move the four corners are projected to screen pixels
(`viewer.dataHelper.sphericalCoordsToViewerCoords`), an 8×8 homography maps
the flat painting onto that quad, and the piece is placed with CSS
`matrix3d(...)` (`apps/web/src/lib/room/homography.ts`, unit-tested). This
buys real perspective for near-wall canvases with zero 3D engine and zero
new dependencies, and it is the same math a video-edit corner-pin uses.
Pieces more than 100° off-view are hidden instead of projected (projection
goes wild at grazing angles). Quads that straddle the yaw ±180 seam are
unwrapped relative to their own first corner before projecting.

Two Svelte 5 lessons worth remembering (they cost a silent white-overlay
bug): Photo Sphere Viewer must be held in `$state.raw` (a deep `$state`
proxy breaks its private fields), and a throw during a component's mount
silently tears down the whole containing `{#if}` block — wrap suspicious
mount code in try/catch while debugging.

### 2026-10-28 — Art boxes became warpable quads

Rectangles (center + size) can't follow how the flattened panorama skews a
canvas, so a box is now four corner points (yaw/pitch each). In the editor
the selected box shows corner handles (drag one to warp), edge handles
(resize) and a body drag (move); arrows nudge a focused corner or the whole
box. The sanitizer unwraps corners around the back seam, so a canvas that
straddles yaw ±180 stays one connected quad. The four-point model is also
exactly what corner-pinning real artwork onto the 3D wall will need.

### 2026-10-29 — Local photo-tool selection study

Owner approved the first selection slice. `?demo=painting` is a development-only
Svelte study; the party UI and shared protocol remain unchanged. Photo groups
and the canvas-surface treatment come from the owner's SVG, with embedded WebP
cutouts prepared by `studio/scripts/prepare_painting_study.py` inside ignored
`_design`. Alpha expansion supplies a complete active contour while corrected
vectors are pending. No new dependency or service is added.

The owner clarified that evenly mixed and multicolor loads belong to **one
color tray**: place colors, then choose Mix evenly or Keep colors separate.
The local study preserves those dabs across mode changes. RGB averaging and
parallel-band marks are explicit previews, not physical pigment simulation.
The study's wide 1600×850 canvas matches the mockup proportions; it does not
change the party's 1600×1200 document. Profile saving, renderer/protocol work,
workspace persistence and paired devices remain separate slices.

### 2026-10-29 — Painting study testing round two

Keep Paint and Arrange & view explicit: arranging supplies or exploring a zoomed
canvas must not make marks. Escape/bare-table clicks allow an empty hand. Supply
and panel positions stay local and temporary; phone/tablet layouts flow and
reorder rather than preserving an unusable desktop coordinate grid. Brush and
palette panels use native non-modal controls and offer drag, keyboard and tap
movement. No dependency, service or shared protocol change is needed.

Use separate artist-owned contribution surfaces in the study. Modifiers never
read the display composite. This establishes and locally tests the owner-layer
rule without changing accepted party strokes/replay. Real-party ownership,
network/replay, turn boundaries and shared undo remain an integration gate.
Brush textures, water behavior and pigment mixing are intentionally approximate.
Photo-derived per-material palettes replace the tiny generic chooser; sampling
coordinates and limitations are recorded in PAINTING-PALETTE-SAMPLES.md.

### 2026-10-29 — Burnishing pad and portrait supply packing

Preserve the owner's preferred accidental smudge/intensify effect as a separate
standalone Burnishing pad, with a visible plain-language description. Source-over
copies intentionally build opacity on owned contribution surfaces; the existing
water/sponge paths still preserve/lift alpha. Real burnishing is the naming
analogy, not a new material-physics claim. Reference rationale is recorded in
PAINTING-WORKSPACE.md. The provisional folded-pad SVG is original project art.

The tall 1309×1474 app preview exposed the landscape-only placement assumption.
Use flowing canvas/panels/supply rows when viewport aspect ratio is below 1.35,
as well as on narrow/short windows. Both panels and photos follow that same mode;
wide landscape keeps its existing arrangement. No shared protocol, service,
dependency or persistent layout format changes.

### 2026-10-29 — Tool intensity and extended pencil/charcoal sets

Use independent 0–100% Intensity controls for Airbrush and Burnishing pad. Default
50% preserves their approved feel; full intensity doubles per-stamp opacity,
zero is a no-op. Freeze intensity for a whole stroke and retain each tool's value
across local selection changes. No pressure curve or other brush changes.

Keep sampled colors and additional digital studio colors distinct in source
and chooser copy. Extend pencils to 36 and charcoal to 18 with deep black in
both. Preserve the photographic defaults and sampler regeneration path. No new
dependency, persistence format or shared protocol change.

### 2026-10-29 — Protect working ends rather than entire long handles

The owner explicitly allows pencils, brush/foam/knife handles and airbrush bodies
to overflow the display. Give those supplies a protected working-end rectangle;
use it for desktop hit targeting and all placement constraints. Palette trays,
paint sets, water and standalone objects retain whole-object containment. Also
keep protected portions out from under the canvas. One shared geometry helper
covers defaults, drag, keyboard/tap moves and resizing; portrait cards keep the
existing full-image flow/reordering behavior. Neighboring objects may overlap,
including the angled burnishing pad slightly over the texture sponge. No new
dependency, protocol or persistence format.

### 2026-10-29 — Arrange controls belong in the top bar

Replace the tool/color readouts with the supply picker, movement controls and
Reset layout while Arrange & view is active. This uses the already reserved
header and removes the overlay over bottom-left supplies. Hide brush settings
while arranging; returning to Paint restores settings and the previous selection.
Narrow layouts wrap within the normal-flow header, keeping the canvas below it.
No tool state, placement rule or painting behavior changes.

### 2026-10-29 — Saved studio views, canvas windows and account boundary

The owner approved Clerk email codes with optional Discord, Railway Postgres,
and a chosen starting canvas per participant passed around a ring. Add the Clerk
browser/backend SDKs and `pg` for account-owned workspace storage. Configure
providers through environment files; no provider project, credentials or hosted
resources were created. Verify subject and allowed origins on the server; do not
trust user IDs supplied in request bodies. Account storage fails closed. Browser
workspaces use separate guest/account keys, explicit guest import and visible
sync failures. After the first successful account save/load, debounce current
arrangement saves; cross-device revision conflicts remain future work.

Named views contain normalized supply positions, order, dock, window size and
local quarter-turn rotation. Restore/rebound them for the current screen. Phone
Up/Down swaps the selected supply into the same column of another visual row;
Left/Right move within its row. Side-column layouts leave the bottom available.

Keep immutable document dimensions separate from a resizable viewing window.
Zoom/pan/rotation transform the paper and its bevel; input maps back to document
coordinates. Controls sit outside the drawable window, with measured toolbar
clearance on narrow/portrait layouts. Canvas size starts a fresh local study;
view rotation preserves marks and dimensions. The party server still uses its
existing single-canvas model: the approved ring needs a shared-protocol change.

Start replay capture now with bounded, versioned emitted stamps including owned
contribution, elapsed time, load, size, intensity and stamp index/angle. Export
art-only JSON from the study menu. No durable journal, replay player or party
reconnect guarantee is implied. No video/audio recording is introduced.

### 2026-10-29 — Public studio invitation before hosted party rollout

The owner requested a public website ready for Vercel and later provider wiring.
Reuse the Svelte/Vite app with native path links and explicit static page metadata;
keep existing query-based party/development entry points. Lazy-load the party
studio and 360° viewer, and exclude owner editors/studies from production. No new
framework, runtime dependency, analytics, storage or payment service.

Use “Make something. Together.” and “No masterpiece required.” Tactile posters,
paper/wood, the real studio render, asymmetrical framed examples and optional
light/trinket interactions carry the invitation. Distinguish working paint/room/
sample playback from the planned passing ring and durable replays. The gallery
has only clearly labeled original examples; no private party art is made public.

The supplied tool-photo license gate remains open, so ship original generated
unbranded public brush/tin/trinket/wood assets and original vectors instead of
publishing those private study images. The attached pillow photos remain reference
only. Self-host licensed fonts to avoid visitor Google Fonts requests.

Vercel native Git deployments plus token-free GitHub checks handle frontend CI;
Railway retains the Node/WebSocket service. Provider settings, domains, secrets,
LFS checkout and actual hosted behavior need separate owner/provider setup. Leave
donation and public contact destinations unconnected until supplied; do not invent
payment links or legal contact details.

The owner's first-online-version request was completed using the connected Vercel
account: create `passthecanvas-party`, upload only the reviewed static build and
verify its public production alias. Preserve the team's existing deployment
protection; the stable production alias is public without changing it. Configure
future Vite/Node22/LFS builds, but leave Git unlinked until the new source is
reviewed/committed, to avoid publishing the old repository state. No Git commits,
pushes, DNS changes or backend/payment credentials were created. Public-site-origin
env creation returned provider 403; use the verified live origin as the build
fallback, with an optional dashboard override when the custom domain is connected.

### 2026-10-29 — Reuse cleared photographs and the owner's support setup

The owner confirmed public-use ownership/licensing for the photographed artist
tools. Promote the four existing reviewed WebP derivatives used by the public
paint table, without exposing `_design` files or changing tool behavior.

Reuse the live `plugins.tapps.design/support/` setup, checked directly: Cash App
`$therealtapps`, Venmo `@tracyapps`, PayPal `@tapps`, visible handles, copy buttons
and optional manual payment in the provider's own service. No embedded checkout,
payment events or new payment integration. Reuse its public contact destination
`https://tapps.design/#contact`, rather than inventing a contact email. Update
support/privacy/terms copy to reflect these actual outbound actions.

### 2026-10-30 — Public appearance and owner-edited room

Add a keyboard-operable, remembered light/dark appearance button on every public
page. Preserve light as the default. Store only `ptc-site-theme-v1` in the browser;
apply it before page paint to prevent flashes during navigation. Keep physical
paper, paintings and the local paint surface in their original colors. Use warm
charcoal walls and peach lettering for dark appearance. Both appearances share a
single covered walnut footer with a dark overlay, so it has no repeating joins.

Replace the existing Cream City panorama with the owner's `_design/panorama-edit.png`
converted to quality-90, method-6 WebP at the same 4096 × 2048 dimensions. Preserve
projection, viewpoint coordinates and the original PNG. The served image is
1,472,468 bytes versus the 11,138,794-byte PNG (86.8% smaller).

### 2026-10-30 — The hero is the room

Use the existing Photo Sphere Viewer as the public home hero background, with
Days One headings, Square Peg handwriting and stronger magenta/teal/yellow
accents. Scope public typography changes to public pages, preserving painting
app typography. Keep the fonts local and retain their SIL OFL license files.

The room turns at about two degrees per second, pauses on pointer/focus input,
and has a visible Pause/Rotate control. Stop rendering rotation offscreen or in
hidden tabs. Reduced motion disables automatic rotation and inertia, including
when the preference changes during a visit. Touch uses two fingers to explore
so a single finger can still scroll the page. Keep the static panorama fallback
while the interactive viewer loads. Remove decorative fake wall lettering and
flat color-wash lights; real scene lighting is now an explicit roadmap item.

### 2026-10-30 — Account community foundation and approved account mail

Use Viga for public headings; keep Square Peg and the existing painting-app type.
Continue with the owner's approved Clerk email/optional Discord and Railway
Postgres choices. Clerk 6's prebuilt account UI is loaded from its configured
frontend domain using the documented plain-JavaScript integration; no framework
or authentication provider was added. Profile data uses the verified session
subject; public profile links use unrelated UUIDs. Profiles are private by default,
friendship requires explicit recipient acceptance, and declining/removing a
connection prevents repeated requests from that pair. No public directory.

Scheduled parties preserve an absolute start instant plus the host's IANA time
zone. Account invitations are restricted to connected friends; a separately
revocable share link can invite someone else. Store only SHA256 share-token hashes
and put raw invitation tokens in URL fragments, not request URLs or server logs.
Guest RSVP, rescheduling and durable party attendance remain later integration
work. Calendar export provides a 15-minute device-calendar reminder; it does not
pretend a downloaded file is a server-sent notification.

The owner explicitly approved Resend for expected invitations and opt-in reminders.
Use its REST API via built-in fetch (no added SDK dependency). A Postgres outbox
leases and deduplicates jobs, rechecks consent/RSVP/cancellation, sends only to a
Clerk-verified primary address and stops ambiguous retry before the provider's
24-hour idempotency window. Email invitations require an existing friend connection
and recipient opt-in; arbitrary third-party email submission is not accepted.
Delivery stays off until approved sender/domain, credentials and operational gates
are ready. No email or provider credentials were supplied or used in this change.

Start with original local paper/paint badge avatars; they require no photos,
biometrics or remote avatar service. Avatar research compares self-hosted DiceBear
and future 3D/upload options without adding those dependencies. Completed party
history can only come from a future verified server-completion adapter, never a
browser's claim that a party occurred. No WebSocket message shape changed here.
