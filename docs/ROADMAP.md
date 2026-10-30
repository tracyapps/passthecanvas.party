# Roadmap

Four phases. Each ends with a **gate**, a test that must pass before the next phase starts. Blender work (phase 3 prep) can run alongside phase 2 at any time.

Tick boxes as work lands. Keep tasks small enough to finish in one sitting.

---

## Phase 1: Prove it ← *current*

Test the three risky pieces before investing in polish.

**Gate: two people on different computers paint one canvas together while on a video call, with the room visible.**

### Setup
- [x] Repo structure, agent instructions, docs
- [x] `git init`, `git lfs install`, first commit
- [x] `npm install` and `npm run dev` work on Tapps's Mac
- [ ] LiveKit Cloud project created; keys in `apps/server/.env` *(only step left: create the project at cloud.livekit.io, copy keys into `apps/server/.env`)*

### 360° room spike
- [x] Download the Poly Haven `art_studio` HDRI (tonemapped JPG/WebP, 4k) into `apps/web/public/studio/placeholder/`
- [x] Photo Sphere Viewer shows it in `RoomView.svelte` *(verified in-browser; the viewer was stuck at 0px wide in the studio grid — fixed)*
- [x] Arrow keys pan; reduced motion turns off inertia and auto-rotate *(arrows are focus-gated: Tab to the room, then pan; no page-wide arrow hijack)*
- [x] One HTML marker holding a live `<video>` (your own webcam) pinned at a yaw/pitch *(marker + camera wiring done and in the DOM; smoothness check on a phone still needs LiveKit keys + a real device)*
- [x] Markers load from `public/studio/placeholder/spots.json`
- [x] Owner's Cream City render (`panoramic-v3`) is the live room in `public/studio/cream-city/` *(supersedes the placeholder HDRI; folder kept for fallback)*
- [x] Spots editor at `?spots=cream-city`: click the panorama to aim, name + zone, save *(writes `spots.json` via dev-gated `PUT /api/spots/:room`; disable with `SPOTS_EDITOR=0` before going public)*
- [x] Sit-here spot picking + seat markers (live camera or initials avatar) via `takeSpot` *(pulled forward from phase 3; avatar path verified live, camera path shares the same wiring and waits on LiveKit keys)*

### Shared canvas spike
- [x] Port the brush engine from the design prototype into `lib/canvas/brushes.ts` (pencil, round, flat, wash, eraser; pressure)
- [x] Painter's strokes sent to the party server as `stroke` messages; other browsers replay them
- [x] Server rejects strokes from anyone who isn't the current painter
- [x] Late joiner receives the current snapshot, then live strokes *(studio now loads `snapshotUrl` whenever a new one arrives)*

### Call spike
- [x] Server endpoint mints LiveKit tokens (`/api/token`)
- [ ] Two browsers join one room with camera and mic; mute and camera toggles work *(UI is wired: dock with mic/camera/room/leave, video tiles per guest; needs LiveKit keys, then a real two-browser test)*

---

## Phase 2: The party

The whole game loop, accessible, without the fancy room yet.

**Gate: a real party with friends (4–8 people) plays a full game start to finish.**

- [ ] Create party → share link → join with name + camera-or-avatar choice
- [ ] Lobby: host sets turn length, order (drag to reorder, plus keyboard reorder), room
- [ ] Turn loop: timer from the server, "Pass now", pass card, next painter
- [ ] Watching mode for non-painters (live stroke replay)
- [ ] Chat (notepad drawer)
- [ ] Party radio: Radio Browser search, host picks, every client streams the station itself
- [ ] Reveal screen: framed piece, who painted which round, download full-size PNG
- [ ] Replay: time-lapse built from saved strokes
- [ ] **Paint box**: perfect the media and how they interact (see the dedicated section below)

### The paint box (started Oct 2026)

The owner's priority: the painting should feel like real art supplies, and the media must interact — water dilutes and smears, charcoal builds and smudges, glazes deepen to opaque.

