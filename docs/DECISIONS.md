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

- **Start a party now** (Nov 3, 2026): an instant party is a scheduled party
  that starts now, so invitations, RSVP, calendar and history all reuse one
  model. Invites and joins stay open until start + duration, not just start.
- **Practice table** (Nov 3, 2026): reuses the full party `PaintingTable` (the
  public "try" page has fewer tools). Pieces are private: never in a gallery,
  never shown to others, no replay video. Stored in `studio_practice_pieces`
  (PNG up to 8 MB, small thumbnail, gzipped strokes re-checked by the server),
  100 pieces per person.
- **Account dark mode buttons** (Nov 3, 2026): buttons use `--btn-bg` and
  `--btn-text`; cards reset them to ink so buttons stay readable on both the
  dark wall and the light cards.

- **Painting table header** (Nov 4, 2026): the header never changes height.
  Arrange controls float in a movable "Arrange table" panel; piece and party
  actions live in Menu; sign-in/out and site links live in a separate Account
  menu, away from the tools. The practice table asks for the canvas shape once
  at the start; changing it later is "New canvas…" and clears the work.
- **Palettes follow the tool** (Nov 4, 2026): an open palette stays open when
  you switch tools, but switches to a paint set the new tool can use (airbrush
  and palette knife go to acrylic) instead of showing colors you can't pick.

- **Auto-save** (Nov 4, 2026): practice pieces auto-save every few minutes
  (Settings: off, or every 1/2/5/10/15 minutes; default 2), only when something
  changed, never mid-stroke, and when the tab is hidden. Auto-saves are separate
  rows (`autosave`, `draft_of`) in their own tab, newest 20 kept, and never
  overwrite a saved piece. The page tracks clean / unsaved / saving /
  auto-saving / error and shows a small status by the menu. Cmd/Ctrl+S saves.
- **No page zoom on the painting table** (Nov 4, 2026): pinch, double-tap and
  trackpad pinch move the canvas only. Keyboard zoom still works. The trade-off
  for low-vision users is an **Interface size** setting (85–150%): it scales whole
  pages on the site and account, and the controls on the painting table. Settings
  live in `studio_preferences` and a browser copy.
- **iPad memory** (Nov 4, 2026): temporary canvases are emptied right after use.
  iPad Safari reloads the page when canvas memory piles up.

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

### 2026-10-30 — Repair the owner's Git-connected Vercel project

The owner's screenshot identified `web`, a separate Git-connected project from
our older `passthecanvas-party` static preview. Apply the repo-root workspace
settings to `web`, use Node22 to match `.nvmrc`, and start a fresh Git-source build
of the already committed `6f4808d` rather than replay old deployment settings.
`dpl_GPTbn51Zbe23eb6MBdvZPQJ8chhB` is READY and serves the owner's existing custom
domain `passthecanvas.party`. No Git/source/dependency change or DNS action was
necessary. Preserve the older preview project; update the runbook to identify
`web` as the current custom-domain production project.


### 2026-10-30 — One live Vercel project; sign-in before profile editing

Keep the Git-backed project and custom domain, rename `web` to
`passthecanvas-party`, and pause/label the old static preview while deletion is
pending. Clerk integration variables used Next.js names on the wrong project;
use the Vite publishable-key name on the live frontend and keep server secrets
on Railway. The existing Clerk development instance is for internal testing.
Unsigned visitors see sign-in first and can expand a native, keyboard-accessible
avatar preview. Profile/sharing/notification forms appear after sign-in.

### 2026-11-01 — Verify LiveKit setup before the Phase 1 browser gate

Add an explicit, read-only `check:livekit` command using the existing LiveKit
server SDK. It reads the server environment, checks the secure project URL and
verifies credentials with the room-list API without displaying its results.
Failure messages omit provider exceptions, tokens and credentials. No rooms,
media, dependencies or hosted resources are created. Keep the actual two-computer
call/painting gate separate; documented HTTPS routing and real-device checks
remain necessary. Do not advance Phase 2 based on a successful credential check.


### 2026-11-03 — The painting table moves into the party; no more separate study

Owner direction: from now on every improvement happens in the party itself
(art creation, after-party display, host tools), not in a side study.

- **Painting.** The `?demo=painting` study's table (photo supplies, tool/paint
  loading, trays, water, burnisher, intensity, Arrange & view, saved views,
  zoom/rotate/navigator, resizable canvas window) replaces the Phase 1
  painting screen. Files lost their `study-` prefix (`brushes.ts`,
  `layers.ts`, `camera.ts`…); the old `brushes.ts`/`PaintCanvas`/`paints.ts`
  renderer and the replay-recording study file are gone.
