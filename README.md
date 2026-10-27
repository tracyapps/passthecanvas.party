# Pass the Canvas

**passthecanvas.party**: a virtual "pass the canvas" party game. Friends on a video call take turns painting one shared canvas against a timer, hang out in a photoreal 360° art studio, and go home with a piece they made together.

> Status: **Phase 1, Prove it.** See [docs/ROADMAP.md](docs/ROADMAP.md).

## Start here

| If you want to… | Read |
| --- | --- |
| Understand the idea and the approach | [docs/PLAN.md](docs/PLAN.md) |
| See what's being built next | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Write code (humans and AI agents) | [AGENTS.md](AGENTS.md) |
| Understand how the parts connect | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Build the 3D studio in Blender | [studio/README.md](studio/README.md) and [docs/POLY-HAVEN.md](docs/POLY-HAVEN.md) |
| Check accessibility rules | [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) |
| See the look and design tokens | [docs/DESIGN.md](docs/DESIGN.md) |
| Know why something is the way it is | [docs/DECISIONS.md](docs/DECISIONS.md) |

## Run it

```bash
nvm use            # Node version from .nvmrc
npm install
cp apps/server/.env.example apps/server/.env   # add LiveKit keys when you have them
npm run dev        # web on :5173, party server on :8787
```

## Layout

```
apps/web         Svelte front end (painting view, 360° room, call controls)
apps/server      party server (turns, timer, strokes, LiveKit tokens)
packages/shared  message types shared by both
studio           Blender files, export scripts, renders
docs             plan, roadmap, architecture, decisions
```

## Credits

3D models, textures and HDRIs from [Poly Haven](https://polyhaven.com) (CC0). Thank you for making the internet more beautiful.
