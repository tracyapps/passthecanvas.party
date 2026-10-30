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
