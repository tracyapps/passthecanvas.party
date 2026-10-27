# AGENTS.md — instructions for any coding agent

Read this whole file before touching code. It applies to every agent (Claude, Codex, Copilot, Gemini, others) and every human contributor.

## 1. What we're building

**Pass the Canvas** (`passthecanvas.party`) is a browser app for video parties where friends take turns painting one shared canvas against a timer. When the timer runs out, the canvas "passes" to the next person. After everyone has had a turn, the group gets a finished piece to take home.

The interface should feel like a real art studio: a walnut table, brushes in a glass jar, a wooden palette, a kitchen timer, a tube radio. Guests hang out in a photoreal 360° studio built in Blender from Poly Haven assets.

Full context: [`docs/PLAN.md`](docs/PLAN.md). Current phase and tasks: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## 2. The owner, and how to work with him

The owner is **Tapps**, a UX designer who has hand-coded HTML and CSS/SCSS since 1996. JavaScript is the part that doesn't come naturally to him. So:

- **Prefer HTML and CSS solutions.** If CSS can do it (layout, states, animation, `:has()`, container queries, `<dialog>`, popover), don't use JS.
- **Write JS/TS that a designer can read.** Use plain names, small functions, early returns, and no clever one-liners. Add a short comment above anything non-obvious explaining *why*, in plain English.
- **Explain changes briefly.** Say what changed, where, and why, in a few sentences or bullets. Don't write walls of text.
- **Ask before big structural changes** (new dependency, new service, changing the protocol or folder layout). Small, reversible decisions: make them and note them in `docs/DECISIONS.md`.

## 3. Non-negotiables

1. **Accessibility is a requirement, not a polish step.** WCAG 2.2 AA minimum. See [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md). Every feature that needs looking or dragging has a keyboard and screen-reader path. Use real `<button>`, `<a href>`, `<input>` + `<label>`, never clickable `<div>`s. Respect `prefers-reduced-motion`. Text contrast is at least 4.5:1. Touch targets are at least 44×44px.
2. **Ethics and privacy.** Video and audio are never recorded or stored. Only canvas snapshots are saved, and only for that party. No analytics or trackers without an explicit decision in `docs/DECISIONS.md`. Avatars are a first-class alternative to camera, never a downgrade.
3. **No emoji in UI.** Icons are inline stroke SVGs.
4. **The look is real objects** (wood, paper, glass, masking tape), not glossy app chrome. Follow [`docs/DESIGN.md`](docs/DESIGN.md) and the tokens in `apps/web/src/styles/_tokens.scss`.
5. **Only CC0 or properly licensed assets.** Poly Haven assets are CC0. Anything else needs its license noted in `studio/ASSET-CREDITS.md` before it's committed.
6. **No secrets in git.** API keys go in `.env` files (gitignored). Each app has a `.env.example`.

## 4. Stack

| Part | Choice | Where |
| --- | --- | --- |
| Front end | Svelte 5 + Vite, SCSS, TypeScript | `apps/web` |
| 360° room | Photo Sphere Viewer (+ markers, gyroscope plugins) | `apps/web/src/lib/room` |
| Painting | HTML `<canvas>` with Pointer Events (pressure) | `apps/web/src/lib/canvas` |
| Video and audio | LiveKit (Cloud to start, self-host later) | `apps/web/src/lib/call`, `apps/server` |
| Party server | Node + `ws` WebSocket server, TypeScript | `apps/server` |
| Shared types | Message protocol and game types | `packages/shared` |
| Party radio | Radio Browser API; each browser streams the station itself | `apps/web/src/lib/radio` |
| 3D studio | Blender + Poly Haven add-on, Cycles equirectangular renders | `studio/` |

Node version: see `.nvmrc`. Package manager: **npm workspaces** (keep it boring).

## 5. Commands

```bash
npm install            # install everything (run at repo root)
npm run dev            # web app + party server together
npm run dev:web        # web app only  → http://localhost:5173
npm run dev:server     # party server only → ws://localhost:8787
npm run check          # type-check all workspaces
npm run build          # production build of the web app
npm test               # unit tests (vitest)
```

## 6. Folder map

```
apps/web/            Svelte front end
  src/lib/canvas/    painting engine (brushes, strokes, undo)
  src/lib/room/      360° room viewer + overlays (spots, cats, props)
  src/lib/call/      LiveKit video/audio
  src/lib/radio/     party radio
  src/lib/party/     client for the party server (turns, timer, chat)
  src/lib/ui/        shared real-object UI pieces (timer dial, tape label…)
  src/styles/        SCSS tokens, base, mixins
  public/studio/     rendered panoramas + spots.json (from Blender)
apps/server/         party server (rooms, turns, timer, stroke relay, snapshots)
packages/shared/     protocol types shared by web + server
studio/              Blender files, export scripts, render outputs
docs/                plan, roadmap, architecture, decisions
```

## 7. How the pieces talk

- The **party server** is the source of truth for turn order, the timer, who sits where, and chat. Clients never decide whose turn it is.
- **Only the current painter's strokes are accepted.** The server drops strokes from anyone else.
- Strokes travel as small messages (see `packages/shared/src/protocol.ts`), never as video. Late joiners get the latest snapshot, then the live strokes.
- **Video and audio go through LiveKit only.** The party server just mints LiveKit access tokens.
- **The room is static images.** The 360° panoramas and `spots.json` come from Blender (see `studio/README.md`). Never hand-place overlay coordinates in code. They come from `spots.json`.

Changing a message shape means updating `packages/shared` first, then both apps, in the same change.

## 8. Working on the roadmap

1. Open `docs/ROADMAP.md`, find the current phase, and pick the first unchecked task (or the one you were asked to do).
2. Keep each change small and focused on one task.
3. When it's done, tick the box, and add a line to `docs/DECISIONS.md` if you made a choice someone might later ask "why?" about.
4. Don't start the next phase's work until the current phase's gate passes.

## 9. Definition of done

- [ ] Works with mouse, touch **and** keyboard alone
- [ ] Screen reader announces it sensibly (names, states, live updates where needed)
- [ ] Works at 360px wide and at 1440px wide
- [ ] Respects reduced motion
- [ ] `npm run check` and `npm test` pass
- [ ] No new dependency without a note in `docs/DECISIONS.md`
- [ ] Docs updated if behavior or structure changed

## 10. Don'ts

- Don't add a UI framework or component library on top of Svelte. We build our own real-object components.
- Don't add state-management libraries. Svelte runes and stores are enough.
- Don't commit `.blend` files or renders without Git LFS (see `studio/README.md`).
- Don't relay or rebroadcast radio audio. Each client streams it itself (licensing).
- Don't record, transcribe-and-store, or analyze anyone's video or audio.