- **Protocol (breaking).** A stroke is now what the painter holds — `tool`,
  `load` (medium + 1–9 colors), `wet`, `size`, `intensity` — plus the
  *stamps* themselves (`x, y, pressure, angle`, and `first` for the grain
  seed). Sending stamps instead of raw pointer points is what keeps a held
  airbrush and spacing carry-over identical on every screen. The tool/paint
  rules moved to `packages/shared/src/paint.ts`, so the server refuses strokes
  no real table could make.
- **Ownership kept (owner confirmed).** Each turn paints its own layer. Water,
  sponge, burnisher and eraser only touch the current painter's own turns;
  only the current turn gets new pigment. The server stamps every stroke with
  `painterId` + `round`, so all screens build the same layers.
- **Late joiners replay history** (`history` message) instead of loading a
  flattened snapshot — a snapshot can't carry ownership. Past 400k stamps the
  server drops history and late joiners get the latest snapshot as a protected
  base. Snapshots are still saved per round, for the reveal and gallery.
- **Watching.** Everyone sees the table and can pick up tools and load paint
  while waiting; only the painter marks. Off-turn plain drags do nothing (no
  surprise panning); right/Alt-drag, pinch and Arrange still move the view.
- **Host tools in the top bar:** canvas shape (lobby only; replaces the study's
  "Canvas size"), Start, Pass now / Pass for them. Practice-only controls
  (switch painter, clear canvas) are gone.
- **Reveal → gallery.** "Hang it in the gallery" opens the room with the real
  pieces: the finished piece plus each earlier round, with names. Pieces are
  fitted (not stretched) onto the wall canvases. Share links may carry real
  art, but only `/snapshots/<party>/round-N.png` paths. `?demo=art` is gone;
  `?gallery=` shared links still work. Hang-mode choice is per screen for now
  (not synced to guests).
- **Open:** the one-canvas-per-guest passing ring (ACCOUNTS-AND-REPLAY.md)
  still needs its own protocol change; turn layers already fit it. Gentle
  timer handoff is unchanged: a stroke in progress at time-up is dropped by
  the server.


### 2026-11-03 — Party loop: gentle timer, lobby setup, notepad, reveal time-lapse, synced gallery

Built straight into the party (no study), following the briefs in
PAINTING-WORKSPACE.md and the Phase 2 list.

- **Gentle timer.** At zero the server stops the clock and sets `overtime`;
  the painter keeps the canvas until they press "Pass the canvas" (the button
  gets a soft ring; it only pulses when motion is allowed). The host can still
  "Pass for them" for a stalled turn, and a painter who disconnects passes
  automatically. No chime yet (the brief says off by default anyway).
- **Ordered cutoff.** The server accepts the finishing painter's strokes during
  the 4-second "passing" card, and the cutoff is the next painter's turn. Pass
  buttons finish any stroke in progress before sending the pass, and a stroke
  in mid-air when the host passes is flushed and accepted, so every screen
  (and the saved round image) stays identical. Verified in two browsers.
- **Lobby "Party setup" (host only):** canvas shape, turn length (30 s – 5 min
  presets; server clamps 20–600 s) and passing order. Reordering uses
  "Move earlier / later" buttons with spoken confirmation; drag-to-reorder was
  left out on purpose (the buttons work for mouse, touch and keyboard). The
  server only accepts a reorder of exactly the people in the party.
- **Notepad (chat).** A movable ruled-paper panel; `role="log"`; your notes
  say "You". Unread count on the Notes button; while it's closed, a polite
  "New note from …" announcement. Keeps the last 200 notes in the browser
  only; the server still stores no chat.
- **Reveal.** Framed piece, "Who painted what" by round, download, and a
  time-lapse rebuilt from the strokes each screen already has (no new
  storage). It opens on the finished picture and never autoplays; a slider
  scrubs and says whose round is showing. Screens that joined too late for the
  full history fall back to the saved image.
- **Gallery hang mode is the host's call**, synced to every guest
  (`setGalleryMode`); guests see it, read-only, with a note saying so.


### 2026-11-03 — Party radio

- The host searches the Radio Browser directory from their own browser
  (three mirrors tried in order; https streams only; top 20 by popularity).
  Mood shortcuts: lofi, jazz, classical, indie, soul, ambient.
- "Play for everyone" sends `setRadio`; the server only shares the station
  name and URL (it now also checks the URL parses and is under 2,000
  characters). It never fetches or relays audio.
- Every guest presses **Listen** themselves (no autoplay; browsers would block
  it anyway), with their own volume starting at 30% and "Mute for me".
  Closing the panel keeps the music playing. Station changes are announced
  politely.
- Privacy: searching contacts radio-browser.info from the host's browser, and
  listening contacts the station from each listener's browser, only after they
  press Listen. No station logos are loaded (they come from arbitrary hosts).
