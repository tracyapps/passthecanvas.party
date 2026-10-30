# Asset credits

Every asset used in the studio that is **not** from Poly Haven gets a line here *before* it's committed.

| Asset | Source | Author | License | Used in |
| --- | --- | --- | --- | --- |
| All models, textures, HDRIs unless listed below | [Poly Haven](https://polyhaven.com) | Poly Haven contributors | CC0 | Everywhere |
| Cream City draft architecture, sofa, patterned rugs, easels, cat-tree and cat maquettes, coffee-machine maquette, lettering and abstract colour studies | `scripts/build_cream_city.py` | Created for Tapps in this workspace | Original project-generated geometry and designs; no external artwork copied | `blender/cream-city-studio.blend` and `renders/cream-city/` |
| Room-element PNG reference images (not rendered) | Owner-supplied `_design/room-elements/` | Tapps; supplied as owner-created references | Owner-supplied for this design; confirm any underlying third-party rights before public redistribution | Packed into the hidden REFERENCES collection in the draft `.blend` only |
| Lime, red and charcoal photographic style studies | Built-in imagegen; inputs documented in `CREAM-CITY-PROMPTS.md` | Generated for Tapps from the scene draft and owner-supplied references | AI-generated design studies, not additional licensed Poly Haven photos | `renders/cream-city/*-photographic-study.png`; review only |
| Six-arm brass pendant, small geometric colour studies and table paint-freckle finish | `scripts/cleanup_cream_city.py` | Original geometry and procedural materials created for this project | Original project-generated designs | Both cleaned studio files and `renders/cream-city/cleaned/` |
| Rug, orange sofa, drying-rack and locker photo planes | Owner-supplied `_design/room-elements/` PNGs | Tapps; supplied as owner-created elements | Owner-supplied for this studio design; original PNGs retained unchanged | Renderable alpha cutouts in `blender/cream-city-studio-wphotos.blend` |

## Cream City draft — exact Poly Haven assets

`whitewashed_brick` (warm buff colour remap, not a verified Cream City brick scan),
`wood_floor_worn`, `wood_floor`, `concrete_floor`, `hanging_industrial_lamp`,
`painted_wooden_chair_01`, `wooden_table_02`, `modern_arm_chair_01`,
`Rockingchair_01`, and `potted_plant_02`. All loaded from the owner's registered
Poly Haven library; CC0. Original library author metadata remains in that library's
per-asset `info.json` files. No inspiration photograph is used as a wall artwork or surface texture.

## Mosaic lamp and sunset

The three-globe mosaic pendant (glass tile geometry, rosette patterns, bronze
hardware and chains) and procedural peach/rose/violet sunset are original designs
created in `scripts/add_mosaic_sunset.py`. The owner's supplied Turkish-lamp
product photograph is visual inspiration only; its pixels are not embedded or
used as a texture. Used in the photo-version Blender file and mosaic-sunset renders.

## Graffiti lettering and light refinements

- [Bangers](https://fonts.google.com/specimen/Bangers), copyright 2010 The Bangers
  Project Authors; SIL Open Font License 1.1. Font and complete license retained in
  `assets/fonts/bangers/` and the font is packed into the Blender file.
- Gradient paint, outlines, spray flecks and light/glass materials are original
  procedural work in `scripts/refine_graffiti_lighting.py`.

## Painting interaction study — local review only

Owner-supplied `_design/artist-tools/*.png` and `_design/mockups/*.svg` provide
the photographic cutouts, wood table and exported canvas-surface effects.
`studio/scripts/prepare_painting_study.py` derives embedded-WebP SVG groups and
a WebP wood texture in the ignored `_design/mockups/asset-review/` folder.
These derivatives are used only by the development-only `?demo=painting`
study and are excluded from production builds. Owner authorization covers
this local design study; underlying asset authors/licenses have not yet been
verified for public redistribution. No third-party imagery is added this round.

- `apps/web/src/lib/canvas/burnishing-pad.svg`: original project-authored vector
  folded cloth/pad, created for the local painting study (2026-10-29). Provisional
  tool artwork; no third-party source or imported texture.

## Initial public website preview — 29 October 2026 (before owner clearance)

At first publication, the site did not redistribute the supplied Downloads pillow
photos or promote the private artist-tool photographs. The owner subsequently
cleared the tool photographs, as recorded below. The pillow photos remain
art-direction references.

Public assets in `apps/web/public/site/`:

- `studio-friends.webp`: original generated still life (crocheted emotional-support
  flaming dumpster, rubber duck, paint block and cassette); generated with the
  built-in image tool for this project. No supplied-photo pixels or branded
  characters were used. Source: `exec-c276ecef-6204-4c55-85aa-f0131d5e30ab.png`.
- `round.webp`, `watercolor.webp`: original generated, unbranded isolated artist
  brush and used watercolor tin. Sources: `exec-d6a51ba4-a171-49cd-a806-3286e0a3503d.png`
  and `exec-77d05732-67dd-4013-83ec-4bcbeb81a34b.png`.
- `walnut.webp`: original generated overhead worn walnut material texture. Source:
  `exec-33158fa4-f6ab-4aa0-986c-1701076acb5b.png`.
- Generated masters are retained in the Codex generated-images folder for this
  chat; reviewed resized WebP derivatives are copied into the project, retain
  alpha when present and have no runtime dependency on that folder. These are
  generated images, not photographs of physical objects owned by Tapps.
- `paper.svg`, `wood.svg`, `pencil.svg`, `eraser.svg`, `tray.svg`, `favicon.svg`:
  original project-authored vectors/materials. Gallery examples are original
  illustrative SVG paintings in `PublicGallery.svelte`, not customer artwork.
- Self-hosted Atkinson Hyperlegible, Bricolage Grotesque and Caveat Latin WOFF2
  files come from Google Fonts (`fonts.gstatic.com`). Their SIL Open Font License
  1.1 texts are shipped beside them, retrieved from the Google Fonts repository
  (`ofl/atkinsonhyperlegible`, `ofl/bricolagegrotesque`, `ofl/caveat`). Fonts are
  served locally; no Google Fonts request is needed by visitors.

The existing Cream City panorama is reused from `public/studio/cream-city` with
its existing Blender/Poly Haven/original-art provenance above, not a new room
render. The public 360° preview has no live camera, microphone or seat collection.

## Owner clearance and public photo promotion — 29 October 2026

The owner explicitly confirmed: **“Yes, I own them or have a license for public
website use”** for `_design/artist-tools`. This resolves the earlier public-use
hold for those tool photographs. It does not change the pillow photos' reference
status. Four existing reviewed, resized quality-90 WebP derivatives are copied
into public assets without altering the supplied originals:

| Public file | Supplied source in `_design/artist-tools` |
| --- | --- |
| `site/round-photo.webp` | `brush-round-clean.png` |
| `site/pencils-photo.webp` | `art-pencils-selection.png` |
| `site/eraser-photo.webp` | `eraser-large.png` |
| `site/watercolor-photo.webp` | `watercolor-palette-36.png` |

These replace the generated/vector brush, pencils, eraser and paint-tin images
used by the initial public painting preview. Generated trinket and walnut assets
remain. Further tool-photo promotion can use this owner clearance, while retaining
per-file provenance and checking display quality/geometry.

### Owner-edited Cream City panorama — October 30, 2026

`apps/web/public/studio/cream-city/panorama.webp` now derives from the owner's
Photoshop texture edit `_design/panorama-edit.png`, retaining the existing scene's
asset credits above. No new third-party artwork added. Export: Pillow WebP,
quality 90, method 6, RGB, 4096 × 2048, 1,472,468 bytes. No resize or projection
change; original PNG preserved in `_design`.
