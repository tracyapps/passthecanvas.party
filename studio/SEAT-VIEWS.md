# Seat views and the texture pass (Nov 2026)

Two scripts turn the Cream City studio into a room you can see from any seat.
Both run Blender in the background, so Blender doesn't need to be open.

```bash
BLENDER=/Applications/design/Blender.app/Contents/MacOS/Blender
FILE=studio/blender/cream-city-studio-wphotos.blend

# 1. Texture pass (re-runnable; it replaces its own earlier changes)
$BLENDER -b $FILE --python studio/scripts/texture_pass.py -- --save
#    add  --render studio/renders/cream-city/texture-pass/review-center.png  for a quick check

# 1b. Canvas storage on the nook's steel shelves (re-runnable)
$BLENDER -b $FILE --python studio/scripts/add_canvas_rack.py -- --save

# 1c. The tall locker texture (plain Python + Pillow, not Blender)
python3 studio/scripts/make_locker_texture.py

# 2. A panorama + seat/art positions for every spot in spots.json
$BLENDER -b $FILE --python studio/scripts/seat_views.py --            # draft: 2048 px, 64 samples
$BLENDER -b $FILE --python studio/scripts/seat_views.py -- --final --center   # 4096 px, 128 samples, + the middle-of-the-room panorama
#    --only spot_couch_left,spot_beanbag   just some seats
#    --data-only                           positions only, no renders
```

## What the texture pass changes

Everything it adds is named `TEXTURE PASS — …` so it can be found and re-run.

| What | How |
| --- | --- |
| Couch | Draped burnt-orange sheet: soft folds in the actual shape (subdivide + cloud displace), cotton sheen, fine weave bump, a few paint smudges |
| Giant beanbag | Dark green crushed velvet: big soft folds, sheen, paint flecks |
| Throw pillows | Now the owner's Poly Haven `throw_pillows_01` (the script's photo pillow was retired) |
| Locker | New tall, skinny locker against the east brick, left of the coffee-nook opening. `studio/textures/locker-tall.png` is the locker photo with its top row of small lockers repeated and renumbered 1–9 (`make_locker_texture.py`) |
| Nook shelves | `add_canvas_rack.py`: canvases stored on edge on two shelves of the laptop's steel shelving, some painted, some blank, one leaning face-out per shelf |
| Drying rack | The flat photo card is removed (it only worked from the center) |
| Ceiling + all walnut timber | Darker and uneven, water stains, dirt in the corners |
| Painting table | Darker, more paint drips and splatters, dirt in crevices |
| Chairs, stools, side tables, cabinets, barrel, shelves | Crevice dirt, paint drips, paint flecks (gathered in patches, not polka dots) |

The rug is unchanged.

## How seat views work

`spots.json` (made in the web spots editor) only says which *direction* each
seat is from the middle of the room. The script finds each seat in 3D by
walking along that direction and looking down for a seat about a head-height
below (chairs, the sofa, the beanbag, sills…). A few spots it can't read
are placed by hand in `EYE_OVERRIDES` at the top of `seat_views.py`.

For each seat it renders a 360° panorama at sitting eye height, facing the
middle of the room, and re-projects every other seat and every art area into
that view (skipping ones hidden behind something). Output:

```
apps/web/public/studio/cream-city/seats/
  index.json                   which seats have a view (and "draft": true/false)
  <spot>/panorama.webp
  <spot>/spots.json            the other seats, as seen from here
  <spot>/art.json              the wall/lean art areas, as seen from here
```

The party uses a seat view automatically once you've picked that seat; "From
the middle of the room" switches back.

## Moving a seat

If a view sits in the wrong place: add or edit that spot in `EYE_OVERRIDES`
(x, y, z in meters, as in Blender's N panel; z ≈ 1.2 sitting, 1.6 standing)
and re-run with `--only <spot>`.

## The published panorama

`--center` renders the middle-of-the-room view straight from Blender into
`apps/web/public/studio/cream-city/panorama.webp`. Since the Photoshop fixes
now live in the .blend, this replaces the Photoshop-edited version (kept at
`studio/renders/cream-city/panorama-photoshop-edit-2026-10-30.webp`).

## The 3D seat map and the room tool

- `seats/geometry.json` (written by every run): the middle camera, each seat
  view's camera (`eye`, `forward`, `right`, `up` in Blender meters), each
  seat's marker position in 3D, and per view the seats that are `hidden`
  behind something.
- Each `seats/<spot>/spots.json` is computed from it, so you never edit those
  by hand.
- **Check or fix placement**: run the dev servers and open
  `/?seats=cream-city`.
  1. Pick a viewpoint (middle of the room or any seat).
  2. "Fill every seat" puts a placeholder guest everywhere; Reshuffle mixes
     cameras and initials cards. "Sample artwork" (middle view) hangs
     placeholder paintings where a party's would go.
  3. Choose a seat in the list, then click where its head should be, or use
     the Up / Left / Right / Down nudges (0.5° each).
  4. "Hidden from here" drops a seat from that one view.
  5. Save. The server rewrites `spots.json`, `geometry.json` and every seat
     view's `spots.json`.
- **New room**: render `panorama.webp`, plot seats with `?spots=<room>`, then
  run `seat_views.py --room <room>` for seat views. Before that, the room
  tool works on the middle view alone.
- Re-running `seat_views.py` recomputes markers from the Blender scene and
  overwrites hand-placed ones. Re-place them in the tool afterwards, or run
  with `--only` for just the seats you changed.
- Artwork is in the middle view only (`art.json` beside `panorama.webp`,
  edited with `?art=<room>`); seat views have no art.