- Not yet: the tube-radio skin from the design canvas; the panel is the
  notepad's paper style for now.


### 2026-11-03 — Per-tool pressure curves (and why edge darkening waits)

- Each tool now has its own pen-pressure curve for size and paint deposit
  (`PRESSURE` in `brushes.ts`). Round/flat brushes splay; detail/fan barely
  change; pencil, charcoal and pastel mostly get darker rather than wider;
  the airbrush treats pressure as the trigger (flow, not width). Every curve
  is exactly 1 at pressure 0.5, which is what a mouse reports, so mouse
  painting is unchanged; a test guards that.
- Watercolor edge darkening was tried as a "rimmed" dab and dropped: swept
  along a stroke, the chord through the middle of the stroke is longer than
  at the edges, so the middle still comes out darker. Real pooling needs a
  stroke-level pass (when a wash stroke ends, darken where its coverage
  falls off). Wet-on-wet needs a per-layer wetness map driven by stamp count
  (not wall-clock time, so every screen agrees). Both stay open.


### 2026-11-03 — Tray recipes and saved mixes; invite link

- **Recipe tray** (first step of the "Mix a color" redesign brief): the tray
  holds colors *with parts* ("2 parts Bright blue, 1 part Brick red") with
  −/+/Remove buttons, up to 9 parts. "Mix evenly" weights by parts;
  "Keep colors separate" makes streaks whose width follows the parts. On the
  wire a streaked load is the color repeated per part, so the stroke
  protocol is unchanged. Still RGB averaging (approximate); a pigment model
  (e.g. Mixbox, license check needed) is a separate decision.
- **Saved mixes**: "Save mix" keeps up to 12 recipes on this browser
  (localStorage, like saved views; never shared). Tap one to refill the tray.
- **Not yet from the brief:** a "Blend amount" for streak softness (needs a
  protocol field), finite paint/reload, named trays, import/export.
- **Invite link**: Party setup and the table menu have "Copy invite link"
  (the party address; clipboard with a select-it-yourself fallback).


### 2026-11-03 — Everyone starts their own canvas; canvases pass clockwise by seat

Owner direction (Nov 3): every artist always starts their own canvas and
chooses its shape; canvases pass around the room; the owner adds the last
layer; credits read "Owner, with the help of …" in painting order.

- **The ring** (`packages/shared/src/ring.ts`): default order is clockwise
  by seat (sorted by the seat's yaw from `spots.json`; people without a seat
  follow in arrival order). Canvases pass to the next person in the ring
  ("to your left"). N artists → N + 1 rounds; round N + 1 brings each canvas
  home. The host can choose **Random circle**: the ring is shuffled *once*
  and then passes the same way every round, which is what guarantees
  everyone paints every canvas exactly once. Moving someone makes it Custom.
  Tests prove no two artists share a canvas in any round.
- **Simultaneous rounds.** Everyone paints at once. "Pass the canvas" means
  "I'm done with this one"; the round moves on when everyone has passed, or
  the host chooses "Pass everyone on" (shown after the host has passed, or at
  zero). Zero is still only a cue.
- **Protocol (breaking).** `PartyState` now has `pieces` (each canvas with
  its planned turns, painter names and saved image per turn),
  `assignments` (who has which canvas this round), `passed`, `orderMode` and
  `room`; `painterId`/`canvas`/`rounds`/`snapshotUrl` are gone. Members carry
  `canvasShape` and `watching`. Strokes carry `canvasId`; the server only
  accepts a stroke onto the canvas in front of you.
- **Bandwidth/memory.** Strokes are no longer broadcast to everyone: the
  server keeps each canvas's history and sends it to whoever receives that
  canvas next (`canvasHistory`), and relays live strokes only to people
  watching that canvas. Each browser holds just one canvas's layers at a time.
  Per-canvas cap 300k stamps, then the latest saved image is the base.
- **Late joiners** watch (pick any canvas from "Watching"); the ring is fixed
  at the start. Someone who leaves mid-game: their canvas waits out the
  rounds they would have painted.
- **Saved images** are `/snapshots/<party>/c<N>-r<round>.png`; share links
  accept only that pattern.
- **Reveal**: every piece with its credit line, yours first; open one for its
  time-lapse, with the artists as a chapter list (current artist highlighted,
  pick a name to jump). The gallery hangs everyone's finished piece. This is
  the in-party version of the archive detail view; the permanent archive
  (Railway) is the next step.


### 2026-11-03 — Radio on for everyone; the table's tube radio

- The radio now plays for every guest when the host puts a station on. The
  "Join the party" click counts as the gesture browsers require before sound;
  if a browser still refuses, the panel says so and offers Listen. Each guest
  keeps their own mute and volume (30% to start).
