# Poly Haven asset guide

All Poly Haven assets are **CC0**: free for any use, commercial included, no attribution required. We credit them in the README and the app's About screen anyway.

- Blender add-on (Patreon tier, which Tapps has): adds the full library to Blender's Asset Browser. In Preferences → File Paths → Asset Libraries, add a library named "Poly Haven". Then Asset Browser → Poly Haven → **Fetch Assets** (about 3.3 GB first time). Re-fetch for new assets.
- The add-on lets you switch asset resolution after import, sets real-world texture scale, and gives HDRI rotation, brightness and temperature sliders.
- The public API (api.polyhaven.com) is free for commercial use. It could load extra props at runtime later. Not needed for v1.

Names below are the asset IDs as they appear in the add-on and API (checked Oct 25, 2026).

## Placeholder rooms (phase 1)

Indoor HDRIs that are already 360° photos of studios. Use one in the viewer before the Blender room exists:

- `art_studio`
- `artist_workshop`

## Assets by zone

| Zone | From Poly Haven | Build or source |
| --- | --- | --- |
| Room shell | Floor, brick and plaster textures; an outdoor HDRI for the windows; `hanging_industrial_lamp`, `modern_ceiling_lamp_01` | Walls, windows, floor (boxes) |
| Painting table | `WoodenTable_01`, `wooden_table_02`, `dining_table`; chairs `WoodenChair_01`, `painted_wooden_chair_01`, `wooden_stool_01` | — |
| Couch corner | `Sofa_01`, `sofa_02`, `sofa_03`, `throw_pillows_01`, `coffee_table_round_01` | — |
| Giant bean bag | Fabric textures | Cloth sim: a UV sphere with pinning, dropped onto the floor |
| Drafting table | `desk_lamp_arm_01` (rigged), `wooden_stool_02`, wood textures | The tilted table |
| Rocking chair nook | `Rockingchair_01`, `side_table_01`, `vintage_oil_lamp`, `potted_plant_02` | — |
| Cat tree | Wood + fabric textures; `concrete_cat_statue` (joke prop) | Posts, platforms, cubby; the cats |
| Snack table | `round_wooden_table_01`, `carrot_cake`, `strawberry_chocolate_cake`, `croissant`, `bananas`, `food_apple_01`, `food_kiwi_01`, `wooden_bowl_01`, `wooden_cutting_board`, `tea_set_01`, `jug_01`, `standing_chalkboard_01` (snack menu) | Chips, party snacks |
| Easel and art wall | `hanging_picture_frame_01`–`03`, `fancy_picture_frame_01`, `standing_picture_frame_01`, `spray_paint_bottles`, `painted_wooden_shelves`, `wicker_basket_01` | Easel, brush jar, paint tubes, palette |
| Music corner | `vintage_radio_transceiver` (the party radio), `boombox`, `cassette_player` | — |
| Timer | `alarm_clock_01` (rigged), `wall_clock` | The kitchen timer from the design |
| Greenery anywhere | `potted_plant_01`, `potted_plant_02`, `potted_plant_04`, `planter_pot_clay`, `pachira_aquatica_01` | — |

## The cats

Poly Haven has no cats (just `street_rat` and a concrete cat statue). Options, best first:

1. **Filmed clips** of real cats (your own, friends', or footage you have rights to), cut out and looped: idle, stretch, purr, chase toy. Most real, and they drop straight into the overlay layer.
2. **A rigged 3D cat** (bought or commissioned, license recorded in `studio/ASSET-CREDITS.md`), rendered into loops in Blender with the room's lighting.
3. **A real-time 3D cat** (phase 4) that walks around.

## Rules

- Prefer **2k textures** for anything that ends up small in the panorama, and 4k only for hero surfaces (the table, the floor near the viewer).
- Anything not from Poly Haven → add it to `studio/ASSET-CREDITS.md` with source, author and license **before** committing.
