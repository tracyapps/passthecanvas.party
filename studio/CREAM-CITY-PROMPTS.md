# Cream City photographic studies — prompts and provenance

Generated October 27, 2026 with the **built-in imagegen tool**, not the API/CLI.
All three outputs are 1774 × 887 PNGs. They are visual targets, not exact Blender
renders or production-resolution assets. No generated image replaced the app panorama.

## Lime

Output: `renders/cream-city/lime-photographic-study.png`.

Inputs: `renders/cream-city/lime-daylight-panorama-draft.png` (the first Blender
lighting draft) and `cache/references.jpg` (contact sheet of the owner's
`_design/spaces/` ordinary image references and `_design/room-elements/` PNGs).
The source folders remain unchanged. The final Blender previews have revised
daylight; the initial imagegen input preceded that correction.

Prompt:

> Use case: photorealistic-natural. Create one high-resolution 2:1 full spherical 360-degree EQUIRECTANGULAR panorama design study for a browser painting-party room. Image 1 is an editable Blender architectural draft to refine; preserve its general room proportions, 11x8m cosy Milwaukee loft, window wall on left, central empty shared painting table, lime-green partial wall/easel zone right of center, doorway into small adjoining concrete-floored coffee nook, peripheral sofa lounge and cat tree. Image 2 is the owner's reference contact sheet: use its warm exposed timber, cream city brick, wall-of-windows studio, orange sheet-covered couch, worn tables, mismatched real furniture, Persian rug and braided rug as the style language. Transform the clean CG draft into a convincing real interior photograph: naturally irregular warm buff yellow cream-city brick with aged sandy mortar (not painted white brick), scuffed honey hardwood boards, worn Persian rug at lounge plus complementary smaller braided rug, charcoal and silver exposed pipes, warm hanging industrial lights. Replace toy-looking sofa with actual softly rumpled orange-sheet-covered sofa, real upholstered armchair. Two realistic sleeping cats on a sisal cat tree by windows. Furnish with a few practical shelves, canvas drying rack, paint jars and stacked blank canvases; considered messy working studio, welcoming and human, not cluttered. Keep ample open floor and unclaimed wall space; only a few modest artworks. Big blank canvas on main table, blank easels invite the guests' own work. Acid lime green accent, soft natural afternoon daylight with warm interior lamp pools, textured and rich without washed-out whites. A small believable neon wall sign says exactly 'CREATE COOL SH*T'. No people, no UI, no watermarks. Important projection: FULL spherical 360x180 equirectangular mapping, straight level horizon halfway up, zenith at top and nadir at bottom, floor fills lower hemisphere with proper polar stretch, ceiling fills upper hemisphere; left/right edges continuous. Do not output a flat wide-angle perspective photograph or multi-panel collage. This is a photographic visual target, not an exact render of the .blend.

## Red

Output: `renders/cream-city/red-photographic-study.png`.

Input: `renders/cream-city/lime-photographic-study.png`.

Prompt:

> Use case: lighting-weather and precise-object-edit. Make a second photographic design study of this SAME cosy Milwaukee Cream City brick painting studio, as one high-resolution 2:1 full-sphere equirectangular panorama. Preserve the architecture, layout, furniture, blank central painting canvas, window wall, cat tree with two realistic cats, art shelves, Persian rug, small braided rug, adjoining coffee nook and exposed beams/pipes. Change the lime-painted wall and adjoining nook accent walls to a strong deep vermilion red, attractive against warm pale buff Cream City brick. Change the neon sign text to exactly 'ART IS RESISTANCE'. Light it with late afternoon gold entering the windows and warm practical pendant lights, rich natural colour and material detail without flooding every surface orange. Give the right-hand concrete aisle/nook a clearly visible matte warm grey concrete finish distinct from the honey timber main floor. Messy working art studio with breathing room, no people, no interface, no watermarks. Keep true 360x180 spherical equirectangular framing, 2:1 aspect, horizon centered, full ceiling and floor/polar stretch, continuous left/right edge. Preserve all major features and their positions; only colour/lighting/wording and concrete finish change. Photographic visual study, not an exact Blender render.

## Charcoal

Output: `renders/cream-city/charcoal-photographic-study.png`.

Input: `renders/cream-city/lime-photographic-study.png`.

Prompt:

> Use case: lighting-weather and precise-object-edit. Third photographic visual study of this SAME Milwaukee Cream City brick art studio, one 2:1 high-resolution full spherical 360x180 EQUIRECTANGULAR panorama. Preserve the room architecture, positions, moderately sized cosy loft proportions, cream city buff brick, warm timber floor, orange sheet-covered sofa, green vintage armchair, wall of windows, Persian and braided rugs, central shared painting table with blank canvas, cat tree and TWO realistic sleeping cats, easels, shelves, pipes, beams and small coffee nook. Replace the lime-painted accent panels and nook wall with warm dark charcoal grey. Change time to blue-hour evening: cool soft blue light visible through the windows, warm pools of tungsten pendant light around table and lounge, warm practical lamp in nook, subtle golden neon 'CREATE COOL SH*T' on charcoal wall. Keep enough ambient light to see detailed brick and furniture, cosy artists' loft gathering, inviting NOT gloomy or nightclub, not cold industrial warehouse. Concrete aisle and nook floor matte warm grey, rest honey hardwood. Authentic photographic materials with scuffs, worn fabrics and restrained creative clutter, plenty of floor space and blank art surfaces for guests. Full spherical equirectangular mapping, horizon centered, full zenith and nadir polar stretch, continuous left-right edges. No people, no UI, no labels, no watermarks. Keep major furniture and all geometry placement intact. This is a photographic style study, not an exact Blender render.

## Review boundary

The prompt constraints are intended art direction, not a guarantee of exact
geometry or seam continuity. The studies were opened in the local spherical
viewer. The lime back join is usable for visual exploration, with generated
detail irregularities; resolution is visibly soft when zoomed. Final room
integration needs a chosen direction, detailed native assets or a separately
approved image finishing pass, full seam/pole review, final-resolution output,
and new marker alignment.
