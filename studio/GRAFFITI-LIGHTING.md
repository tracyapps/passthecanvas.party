# Graffiti and lighting refinement

Applied to the owner's latest saved `blender/cream-city-studio-wphotos.blend`.
The incoming version is backed up in `blender/before-cleanup-save/` before
replacing the working file. Existing furniture, fixtures, lamp placement,
architecture and camera transforms remain unchanged.

## Graffiti

The red scene retains the owner's MAKE / SOME / THING wording, line breaks,
tilt and occupied wall rectangle. Bangers lettering adds heavier strokes, with
charcoal and warm cream outline layers, orange/pink/violet/turquoise paint,
sparse wear, spray flecks and paint runs. It is still native editable text.

- Select `Original brick graffiti.001` to change its text. Change the two outline
  text children to match whenever editing the phrase.
- Shader Editor > `GRAFFITI — sunset to electric mint paint` >
  `GRAFFITI COLOURS — bottom to top` changes the gradient.
- Outline and accent objects follow the lettering parent.
- The Bangers font is SIL OFL 1.1; its full license is included in `assets/fonts/`.

## Wall sconces

The original single scanned material was opaque on both its metal and its two
apparent glass cylinders (Transmission Weight = 0). The two glass mesh islands
now have a separate lightly frosted transmitting material. The metal cages and
other geometry retain their original Poly Haven material.

Each sconce has two small emissive bulbs and two 18 W point lights positioned
inside those glass cylinders. Bulbs and lights are parented to the correct
fixture, including the duplicated third sconce, so they follow moves/rotations.
`SCONCE LIGHT — …` > Light Properties > Power controls brightness.

The glass uses a transparent path for shadow rays to allow practical interior
lighting without expensive refractive caustics; camera rays still see glass.
This is a rendering approximation, not an optical glass simulation.

## Turkish lamp

The existing lamp's nine lights now mix amber, blue and rose at low power.
Three additional broad 5 W wall washes add subtle local colour. They follow
`TURKISH LAMP — MOVE THIS`. `MOSAIC COLOUR — soft wall wash …` > Power controls
the colour strength. These are soft tints, not detailed mosaic projections.

## Review and render

The local `renders/cream-city/review.html` defaults to this round, with a
**Beanbag corner** button. Previous renders remain selectable for comparison.
The latest 4K panorama and sconce/graffiti/lamp close-ups are in
`renders/cream-city/graffiti-lighting/`.

Reopen the saved file in Blender to load the changes. Render > Render Image;
in the render window, Image > Save As. The saved preset remains 4096 × 2048,
Cycles, 128 samples, denoising. The native file without photos is untouched.

## Purple neon finishing pass

`Editable neon lettering.001` on the accent wall now uses a purple/violet
emission at strength **1.7** instead of the previous **5**. The text bevel is
reduced from 0.003 to 0.0012 so narrow script gaps stay open. Wording, font,
placement and scale are unchanged. The nearby wall wash is purple at 6 W.

The three red-scene track lights were shifted 10–25 cm, aimed toward the brick
beside the accent wall and the right corner, and reduced from 45 to 32 W with
narrower spread. This moves the white wash away from the sign. The other scene
looks retain their existing sign and lighting. `renders/cream-city/purple-neon/`
has before/after close-ups and the new 4K panorama; the review page opens this
version and includes a **Neon sign** button. A fresh incoming-file backup is in
`blender/before-cleanup-save/`.