- [x] Media set: watercolor, acrylic (viscosity slider), airbrush, charcoal, pastel + the existing pencil/round/flat/eraser
- [x] Wet tools: water brush (dilutes + smears), finger (blends/smears), sponge (textured dabs), palette knife (opaque chisel strokes)
- [x] Paint mixing on the palette (mix two paints, use the result)
- [x] Owner's first painting-workspace brief: review five mockups, research mixing/workspaces, compare actual tool assets in WebP; see [PAINTING-WORKSPACE.md](PAINTING-WORKSPACE.md), [research](PAINTING-INTERACTION-RESEARCH.md), and [asset review](PAINTING-ASSETS.md). Planning only; phase 1 gate remains open.
- [x] First local selection study at `?demo=painting`: photographic tool buttons, no-tool/unloaded/loaded states, compatibility, local practice painting and one tray with reversible even/multicolor options. Desktop/mobile browser evidence and limits in `design-qa.md`; no party/protocol integration.
- [x] Owner testing round two in the local study: canvas stacking/responsive supply layout, movable non-modal controls, Paint / Arrange & view, zoom/pan/navigator, owned contribution modifiers, differentiated brush tips and photo-derived material palettes. See `design-qa.md` round two; physical touch and real-party renderer integration remain open.
- [x] Owner testing round three: standalone Burnishing pad restores the smudge/intensify effect on owned pigment; tall windows pack supplies below the canvas using aspect-aware flow. Evidence and limits in `design-qa.md` round three.
- [x] Owner testing round four: independent airbrush/burnisher intensity; 36 pencil colors and 18 charcoal shades including deep black. See `design-qa.md` round four; local study only.
- [x] Owner testing round five: angled bottom burnishing pad, deliberate long-handle overflow and shared protected-working-end placement rules for defaults/drag/keyboard/reflow. Containers remain fully contained; local study only.
- [x] Owner testing round six: Arrange controls replace painting readouts in the top bar, removing the supply-covering overlay; Paint restores selection/settings. Local study only.
- [x] Owner testing round seven: local named views, visual-row movement, side columns, separate resizable canvas window, outside zoom/rotation controls, canvas-size preparation and emitted-stamp JSON export. Clerk + Railway Postgres account workspace boundary wired; hosted credentials/login/save evidence remains open.
- [ ] Configure approved Clerk email + optional Discord and Railway Postgres; prove real account save/reload, account switching and cross-device behavior.
- [ ] Implement approved one-canvas-per-guest passing ring with stable contributor ownership and durable accepted art events; shared types and both apps must change together.
- [ ] **Redesign "Mix a color"** — owner brief received; prototype multi-color recipes, streaked loads and reusable trays in the delivery order above; existing toggle unchanged so far
- [ ] Gentle timer handoff: zero cues finishing rather than forcing a pass; explicit server-authorized handoff, final-stroke flush and recovery tests (brief above; not implemented)
- [ ] Configurable photo-tool widgets, named layouts and local popouts; paired devices and private account albums need separate identity/protocol/persistence design (brief above; not implemented)
- [ ] Wet-on-wet diffusion (watercolor bleeding into wet areas)
- [ ] Watercolor edge darkening (pigment pooling at wash edges)
- [ ] Per-tool pressure curves; airbrush spraying while held still
- [ ] Impasto feel for thick acrylic (light/shadow on ridges)

### Parking lot (owner ideas, not scheduled yet)

- [ ] Companion canvas devices: use a tablet + stylus or a phone as a second screen for the canvas, while the computer shows the room — one account, two devices
- [ ] Full playback: every mark recorded per piece (Railway-hosted store), scrubbable play bar, contributor name/avatar shown while their part plays
- [ ] Auto-edited video export (TikTok-style "magic" picks: interesting pause points) with artist controls to move/add pause + slow spots; music bed; social sharing

- [ ] Accessibility pass: keyboard stamp-mode painting, screen-reader turn announcements, captions plan
- [ ] Low bandwidth: audio + avatar fallback, smaller assets on phones
- [ ] Deploy: web on a static host/CDN, party server on a small VPS or Fly/Render, domain `passthecanvas.party`

---

## Phase 3: The magic studio

Replace placeholders with the real Blender studio.

**Gate: the room feels real on a mid-range phone, and loads in under 3 s on decent wifi.**

- [ ] Block out the loft studio in Blender (`studio/blender/loft-studio.blend`)
  - [x] Owner-requested Cream City design exploration: editable shared shell and three looks in `studio/blender/cream-city-studio.blend`; see `studio/CREAM-CITY-GUIDE.md`. Review draft with some maquette props; final room choice, spot alignment and production outputs remain open.