- The radio panel is a CSS-drawn tube radio: walnut cabinet, woven grille,
  a lit glass tuning window with the station name, glowing tubes (they only
  pulse when motion is allowed) and a bakelite knob that turns with the
  volume. The real controls underneath are a button and a range input.
- Planned: clicking the radio in the 360° room opens the same controls
  (a marker pinned to a `spot_radio` in spots.json), rather than drawing fake
  knobs over the render, which would drift from other viewpoints.


### 2026-11-03 — Seat views and the texture pass (Blender)

Owner direction: see the room from your own seat, so the Photoshop-only
fixes had to move into the Blender file. Worked directly on
`studio/blender/cream-city-studio-wphotos.blend` (the owner made a backup).
Full how-to: `studio/SEAT-VIEWS.md`.

- **Texture pass** (`studio/scripts/texture_pass.py`, re-runnable): draped
  orange couch, dark green crushed-velvet beanbag (both with real folds in the
  shape, so they hold up from any seat), striped throw pillow, tall skinny
  locker built from the locker photo, drying-rack photo card removed, and a
  "lived-in" grime pass: darker uneven ceiling/timber with stains, more paint
  drips/splatters on the painting table, crevice dirt and paint flecks on the
  chairs, stools, side tables and cabinets. All procedural; no new assets.
- **Seat views** (`studio/scripts/seat_views.py`): one panorama per spot,
  rendered at sitting eye height facing the middle of the room, plus that
  view's own `spots.json` and `art.json`, re-projected from 3D (so the
  hand-drawn art areas follow) with hidden ones dropped. Seats are found
  automatically; five odd ones (sills, easel, music corner, floor by the cats)
  are hand-placed in `EYE_OVERRIDES`.
- **In the party**: once you've picked a seat that has a view, the room shows
  it from there; "From the middle of the room" switches back.
- **Drafts first**: the committed views are 2048-wide drafts
  (`seats/index.json` says `"draft": true`). Final 4096 renders run with
  `--final` after the owner approves the look.
- Blender runs headless from the command line (`Blender -b … --python …`);
  the Blender MCP connection isn't needed.


### 2026-11-03 — Final room export: canvas rack, locker fix, Blender-only panorama

- Owner added furniture, books and Poly Haven throw pillows in Blender; the
  texture pass now keeps the owner's edits (it no longer re-adds its own
  photo pillow, and leaves moved objects where they are).
- Canvas storage on the coffee nook's steel shelves
  (`studio/scripts/add_canvas_rack.py`): 26 canvases on edge across two
  shelves, about 60% painted (procedural abstracts) and the rest blank, plus
  one leaning face-out per shelf. The laptop's shelf is left alone.
- Locker texture rebuilt (`studio/scripts/make_locker_texture.py`): the
  repeated row is now exactly the small top row, renumbered 1–3 / 4–6 / 7–9,
  so no number repeats and the open door only appears once.
- Paint drips on furniture are gathered into a few patches and knocked back
  toward the surface color (they read as stripes before).
- The app's middle-of-the-room `panorama.webp` is now rendered straight from
  Blender (`seat_views.py --center`), replacing the Photoshop composite, and
  all 24 seat views are final 4096 × 2048 renders (`seats/index.json`
  `"draft": false`).

### 2026-11-03 — One 3D seat map; room tool for checking every viewpoint

- **The global seat map** stays `spots.json` (directions from the middle of
  the room). `seat_views.py` now also writes `seats/geometry.json`: every
  view's camera, each seat's marker in 3D, and which seats each view can't
  see. Each seat view's `spots.json` is pure math on that file
  (`spotsForView` in `@ptc/shared/views`, checked against Blender's own
  numbers to within 0.3°), so a seat moved once moves in every view.
- **Room tool at `?seats=<room>`** (dev only; replaces `?demo=seats`, which
  now opens it): pick a viewpoint, fill every seat with placeholder guests
  (random cameras and initials cards), hang sample artwork in the middle
  view, choose a seat and click where its head should be (or nudge with
  buttons). From a seat view, the click sets the marker on that ray nearest
  the seat's middle-of-room ray, so both views stay right. "Hidden from here"
  per view. Save writes `spots.json` + `geometry.json`; the server
  (`PUT /api/seats/<room>`, same `SPOTS_EDITOR` gate) rewrites every seat
  view's `spots.json`. No re-render needed. A new room works with just
  `panorama.webp` + `spots.json` (middle view only) until it has seat views.
