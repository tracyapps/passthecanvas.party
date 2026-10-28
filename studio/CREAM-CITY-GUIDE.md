# Your Cream City studio

Open `studio/blender/cream-city-studio.blend` in **Blender 5.1**. This is an editable, furnished design draft, built at real scale: **11 × 8 m**, with a **3.6 m** ceiling and a small adjoining coffee nook. It is intentionally more open than the original art-studio photograph, while keeping furniture and warm materials close enough to feel sociable.

The scene selector at the top right of Blender switches between three looks:

| Scene | Direction | Preview |
| --- | --- | --- |
| 01 — Lime / daylight | Buff brick, acid green paint, daylight, warm pendants | `renders/cream-city/lime-daylight-review.png` |
| 02 — Red / late afternoon | Red paint, warmer afternoon light, “ART IS RESISTANCE” | `renders/cream-city/red-afternoon-review.png` |
| 03 — Charcoal / evening | Charcoal paint, cool window light, warmer lamp pools | `renders/cream-city/charcoal-evening-review.png` |

Each also has a `*-panorama-draft.png`: a genuine **2048 × 1024 equirectangular render**, showing the full 360° horizontally and 180° vertically. The perspective review images are easier to judge on a flat screen. These are draft-resolution previews; the saved Blender scenes are set to 4096 × 2048 and 128 samples for your next render.

## Compare the finished-looking direction with the editable bones

The three `renders/cream-city/*-photographic-study.png` files are AI-generated
style studies made with the built-in imagegen tool, using the Blender panorama
and your reference contact sheet. They add realistic worn furniture, textiles,
cats and restrained working clutter. **They are not exact renders of the Blender
model, and those added details are not automatically editable 3D objects.**
The prompts and input provenance are saved in [CREAM-CITY-PROMPTS.md](CREAM-CITY-PROMPTS.md).
Keep them as art-direction references rather than treating them as production-resolution room assets.

There is a local 360° comparison page at `renders/cream-city/review.html`.
It uses the existing Photo Sphere Viewer and Three.js packages, with no CDN or
new dependency. From the repository root, run:

```sh
python3 -m http.server 5180 --bind 127.0.0.1
```

