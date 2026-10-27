# Decisions

A running log. Newest first. One line for small calls, a short paragraph for big ones. Agents: add an entry when you make a choice someone might later ask "why?" about.

| Date | Decision | Why |
| --- | --- | --- |
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
