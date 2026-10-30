# Local painting-study photo palettes

The local study uses separate swatches from the owner's actual `_design/artist-tools` photographs. Production `PAINTS` and the shared party protocol are unchanged. Descriptive names describe the visible color; they do not assert a pigment, manufacturer, or chemical composition.

| Medium | Original PNG | Samples |
| --- | --- | ---: |
| Acrylic | `acrylic-paint-organizer-24.png` | 19 visible bottles: 9 upper, 10 lower |
| Watercolor | `watercolor-palette-36.png` | 36 wells: 3 rows of 12 |
| Pastel | `soft-pastels-tray.png` | 40 sticks: 14 upper, 13 middle, 13 lower |
| Pencil | `art-pencils-selection.png` | 9 visible drawing tips |
| Charcoal | `charcoal-set-tray.png` | 8 representative material tones, including chalk white, red and brown |

The acrylic filename says 24, but five additional colors cannot be identified from the image. The study offers the 19 visibly represented colors rather than inventing missing ones. Charcoal offers representative tones, rather than pretending that each duplicate stick is a separate color.

## Reproduce

Run `python3 studio/scripts/sample_study_palettes.py` with Pillow available. The bundled Python runtime has Pillow; no project dependency was added. This regenerates `apps/web/src/lib/canvas/study-palettes.ts` deterministically from the unchanged PNG masters.

The script records every named sample coordinate. Square-photo coordinates use a 1280 × 1280 reference scaled to the 1254 × 1254 PNGs; watercolor uses its native 1536 × 1024 coordinates. Each sample takes the median red, green and blue of an 11 × 11 patch, rejecting any patch containing transparency below 240/255. Patches target bottle paint, wells, pastel bodies and pencil leads while avoiding obvious tray borders, caps and large splatters.

These remain photo appearance samples affected by lighting, shadows, surface texture and existing photo color treatment. They are not calibrated measurements of actual paint, and a dark dry watercolor well does not predict the appearance of a diluted wash. The study's opacity/medium rendering determines how that sampled color appears on the canvas. Source photographs and assets remain unchanged.

## Extended sets — owner request, 2026-10-29

The source samples above remain unchanged as `PHOTO_PALETTES`. The current
chooser also adds 27 pencil colors and ten charcoal shades, authored in
`apps/web/src/lib/canvas/study-palette-extras.ts`: totals 36 and 18 respectively.
Both include deep black; charcoal gains a broader neutral ramp and earth tones.
These are additional digital studio colors, not new claims about visible
photographic samples or calibrated pigments. The sampler imports and retains
these extras when rebuilding `STUDY_PALETTES`.
