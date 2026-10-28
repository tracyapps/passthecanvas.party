# The studio (Blender)

One `.blend` per room. Every image the web app shows is rendered from it, so a change in Blender reaches the app with one re-render and one script run.

```
studio/
  blender/           loft-studio.blend (+ future rooms)   ← Git LFS
  scripts/           export_spots.py
  renders/           raw renders before compression       ← Git LFS
  ASSET-CREDITS.md   anything not from Poly Haven
```

Web-ready outputs go to `apps/web/public/studio/<room>/`.

## Cream City design draft (Oct 27, 2026)

Open `blender/cream-city-studio.blend` for three editable colour/lighting scenes.
The beginner editing guide, preview filenames, reference handling, render steps,
and remaining integration checks are in [CREAM-CITY-GUIDE.md](CREAM-CITY-GUIDE.md).
This is a separate review draft; the app's original panorama is still active.

The owner-developed layouts were cleaned and rendered on Oct 28. See
[CLEANUP-2026-10-28.md](CLEANUP-2026-10-28.md) for the repaired files, photo-cutout
recommendation, lighting controls, render command and verification receipts.

## 0. One-time setup

- Poly Haven add-on installed, library named **Poly Haven**, assets fetched (see `docs/POLY-HAVEN.md`).
- `git lfs install` in the repo, so `.blend` and renders don't bloat git.
- Units: Metric, scale 1.0. Render engine: Cycles (GPU / Metal).

## 1. Block out the room

- Name the scene after the room: `loft` (this becomes the folder name in the web app).
- Walls, floor, ceiling, windows as simple boxes at real size. Something like 9 × 7 m with a 3.5 m ceiling feels loft-ish. Adjust to taste.
- Collections: `ROOM_shell`, `ZONE_table`, `ZONE_couch`, `ZONE_beanbag`, `ZONE_drafting`, `ZONE_rocker`, `ZONE_cats`, `ZONE_snacks`, `ZONE_easel`, `ZONE_music`, `LIGHTS`, `SPOTS`.

## 2. The viewer's eye

- Add a camera named **`PANO_CAM`** at the room's center, **1.6 m** high, rotation X 90°, Y 0°, Z 0° (facing the painting table).
- Camera → Type **Panoramic** → **Equirectangular**.

## 3. Place the zones

Clockwise from the front (see the floor plan in docs/PLAN.md): table 0°, easel 40°, music 80°, snacks 120°, cat tree 160°, rocking chair 200°, bean bag 240°, drafting table 280°, couch 320°.

Tips:
- Keep zones 2.5–4 m from the camera. Closer gets distorted, further gets tiny.
- Nothing within about 1 m of the camera (it'll look huge and warped).
- Leave clear wall space behind each seat. That's where guest video will float.

Missing pieces to build: bean bag (UV sphere + cloth sim, pinned bottom, drop onto the floor, apply), drafting table (tilted board on a frame), easel, cat tree (cylinders wrapped in a sisal-ish fabric texture plus platforms).

## 4. Light it: three moods

Use one view layer (or scene copy) per mood:

| Mood | World HDRI (outdoor, via the add-on) | Lamps |
| --- | --- | --- |
| `morning` | Bright overcast or morning sky, low strength | Off |
| `golden` | Low warm sun, rotated so it rakes across the table | Low, warm |
| `night` | Dark blue night sky, very low | Pendants on, warm pools of light |

## 5. Mark the spots

- Add an **Empty** (Plain Axes) at each seat, roughly where a person's head would be, inside the `SPOTS` collection.
- Name: `spot_<zone>_<detail>` e.g. `spot_table_1` … `spot_table_8`, `spot_couch_left`, `spot_beanbag_a`, `spot_rocker`, `spot_drafting`.
- Also: `spot_canvas` (on the table), `spot_timer`, `spot_radio`, `spot_cats_top`, `spot_cats_cubby`.
- Custom property `label` (Object properties → Custom Properties): the human name, e.g. "Couch, left cushion". This is what screen readers say.
- Run `scripts/export_spots.py` from the Scripting workspace. It writes `apps/web/public/studio/<room>/spots.json`.
- **First time:** do the alignment check described at the top of the script.

## 6. Render the panoramas

- Cycles, denoise on, samples about 512 (raise if grainy), Filmic/AgX view transform.
- Resolution **8192 × 4096** (desktop) and **4096 × 2048** (phone). Keep it 2:1.
- Render each mood → `studio/renders/<room>/<mood>-8k.png` (and `-4k`).
- Compress for the web, e.g. `cwebp -q 82 in.png -o apps/web/public/studio/loft/golden-8k.webp`. AVIF if size matters more.
- Target: under 3 MB for the 8k WebP, under 1 MB for the 4k.

## 7. Painting-view renders

- A second camera `TABLE_CAM`, orthographic, straight down over the table, framing the canvas area plus the brush jar and palette.
- Render the table top without the canvas (the web app draws the canvas) → `apps/web/public/studio/loft/table-<mood>.webp`.
- Close-up hero renders of the brush jar, palette, kitchen timer and radio can replace the CSS stand-ins in the UI.

## 8. Cats

Decide: filmed loops vs rendered loops (see docs/DECISIONS.md, open questions). For rendered loops: same lighting, transparent background (Film → Transparent), short seamless loops, WebM with alpha (VP9), and a still PNG of the first frame for reduced motion.

## Checklist per room

- [ ] Scene named, `PANO_CAM` placed, zones placed
- [ ] All `spot_*` empties with `label`
- [ ] `spots.json` exported and alignment checked
- [ ] 3 moods × 2 sizes rendered and compressed
- [ ] Table renders done
- [ ] Non-Poly Haven assets listed in `ASSET-CREDITS.md`

Latest photo-layout finish: [mosaic pendant and sunset controls](MOSAIC-SUNSET.md).
The incoming owner version was backed up before saving the lamp and sunset.

Latest finishing round: [graffiti, sconce glass and coloured-light controls](GRAFFITI-LIGHTING.md).