Then open [the review page](http://localhost:5180/studio/renders/cream-city/review.html).
If you already run the Vite web app, you can also open the file through Vite's
`/@fs/` URL. The review server started during this session used port 5174.

Choose a **Look**, then switch **Image** between the photographic study and the
actual Blender draft. Drag or swipe to look around; Tab to the room and use arrow
keys. Native buttons face the table, inspect the back wall, and zoom. There is no
automatic camera motion; reduced-motion preference disables drag inertia.

The lime study and actual Blender draft were inspected in this spherical viewer,
including the study's back join and keyboard panning. All three looks were loaded
during review. Generated studies still need final-resolution detail and full seam,
zenith/nadir and marker checks before any app integration. They are approximately
1.8k-wide concept images, not substitutes for final 4k/8k exports.

## What is editable, and what is a reference?

- Walls, openings, floor surfaces, windows, ceiling beams, pipes, accent panels, furniture, lights, canvases, cat tree and lettering are actual scene objects.
- The brick is a **warm buff recolouring of Poly Haven’s whitewashed-brick scan**, approximating the Cream City direction. It is not a documented scan of Milwaukee Cream City brick.
- Scanned chairs, pendants, plants, rocking chair and coffee table use the installed Poly Haven library. Textures are packed into the Blender file so they keep working if the library moves.
- The orange sofa, rugs, beanbag, coffee machine and cats are simple original models. The cats are **maquettes**, not realistic finished cats. Rugs have original geometric patterns; they do not reproduce the Persian-rug cutout.
- Your original furniture PNGs are packed into the hidden **REFERENCES** collection as image references. They are not silently substituted for fully modelled furniture. Enable that collection’s viewport monitor icon in the Outliner to see them, off to the side of the room.
- Reference photographs and your Photoshop file are untouched. The reference photographs are not embedded as artwork or texture maps.
- The existing web app still uses its original panorama. These files are for review before choosing and integrating a room.

The downloaded `.exr` and `.hdr` studio files are panoramic photographs, not editable buildings. Their furniture and cats cannot be moved independently in Blender. Use them as visual references; use models and texture assets to build the new room. [Poly Haven’s HDRI standards](https://docs.polyhaven.com/en/technical-standards/hdris) explain their photo-based sources.

## Five Blender actions to learn first

Use **Object Mode** for all of these. If you accidentally enter Edit Mode, press **Tab** to return. Undo is **Command–Z** on the Mac.

1. **Select:** click an object in the viewport, or click its name in the Outliner at the upper right. For scanned furniture, select the parent named **“MOVE THIS”** in the Outliner so every part follows.
2. **Move:** press **G**, then **X**, **Y** or **Z** to limit movement to an axis. Type a distance in metres, then Return. Example: `G`, `X`, `0.5`, Return moves it half a metre. Escape cancels.
3. **Rotate:** press **R**, then **Z**, type an angle, Return. Example: `R`, `Z`, `15`, Return. This turns furniture on the floor without tipping it over.
4. **Resize:** press **S**, type a factor, Return. `1.1` makes something 10% larger. Prefer moving wall pieces over scaling a whole furnished room: scaling everything also changes the apparent size of people and furniture.
5. **Duplicate:** select a simple object, press **Shift–D**, then an axis and distance. For a whole scanned asset, duplicate its collection hierarchy or drag another copy from the Asset Browser; duplicating only its parent Empty will not copy the furniture.

For exact values, press **N** in the viewport and use the **Item** panel: Location, Rotation, Dimensions. This is the closest equivalent to Photoshop’s transform fields. Use **View → Frame Selected** to find a selected object. Orbit with the navigation gizmo at the viewport’s upper right; zoom with the mouse wheel or trackpad.

## Change an accent colour

In the Outliner, expand the scene’s **LOOK** collection and select **Painted accent wall — north end**. In **Material Properties**, find the material beginning **ACCENT** and edit **Base Color**. That material also colours the nook reveals and the small graffiti study for that look.

The other two scenes have independent accent materials. Architecture and furniture are shared between all scenes: moving a chair changes its placement in all three. Make a separate copy of the `.blend` first if you want to explore a different floor plan.

Select the **Editable neon lettering**, press **Tab**, edit the text, and press Tab again. In Material Properties, its **NEON** material controls emission colour and strength. It is editable extruded lettering with a subtle glow, rather than a physically bent neon-tube model.

## Move a cabinet and all its drawers together

A **collection** is an organisational folder. Selecting its name does not
automatically select every object inside it.

For a quick move of a simple, unrigged asset: right-click its collection in the
Outliner and choose **Select Objects**. Move the pointer over the 3D viewport,
then press **G** to move, **R → Z** to rotate on the floor, or **S** to scale.
Blender's keyboard commands act on the editor under the pointer.

For a permanent relationship, select the drawers/doors first, then **Shift-select
the main cabinet body last**. With the pointer over the 3D viewport, use
**Control–P → Object (Keep Transform)**. On the Mac this is **Control**, not
Command. The main body is now the parent: moving, rotating or scaling it carries
the other pieces. Individual drawers remain separate and editable. This is the
same parenting relationship described in [Blender's manual](https://docs.blender.org/manual/en/5.0/scene_layout/object/editing/parent.html).

The owner's live scene was repaired on October 27: the existing drawers/doors
were parented to these bodies, preserving their current world positions:

| Select this body to move the whole item | Included pieces |
| --- | --- |
| `drawer_cabinet` | Four drawers |
| `painted_wooden_cabinet_02` | Drawer and door |
| `WoodenTable_03_body` | Four drawers and door |
| `painted_wooden_nightstand` | Drawer |
| `wall_clock` | Recovered hour, minute and second hands |

The wall-clock hands were restored using their alignment in the original Poly
Haven asset, keeping the owner's clock-body placement. The separate spare hand
set in `wall_clock.001` was retained. The animated `modern_wooden_cabinet` was not
modified: its door uses a Follow Path constraint and needs its rig handled as a
unit rather than ordinary parenting. Similarly, move the alarm clock using its
existing `rig_alarm_clock_01`, which already owns its parts.

To locate something lost inside a wall: search its name in the Outliner, select
the **object**, then move the pointer over the 3D viewport and use **View → Frame
Selected** (numpad decimal). This changes your view, not the object's location.

A timestamped `cream-city-before-object-repair-*.blend` backup captures the live
scene, including the owner's unsaved work, immediately before the repair. The
repair was left in the open scene for ordinary Save/Save As; the working file was
not overwritten automatically.

## Add a real Poly Haven object

Your Blender 5.1 preferences already register **Poly Haven** at:

`/Users/tapps/Library/CloudStorage/Dropbox/work/3d-stuff/Poly Haven`

The `polyhavenassets` add-on is enabled. Local models and textures were successfully loaded to build this room. Some catalog entries are not downloaded yet; seeing a thumbnail does not guarantee the full asset is available locally. There is no need to reinstall the ZIP to use the working downloaded assets.

1. Save a working copy of the studio.
2. Change an editor to **Asset Browser** using its editor-type menu at the upper left.
3. Choose the **Poly Haven** library.
4. Drag a downloaded model into the 3D viewport. Download missing assets through the add-on when needed.
5. Place and rotate it using the steps above. The scene uses metres.
6. To keep the file portable, use **File → External Data → Pack Resources**, then save.

For surfaces, select the object, then use a material asset from the browser. Applying a texture does not change the wall geometry. Make a material single-user before changing it if only one surface should change. The original shared floor and brick materials use metre-based UV coordinates to keep their texture scale consistent.

## Add one of your PNG cutouts

A cutout is useful for testing composition from one fixed viewpoint. It has no back or sides, and does not acquire the same lighting as a real chair. Keep that in mind before making it permanent.

Use Blender’s **Images as Planes** import capability if available in your installation (search **F3**, “Images as Planes”). If it is missing, you can still use an image Empty as a reference without installing anything. The supplied hidden REFERENCES collection already does this for your room-element PNGs. Image Empties do not appear in final renders.

For the finished room, replace the maquette with a licensed model, or deliberately use a cutout plane that faces the fixed panoramic camera. Check it in a render for edge halos, perspective and shadows. Keep realistic cats as a replaceable collection so they can later become the app’s live overlays.

## Render the panorama

1. Choose a scene.
2. In **Scene Properties**, set the camera to **PANO_CAM**. It is at seated/standing eye height of 1.6 m, looking toward the painting table.
3. Keep **Cycles**, **Panoramic → Equirectangular**. Ordinary wide-angle cameras do not produce a working panorama. [Blender’s camera documentation](https://docs.blender.org/manual/en/5.1/render/cycles/object_settings/cameras.html) describes the projection.
4. Set **Output Properties** to **4096 × 2048** for a working render, or **8192 × 4096** for the desktop final. Keep **100%** scale and the **2:1** ratio.
5. In **Render Properties**, start with **128 samples + denoising**. Increase to 256–512 if the final has noisy shadows or loses detail.
6. Use **Render → Render Image**. In the Render Result, use **Image → Save As**. Save a new filename rather than overwriting a version you want to keep.

To render a normal perspective view, temporarily choose **REVIEW_CAM** and use **1600 × 1000**, then restore PANO_CAM and 2:1 dimensions before rendering a panorama. The saved file starts with the panoramic camera active.

The batch previews were rendered with Metal on this Mac. On another computer, choose its available Cycles render device in Preferences and Render Properties; the generator is tailored to this Mac’s Metal device.

## Later: put the chosen room in the app

The SPOTS collection contains draft seat, canvas and cat positions. After the room layout is settled, run `scripts/export_spots.py` from the Scripting workspace, then perform that script’s bright-cube alignment check against the new panorama in Photo Sphere Viewer. The draft scene names are presentation names; rename the selected scene to a stable room slug such as `cream-city` before exporting. Do not reuse the original HDRI’s spot coordinates.

Still needed before production: realistic cats, final prop selection and details, final light/art direction, verified spot alignment, 4k/8k web compression, table-view renders, and phone loading/performance checks. Phase 3’s integration gate remains open.

## Rebuild the initial design

The scene is generated by `studio/scripts/build_cream_city.py`, using only Blender and downloaded Poly Haven assets. No new dependency or service was added.

```sh
/Applications/design/Blender.app/Contents/MacOS/Blender \
  --background --python studio/scripts/build_cream_city.py -- --render
```

Run from the repository root. The script refuses to overwrite an existing studio. To rebuild, first save your edits under a different filename; only then use `--force` deliberately. Rebuilding does not preserve manual changes to the generated file. Use Blender’s ordinary Save/Save As workflow for ongoing design edits.