- [ ] Café corner: grow the snack table into a coffee-house nook (espresso machine, window counter + stools, chalkboard menu) and add extra sit-and-create spots (small easel, sketch stools) — see the owner's note in PLAN.md
- [ ] Place all nine zones with Poly Haven assets (see `docs/POLY-HAVEN.md`)
- [ ] Build missing pieces: bean bag (cloth sim), drafting table, easel, cat tree
- [ ] Three lighting moods: morning, golden hour, lamp-lit night
- [ ] `spot_*` empties for every seat + cats, canvas, timer, radio
- [ ] Run `export_spots.py` → `apps/web/public/studio/loft/spots.json`
- [ ] Render panoramas (8k desktop, 4k phone) per mood → WebP/AVIF
- [ ] Render the top-down painting-view table and props; re-skin the painting view
- [ ] Cats: decide filmed vs rendered loops; make idle + react loops for 2–3 cats
- [ ] Snack table props interactive (click a snack: tiny animation, sound optional and off by default)
- [x] Spot picking in the 360° room ("Sit here" markers, list alternative) *(landed early, Oct 2026, with the cream-city room — see phase 1)*
- [ ] **Wall gallery**: hang each party's artwork on the room's blank canvases, export a social-ready photo and a shareable pan-able room save, nicknames under each piece *(details pending from the owner)*
  - [x] Boundary tool at `?art=cream-city`: draw the canvas boxes on the flat panorama → `art.json` per room *(dev-gated like the spots editor)*
  - [x] Demo seating at `?demo=seats`: fake guests (canvas-painted video tracks + initials cards) to judge seat spacing before LiveKit exists
  - [x] Placeholder-art proof at `?demo=art`: a deterministic painting hung in every quad, corner-pinned into the 3D room (screen-space homography, `matrix3d`)
  - [x] Owner decision (Oct 2026): **both layers** — pieces hang on wall quads first, overflow leans in freeform areas; lean areas are `role: "lean"` quads drawn in the same `?art=` editor (same warp, dashed-teal, per-group show/hide)
  - [x] Gallery preview with host controls (`?demo=art`): hang mode + piece count; lean areas pack by dimensions (two tall canvases where one landscape fits)
  - [x] Export preview (PNG of the current view, art composited) + shareable 3D room link in the URL hash (`?gallery=cream-city#g=…`, no server storage)
  - [ ] Hang real party artwork (snapshots per round) + nicknames under pieces
  - [ ] Later, if parties use it: drag artwork between spots before saving; server-saved rooms; social-photo layout design

---

## Phase 4: Extras

### Owner's painting v2 scope

- [ ] Public introduction/site and optional Donate to the developer link; provider choice later.

- [ ] Collage crate: pre-cut objects first; placement, editing and shared object messages need a dedicated brief
- [ ] Mnemonic/custom tool shortcuts (basic keyboard operation and keyboard painting remain accessibility requirements before v2)

- [ ] More rooms for the scene library (Garden Atelier, Rooftop at Dusk, Cabin Workshop…)
- [ ] Wandering 3D cats (three.js layer aligned to the panorama)
- [ ] A panorama per spot (see the room from where you sit)
- [ ] Prints: partner TBD
- [ ] `passthe.art` short links for sharing finished pieces

## Owner-requested public website slice — October 2026

- [x] Public studio-style home, planned how-it-works, local paint preview, illustrative
  replay gallery, roadmap, support, account and preview privacy/terms pages.
- [x] Vercel/Railway configurations, native Git auto-deployment handoff and GitHub
  source checks; static route/link-preview metadata and locally served fonts.
- [x] Publish first Vercel static preview; verify nine public routes, real panorama
  delivery, paint/studio/gallery interactions and static social metadata.
- [ ] Commit reviewed website changes, link the existing Vercel project to Git,
  choose production branch, prove a Git-triggered build, and connect the custom domain.
- [x] Owner clears photographed tools for public use; reuse Cash App/Venmo/PayPal
  and the existing tapps.design contact form from the supplied support page.
- [ ] Configure Clerk/Railway and verify real account saves. Complete party, replay,
  retention/deletion and sharing gates before advertising those as available.
- [x] Public light/dark appearance with remembered choice; dark, non-repeating
  footer in both themes; publish the owner's texture-edited 4K WebP panorama.
- [x] Days One headings and Square Peg handwriting; draggable hero panorama with
  pausable, offscreen-aware slow rotation and static reduced-motion appearance.
- [ ] Real room lighting: adjustable lamps, light colors and rendered scene moods
  with matching shadows/exposure. Replace the retired flat color-wash switch.

## Owner-requested accounts and community slice — October 30, 2026

- [x] Viga public headings; retain Square Peg handwriting.
- [x] Private-by-default profiles, original no-photo avatar badge editor, explicit
  profile sharing, mutual friend requests, decline/remove and requests-off controls.
- [x] Account-owned scheduled parties with time zones; connected-friend account
  invitations, hashed/revocable share links, RSVP/cancel and calendar reminders.
- [x] Approved Resend REST adapter and durable opt-in account-mail outbox; delivery
  defaults off, verified primary email only, bounded idempotent retries/statuses.
- [x] Real local Postgres authorization/visibility/friendship/invite/mail tests.
- [ ] Reconnect Railway; configure Clerk email codes and production Discord OAuth;
  deploy account server + Postgres and prove real two-account browser sessions.
- [ ] Configure verified Resend sender, tracking-off settings, suppression/bounce
  handling and expected-invite policy; test opt-in delivery, opt-out and cancellation
  with consenting recipients before setting ACCOUNT_EMAIL_ENABLED=1.
- [ ] Authenticated party-join tickets and verified account/member mapping; Add friend
  during a party without trusting a browser-supplied account ID.
- [ ] Server-written completed-party/painting history, private recap room image of
  artwork/avatars, attendee profile/friend actions and authorized shared-art links.
- [ ] Guest/nonmember RSVP, rescheduling with updated calendar/email jobs, reporting,
  account deletion/retention and real-device avatar/call checks before broad launch.