- **Artwork hangs in the middle-of-the-room view only** (owner's call): seat
  views no longer get an `art.json`.
- `hangsFor()` (room/hangs.ts) is shared by the gallery and the tool, so the
  tool previews art exactly as a finished party hangs it.

### 2026-11-03 — Party archive, portrait seats, party server origin

- **Archive (opt-in, host only)**: at the reveal the host can "Save a
  shareable gallery". Stored in Railway Postgres (`DATABASE_URL`, no new
  service): `party_archives` + `party_archive_files` (bytea). Each canvas
  keeps its finished PNG and gzipped strokes (the time-lapse rebuilds every
  turn); if a canvas's history was too big to keep, each turn's image is kept
  instead. Never video, audio or notes. Every guest is told when it's saved.
- Link `?archive=<id>` (128-bit random id) shows the pieces, credits, the
  time-lapse with artist chapters and "See them in the room". The host alone
  gets a private delete link (`#delete=<key>`, only a SHA-256 hash is
  stored); deleting removes everything. 150 MB cap per party.
- Not yet: artists' own profile archive (needs Clerk sign-in wired to party
  membership) and Railway object storage (only if Postgres size becomes a
  problem).
- **Party server origin**: the site (Vercel) reaches the Railway server via
  `VITE_PARTY_URL`, falling back to `VITE_ACCOUNT_API_URL` (same server).
  WebSockets, video tokens and archive deletes check `PARTY_ALLOWED_ORIGINS`
  (falls back to `ACCOUNT_ALLOWED_ORIGINS`). Snapshot and archive images send
  CORS headers and load with `crossOrigin`, so canvases stay exportable.
- **Portrait seat frames**: cameras and initials cards in the room are 3:4
  portrait at the old height (101 × 135), center-cropped; guest-panel tiles
  match. Cut-out avatars will fit the same frame.

### 2026-11-03 — Your studio, round 1: pages, avatars, photos, calendar, timing

- **Account area is now its own small app** at `/account/…` (Vercel rewrite
  `/account/:path*`): Dashboard, My profile (view) and Edit profile,
  Avatars, Friends, Calendar, Plan a party / edit party, History & art,
  Camera & mic check, Settings. Side navigation (a "Studio menu" toggle on
  phones), focus moves to each page's heading. Cards stack in two columns, so
  there are no grid gaps. Old links still work (`/account#invite=`, `#profile=`).
- **Profile**: photo upload (center-cropped, 400 px, re-encoded in the
  browser so EXIF/location is dropped; server checks the image bytes, 400 KB
  cap; visible only to people who can see the profile) or initials on one of
  8 colors (white text, each ≥ 4.5:1). Social links: https only, host-checked
  per service; Discord also takes a plain username.
- **Cutout avatars** from papr.world: the 58 original shapes
  (`packages/shared/src/cutouts.ts`, regenerate from papr.world), the paper
  colors and patterns, and three media (pencil, soft pastel, crayon) clipped
  to the cutout. No stamps/arms/hair this round. Up to 24 per person,
  rename/duplicate/delete, one default. Designs are validated data rendered by
  `cutoutSvg`; no user SVG is ever stored or shown.
- **In the party**: the join form picks camera/avatar and a look (any saved
  cutout, the profile photo, or initials + color). The look is a small
  PNG/WebP made in the browser and sent apart from the party state
  (`looks`/`look` messages). Anyone can switch camera ↔ avatar any time
  (`setPresence`). Seats show the cutout without a frame.
