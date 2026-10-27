# Pass the Canvas — Build Plan

*As of Oct 26, 2026 · Owner: Tapps · Living version: [Claude Doc](https://claude.ai/artifact/XRbyGuhLJhfmsyvcqaFYf5) · Design canvas: [Claude Design](https://claude.ai/artifact/TGRYKv8LbSE1kUhiebrtzV)*

## Summary

Pass the Canvas is a browser app where friends at a video party take turns painting one shared canvas on a timer, then everyone takes the finished piece home. The studio is built in Blender from Poly Haven assets and shown on the web in two layers:

- **A 360° room you stand in the middle of.** It's a photoreal panorama rendered in Blender, so it looks like Poly Haven quality on any laptop or phone.
- **Live things placed on top of the room.** Guests' video or avatars, the cats, the canvas and the timer are real-time layers pinned to spots in the panorama.

The painting view from the design canvas (walnut table, brush jar, palette, kitchen timer, tube radio) stays as the main working screen. The 360° room replaces the flat room view as the social space.

## The 360° room

You stand in the middle of the studio and drag (or swipe, arrow-key, or tilt your phone) to look all the way around.

**Layer 1: the room, as a baked panorama.** The studio is lit and rendered once in Blender with Cycles through a 360° (equirectangular) camera at the center of the room. The result is one 2:1 image, such as 8192×4096. In the browser it wraps around you on a sphere. All the expensive work happens in Blender, so the browser only shows a picture.

**Layer 2: live things, pinned into the room.** Anything that moves or changes floats above the panorama, pinned to a direction (yaw/pitch):

- Guest video or avatar at each spot (couch, bean bag, rocking chair…)
- The cats on the cat tree, which react when you click or tap them
- The canvas on the table, showing the current painting live
- The kitchen timer and radio, which keep working from anywhere in the room
- Open-spot markers ("Sit here") during spot picking

**Why not a full real-time 3D scene?** It would look much worse than Poly Haven assets do in Blender on most laptops, and drain batteries over a two-hour party. A panorama gives full Blender quality for the cost of one image. Phase 4 adds a real-time 3D layer for wandering cats if they become a must.

**Viewer:** [Photo Sphere Viewer](https://photo-sphere-viewer.js.org), an open-source JavaScript panorama viewer with official plugins for HTML markers, video overlays, gyroscope, compass and limits on how far you can look. Still to confirm in phase 1: a live `<video>` inside an HTML marker performs well, and how its keyboard support works.

## Room layout

The painting table sits straight ahead when you arrive. The other eight zones ring the room, each a clear turn of the head away:

| Direction (clockwise from front) | Zone | Purpose |
| --- | --- | --- |
| 0° | Painting table | The shared canvas; most spots |
| 40° | Easel and art wall | Finished rounds hang here |
| 80° | Music corner | The party radio |
| 120° | Snack table | Cake, fruit, tea; hang out between turns |
| 160° | Cat tree | Click the cats to play |
| 200° | Rocking chair | Cozy reading nook |
| 240° | Giant bean bag | Fits two |
| 280° | Drafting table | Doodle on a private scratch pad while you wait |
| 320° | Couch | Lounge seats |

These angles are a starting layout. The real angles come from Blender via `spots.json`.

**Owner's note (Oct 2026):** make it a **hybrid studio–coffee house**. The snack table grows into a café corner (espresso machine, window counter with stools, chalkboard menu — the café vibe), and the room gains more spots to sit and create (a small easel, sketch stools at the window). The zone ring gets re-cut when the room is blocked out in Blender; more spots is just more rows in `spots.json`, since the web app never hard-codes coordinates.

## Using Poly Haven

See [POLY-HAVEN.md](POLY-HAVEN.md) for the full asset list per zone. Short version:

- Everything is CC0: free for any use, commercial included. Credit them anyway.
- The Patreon Blender add-on puts the whole library into the Asset Browser (about 3.3 GB first fetch).
- Missing from Poly Haven: bean bag, drafting table, easel, cat tree, cats. Those get built or sourced.
- **Fast prototype:** the `art_studio` and `artist_workshop` HDRIs are already 360° photos of real studios. Use one as a placeholder room in phase 1.

## Blender pipeline

See [../studio/README.md](../studio/README.md) for the step-by-step version.

1. Block out the room at real scale. Put the viewer's eye at about 1.6 m in the center.
2. Place the zones in a ring and drag in Poly Haven assets.
3. Light with an outdoor HDRI plus the pendant lamps. Make three moods (morning, golden hour, lamp-lit night).
4. Mark every spot with a named empty (`spot_couch_left`…). `studio/scripts/export_spots.py` writes their yaw/pitch to `spots.json`.
5. Render equirectangular panoramas in Cycles: 8192×4096 desktop and 4096×2048 phone, per mood, saved as WebP/AVIF.
6. Render the top-down painting-view table and props.
7. Render cat loops (if 3D cats) with transparent backgrounds.
8. Each extra room in the scene library is its own `.blend`, run through the same steps.

## Web app architecture

See [ARCHITECTURE.md](ARCHITECTURE.md).

- **Video and audio:** LiveKit (open source, Apache 2.0). Start on LiveKit Cloud's free monthly allowance, self-host later.
- **Party server:** turn order, timer, spots, chat. Relays strokes and saves a PNG at the end of each round.
- **Party radio:** Radio Browser directory. Each browser streams the station itself, and the server only syncs which station is on.
- **Room images:** static files on a CDN.
- **Front end:** Svelte, because its components are mostly HTML and SCSS with a thin script block.

## Accessibility and inclusion

See [ACCESSIBILITY.md](ACCESSIBILITY.md).

## Phases

See [ROADMAP.md](ROADMAP.md). The short version: 1. Prove it → 2. The party → 3. The magic studio → 4. Extras.

## Sources

- [Poly Haven: commercial licensing and API](https://polyhaven.com/corporate)
- [Poly Haven Blender add-on](https://github.com/Poly-Haven/polyhavenassets)
- [Photo Sphere Viewer](https://photo-sphere-viewer.js.org)
- [LiveKit](https://github.com/livekit/livekit)
- [Radio Browser](https://www.radio-browser.info)
