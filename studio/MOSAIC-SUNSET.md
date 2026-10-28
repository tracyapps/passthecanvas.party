# Mosaic lamp and sunset

The latest `blender/cream-city-studio-wphotos.blend` has a three-globe Turkish-style
mosaic pendant above the beanbag, with original glass tile patterns, aged bronze
hardware, chains and warm lights. Existing furniture and camera transforms are
preserved. The native file without photos is unchanged.

## Easy controls

- **Move the entire lamp:** select `TURKISH LAMP — MOVE THIS` in the Outliner.
  All globes, hardware and lights follow it.
- **Brightness:** expand `MOSAIC PENDANT — beanbag corner`, select one of the
  `Mosaic … — warm corner light` objects, then open the green light bulb tab and
  change **Power**. There are three 14 W lights per globe; increase together for
  an even change. The coloured glass also has a small emission glow.
- **Sunset:** choose the red/afternoon scene. The `SUNSET — outside windows
  (red look)` collection contains a procedural sky and low amber sun. Its camera
  icon turns the backdrop on/off. The original neighbouring building is intact
  behind it. The window lights now use peach-coloured light in this look.
- **Sky colours:** select `SUNSET — editable sky backdrop`, open the Shading
  workspace and find the `SUNSET COLOURS — bottom to top` Color Ramp. Each stop
  changes one height band from amber near the horizon through rose into violet.
- **Sun position:** move `SUNSET — low sun disc`; keep it outside the windows.

The sunset is an editable procedural backdrop, not a photographic HDRI. It does
not reproduce the intricate coloured light projections shown in the lamp reference;
the mosaic is visibly coloured while the corner receives soft warm illumination.
The supplied product photo is not used as a texture.

## Rendering

Choose **Render > Render Image**. In the render window use **Image > Save As**.
The saved panoramic preset is 4096 × 2048, Cycles, 128 samples with denoising.
The 4K panorama and two close-ups are in `renders/cream-city/mosaic-sunset/`.
The local `renders/cream-city/review.html` defaults to this newest panorama.

A timestamped copy of the incoming owner file is stored in
`blender/before-cleanup-save/` before replacing the working file. The earlier
pre-cleanup backups are untouched. Do not rerun the original room generator over
this layout. `scripts/add_mosaic_sunset.py` writes a candidate and refuses a file
that already contains this pendant.
