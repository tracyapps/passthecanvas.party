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
- [ ] One HTML marker holding a live `<video>` (your own webcam) pinned at a yaw/pitch, checked for smoothness on a phone *(marker + camera wiring done and in the DOM; final check needs LiveKit keys + a real camera/phone)*
- [x] Markers load from `public/studio/placeholder/spots.json`

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
- [ ] Accessibility pass: keyboard stamp-mode painting, screen-reader turn announcements, captions plan
- [ ] Low bandwidth: audio + avatar fallback, smaller assets on phones
- [ ] Deploy: web on a static host/CDN, party server on a small VPS or Fly/Render, domain `passthecanvas.party`

---

## Phase 3: The magic studio

Replace placeholders with the real Blender studio.

**Gate: the room feels real on a mid-range phone, and loads in under 3 s on decent wifi.**

- [ ] Block out the loft studio in Blender (`studio/blender/loft-studio.blend`)
- [ ] Place all nine zones with Poly Haven assets (see `docs/POLY-HAVEN.md`)
- [ ] Build missing pieces: bean bag (cloth sim), drafting table, easel, cat tree
- [ ] Three lighting moods: morning, golden hour, lamp-lit night
- [ ] `spot_*` empties for every seat + cats, canvas, timer, radio
- [ ] Run `export_spots.py` → `apps/web/public/studio/loft/spots.json`
- [ ] Render panoramas (8k desktop, 4k phone) per mood → WebP/AVIF
- [ ] Render the top-down painting-view table and props; re-skin the painting view
- [ ] Cats: decide filmed vs rendered loops; make idle + react loops for 2–3 cats
- [ ] Snack table props interactive (click a snack: tiny animation, sound optional and off by default)
- [ ] Spot picking in the 360° room ("Sit here" markers, list alternative)

---

## Phase 4: Extras

- [ ] More rooms for the scene library (Garden Atelier, Rooftop at Dusk, Cabin Workshop…)
- [ ] Wandering 3D cats (three.js layer aligned to the panorama)
- [ ] A panorama per spot (see the room from where you sit)
- [ ] Prints: partner TBD
- [ ] `passthe.art` short links for sharing finished pieces