- **Timing**: `PartyTiming` with two modes, a set party length (turns share
  what's left after intro, wrap-up and passing cards; `planTiming`) or a set
  turn length (the party runs as long as it takes). Hosts set it when planning
  and again any time before the reveal (`setTiming`); everyone's view
  follows, and the round underway gains or loses the difference. In party
  mode each new round re-shares the time left, so slow rounds even out.
- **Calendar**: month, week and list views; hosting, going and invited each
  get a different edge style plus a written tag. Per party: Google, Outlook.com,
  Outlook work/school, Yahoo, and an .ics file (Apple and everything else).
  A private subscription feed `GET /api/calendar/<token>.ics` (stored as a
  plain token so it can be shown again; replaceable). Subscribe buttons for
  Apple (webcal), Google, Outlook.com and Outlook work/school.
- **Camera & mic check**: preview in the 3:4 seat frame, mic level meter,
  test chime, camera/mic/speaker choice saved in this browser and used by the
  call (LiveKit capture defaults).
- **History & art**: saved party galleries (recorded for every signed-in
  artist when a host saves one) with thumbnails, plus past parties.
- **Local testing without Clerk**: server `ACCOUNT_DEV_FAKE_AUTH=1` +
  web `VITE_ACCOUNT_DEV_USER=dev-<name>` sign in as a pretend person against
  a local database. Refused in production and for non-localhost origins.


### 2026-11-06 — Tool grid and palette library before device testing

Default cutouts retain their saved positions. Grid view uses the current toolbox
and dock, with the left tray as the default on wide screens. Compact layouts use
small transparent WebPs and skip the full-size image masks until the cutout
layout needs them. The original tool icons live in a 24-unit SVG sprite for a
future picker.

The palette directory starts with six studio presets and personal palettes in
Settings. Preset edits are personal overrides. Hidden palettes stay in the
library, and favorites sort first in the party palette picker. Palette choice
changes swatches independently of the paint medium, including in the mixing
tray. Version 1 JSON exports share names and colors. Imports create independent
copies and open a review form. Saved palettes and tool view use the existing
account preferences store and browser copy.

See [device performance research](DEVICE-PERFORMANCE.md) for the single-device
performance priorities and the tablet companion design to evaluate after
measuring the live party.

### 2026-11-06 — Performance regression checks in CI

Use build size, room lazy-loading, and recorded drawing operations as the first
automated signals. The budgets have headroom over the current build and use no
wall-clock thresholds, so slower CI runners do not create timing failures.
[Baselines and commands](DEVICE-PERFORMANCE.md#automated-regression-checks).

### 2026-11-06 — Complete view resets and movable grid tiles

The header now exposes named saved views and a Default reset. Default and the
Everything toolbox restore tool positions, order, canvas frame, rotation and
supply selection together. Other toolbox choices still filter supplies, while
named views restore an entire arrangement.

Grid tiles use compact images with labels in their own space. On wide screens,
the freeform arrangement starts in wrapping columns beside the canvas, and
artists can drag individual tiles around the desk. Dragging a grid tile out of
a docked column preserves the visible positions and canvas frame, then switches
to freeform placement. Compact screens retain the wrapping flow and keyboard
reordering. Positions use the existing workspace storage format.

Panel headers have a textured grab strip. The expanded Move menu and its
direction/dock buttons were removed. The existing header drag and arrow-key
movement remain available.

[Desktop window options](FLOATING-TOOLBOX-WINDOWS.md) compare browser popups,
installed web apps, Document Picture-in-Picture and native desktop hosts.

### 2026-11-06 — Optional installation and configurable toolbox trays

The owner chose an optional installed web app as the desktop direction.
A standalone manifest and app icons use the same site, account and party paths.
Installation remains a browser choice. Browser and installed participants use
the same party server. Multiwindow toolboxes remain a future integration.

Toolbox tray is a third tool view beside cutouts and freeform grid. Starter
rows distribute tools evenly with at most three per row. Each row is a flex
layout, so two tools share their row evenly. Artists can add rows, add, replace
or remove tools and pin up to three palette shortcuts. Larger palettes use two
rings of color wedges. The discs open the normal color picker.

Rows and palette IDs are optional fields on existing saved toolboxes. Older
toolboxes get balanced starter rows. Editing a built-in makes a personal copy.
An explicit empty tray stays empty, while older empty supply lists retain their
original “show everything” behavior. Tray edits use existing browser and
account workspace persistence.

Installability requirements were checked against
[MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
The live party still needs a connection. Browser-specific installation and
installed-window behavior need real-device qualification after deployment.

### 2026-11-07 — Owner SVG palettes in the default library

Added all eleven palettes from `_design/color-palettes`, using filenames for
stable IDs and display names. Each contains the 21 filled rectangle colors in
visual reading order, left to right and top to bottom. CSS variables and preview
outlines are excluded. Swatches use the palette name and a number because the
source files do not name individual colors. Existing defaults remain available.

### 2026-11-07 — Toolbox popouts and direct palette visibility controls

The toolbox menu opens a separate browser window from a deliberate click.
Multiple toolboxes can stay open, and reopening the same toolbox focuses its
window. Each window has its own toolbox selector. The party owns selection,
tray edits and palette state, with the same Svelte UI rendered into the popup.
Toolbox windows do not create another party connection, room renderer or call.
They close when the owning party page leaves or the signed-in artist changes.

A saved tray preference shows a launcher after reload because popup creation
requires user activation. Show on table remains an explicit option. If popups
are blocked, the tray is shown on the table with a retry action. Browser chrome,
window placement and tab-versus-window behavior remain browser-controlled.

Palette cards in Settings now have a direct Show in palette picker switch.
The switch uses the existing personal hidden flag and account preference save.
Pinned tray shortcuts remain usable when their palette is hidden from pickers.

### 2026-11-07 — Shared interface icon artwork

Owner-supplied SVGs from `_design/icons` now live in
`apps/web/src/lib/ui/icons`, with named URL exports in `icons.ts`.
Components import the icons they use. `Icon.svelte` masks the artwork with
the surrounding text color and keeps decorative graphics out of accessible
names.

The first replacement is the panel grab strip. It repeats `grab-bar-bg.svg`
at 35% opacity, using cream on dark panels and ink on paper panels. The full
header remains the pointer and keyboard movement target.

### 2026-11-08 — One saved-view manager, in-session drawer and account page

The header uses one view selector with Manage saved views and Reset studio
layout actions. A user-saved view named “default” remains an ordinary view.
The former competing reset dropdown and toolbox dropdown are removed from the
main header. Toolbox selection remains available inside toolbox windows.

Saved views now optionally contain their own visible supply IDs, display mode
(cutouts, grid or toolbox windows), order, canvas frame, rotation and design
surface dimensions. Older stored views remain readable. Shared geometry and
artwork drive both the miniature desk and real freeform desk. A saved design
scales uniformly into the available desk below the header, preserving tool and
canvas proportions. Narrow screens retain the compact flowing interface.

The same manager runs at `/account/views` and in a drawer within parties and
practice. Draft edits require Save or Save & use. Leaving a dirty draft offers
discard or continued editing. Names must be unique ignoring case. Deletion is
confirmed. Account-page updates merge changed view IDs into the latest workspace
so ordinary view edits preserve the active desk and unrelated views.

Desktop previews support tool and canvas dragging, canvas resizing and numeric
position/size fields. Tools in columns can be reordered by dragging or buttons.
Phone, tablet and wide previews are read-only and omit party controls and
floating panels. Their compact flow illustrates the responsive arrangement;
physical-device and media testing remains part of the existing gate.

See [workspace pattern research](WORKSPACE-MANAGER-RESEARCH.md).

### 2026-11-08 — Separate view gallery and editor, one account save

The saved-view manager now opens as a wrapping preview grid. Editing replaces
that grid, with Back to saved views returning to it. Add view starts with no
supplies; Save current as new view remains a separate shortcut. Gallery cards
support inline rename, selection, bulk duplication and confirmed bulk deletion.
The editor's tool list contains switches only. Reordering remains available by
dragging the layout itself rather than arrows beside visibility controls.

Save view persists directly to the signed-in account before reporting success.
There is no second account-save, reload or browser-import action. Failed saves
keep the draft dirty and retryable. Guest views remain on the current device,
with explicit wording. The painting header exposes Save view changes when a
named view has been rearranged outside the editor. Canvas movement in the live
desk and editor uses the same minimum top boundary.

Toolbox tray/window entry points and their display option are paused and removed
from the current UI at the owner's request. Existing data is retained. Older
tray views reopen as cutouts with their supply selection and geometry intact.
The two available display styles are full cutouts and square buttons.

Local Chromium checks covered blank creation, tool switches, rename, single and
bulk duplication, confirmed bulk deletion, direct arrangement updates, account
save/reload against a PostgreSQL test fixture, failed account saves and retry,
and 360px/1440px layouts. Test authentication was used; this does not qualify
live Clerk or physical devices. See PARTY-READINESS.md for launch requirements
that remain unimplemented or unverified.

### 2026-11-08 — Party readiness: linked devices, windows, reconnecting

- **One artist, several devices.** The party server keeps a session per member
  with up to 4 devices. It hands out two duties: `canvas` (only that device's
  strokes and snapshots count) and `call` (only that device joins LiveKit,
  because the member id is the LiveKit identity and two joins would kick each
  other). Other devices mirror the canvas. Pressing Pass elsewhere sends a
  `passRequest` to the canvas device so the last stroke is flushed first.
- **Pairing** follows the Nov 4 plan: a QR code plus a 6-character code (no
  look-alike characters), one use, 5 minutes, one artist in one party, never
  account access. The QR opens `/?party=…#link=CODE` (fragment, so the code
  stays out of server logs); typed codes go through `/?link` →
  `GET /api/link/:code` → the same URL. 20 tries per address per 10 minutes.
- **Separate windows** use the same link (`…&window=1`), opened with
  `window.open` from the click, instead of a `BroadcastChannel` sync. One
  mechanism covers windows and devices, and the server stays the source of truth.
- **Reconnecting.** Each device gets a private rejoin key (server stores a
  SHA-256 hash), saved in that tab's `sessionStorage`. Drops get a 45 s grace
  before duties move; with no device left the artist is `away` (sits out the
  next round, loses the host role) and leaves after 2 min in the lobby or
  15 min in a game. A duplicated tab replaces the older one, which is told why.
  An explicit `leave` message frees the seat at once.
- **A new linked device opens on its job** (a room-and-video device opens the
  room). Handing a duty over never moves your view; it is announced instead.
- **New dependency: `uqr`** (MIT, ~20 KB, no dependencies) to encode QR codes.
  We draw the SVG ourselves, so it carries a proper label.
- Room self-view: the room's seat markers now get your own camera track too.

### 2026-11-08 — Gallery pieces open from the room; Save data

- **Click a piece in the 360° gallery** to open it up close (credits,
  time-lapse). Hit-testing is pure math on the placed quads (`pieceAt` in
  `leanLayout.ts`, unwrapped across the back seam, unit-tested). The pointer
  becomes a zoom cursor over a piece. Keyboard and screen-reader users get the
  same thing from **Look closer** in the "On display" list. Works in saved
  galleries (`?archive=`) and the party's own gallery.
- **Save data** (call dock): unsubscribes from other guests' cameras, so only
  their voices download and their avatar or initials show. Our own camera is
  untouched (that's Switch to avatar). Remembered per browser; starts on when
  the browser's Data Saver is on. When LiveKit rates our connection Poor or
  Lost, it switches on by itself once per call (ACCESSIBILITY.md promises
  this) and the dock says so; turning it off again is respected.
- Local video testing: LiveKit's own dev server (`livekit-server --dev`) plus
  Chromium's fake camera confirmed calls, self-view at your seat, Save data,
  and moving the call to a linked device. Not a substitute for real devices.

### 2026-11-08 — Strokes painted offline survive a reconnect

The browser keeps strokes made while its party socket is down (up to 5,000
batches). After `welcome`, they wait for the canvas history that follows;
those for that canvas are sent and added to the rebuilt history, so they stay
on screen and reach the server, which still checks round, canvas and the
canvas device as usual. Strokes for a canvas that has since passed on are
dropped. No protocol change.


### 2026-11-08 — Editable screen sizes and a view choice per device

The saved-view editor's screen-size selector now changes the editable design
surface. Artists can create or duplicate named views for desktop (1440 × 900),
wide desktop (1920 × 1080), tablet (1024 × 768) and phone (360 × 800), then save
each independently. Gallery cards include the design dimensions. Compact designs
keep tools in a wrapping flow: visibility, display style, order, canvas dimensions
and rotation are editable, with drag, arrow-key and button paths for reordering.
Free positioning remains available on desktop designs. Compact canvas dimensions
now apply to the real painting table as well as the editor; desktop designs still
use the automatic compact fallback when opened on a narrow screen.

Named views remain in the existing account workspace library. “Use on this
device” stores the active arrangement in this browser's account-scoped workspace;
loading account views preserves that arrangement instead of applying another
device's current desk. This is a browser choice, not hardware identification or
an automatic assignment by screen width. Browsers without a local arrangement
start from the account's existing desk. No party protocol or account data format
change is needed.

The owner retired the Paint / Arrange toggle. Live arrangement controls and the
duplicate Arrange menu entry are removed. View → Manage saved views is the layout
editor. The View dropdown uses a native popover so floating party panels cannot
cover its actions. Canvas navigation (pan, zoom and rotation) still works.

Local checks cover saved compact geometry, size conversion, visibility/order
comparison and preserving device arrangements when loading shared account views.
Browser checks and remaining qualification are recorded in PARTY-READINESS.md.


### 2026-11-08 — Separate device jobs and screen choices

The owner approved managing painting, camera/mic and screen choices separately
from any linked device, including the required shared-message changes. “Your
devices” in the call dock opens a native dialog from the room or canvas. The
existing table-menu entry opens the same dialog. It offers one selector for
painting, one for camera/mic and a Canvas/Room selector for every linked screen.
Screen choice never moves video or painting. A screen without the call shows
avatars in the room. Matching device labels are numbered within the artist's
list so two phones or two windows can be distinguished.

The server validates assignment targets inside the sender's own session and
requires the target to be online. `takeDuty` accepts an optional `deviceId`
(omitted still means the sender). `setDeviceScreen` and `MyDevice.screen` keep
screen choices through socket reconnects and reloads. Multiple devices can show
the room. A newly linked room device still starts in the room with the call;
its jobs and screen can then be reassigned separately.

Painting handoffs, including linking a new painting device, first send
`finishCanvasHandoff` to the current painter. It flushes its stroke before
`canvasHandoffReady`; ordered messages on that socket keep the final batch
accepted before ownership changes. A private handoff ID binds the source and
target, and expires after five seconds. An expired or unanswered request does
not move painting. If the old device is already offline, painting can move
straight to a connected target. UI success waits for server state; failures,
disconnects and an eight-second confirmation timeout leave the real assignments
visible and retryable.

Camera/mic handoffs invalidate unfinished token requests, LiveKit connects and
media-start operations. Late results and old room events cannot revive the old
call or disconnect a newer one. Camera/avatar changes on a separate screen now
reach the device holding the call. No video or audio is recorded.

Deploy the shared types, server and web changes together and reload older party
pages before using the new controls. Older pages cannot acknowledge a painting
handoff, so the server keeps painting where it is rather than dropping its tail.
Local evidence and remaining hardware checks are in PARTY-READINESS.md.
