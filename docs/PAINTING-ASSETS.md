# Painting assets — measured review

29 October 2026. All five PNG artboards inspected; all five SVG exports parsed. Originals remain unchanged. Generated samples and reproducible script are in `_design/mockups/asset-review/` (ignored by Git, like the source `_design` folder). No assets have been promoted into the application.

## Actual WebP measurements

Measured all 28 supplied artist-tool PNGs, not a generic compression estimate. Pillow 12.3.0 WebP encoder, method 6; quality 90 for lossy variants; exact transparency preserved. Most originals are 1254×1254; the 36-color watercolor tray is 1536×1024. MB here means decimal megabytes.

| Variant | Total MB | Reduction from originals | Quality boundary |
| --- | ---: | ---: | --- |
| Original PNG | 42.56 | 0.0% | Source |
| Same-size lossless WebP | 27.72 | 34.9% | Exact visible pixels |
| Same-size quality-90 WebP | 7.37 | 82.7% | Lossy RGB; alpha exact |
| Quality-90, maximum 768px edge | 3.23 | 92.4% | Lossy RGB and intentional downsampling; alpha exact against resized input |

All 28 lossless conversions were decoded and compared over black and white: composited RGB is identical. All variants retained an identical alpha channel relative to their encoder input. This verifies pixel/alpha properties, not color-profile consistency across browsers.

The 768px variant is a candidate for objects shown at up to roughly 384 CSS pixels on a 2× display, not a universal size cap. A larger tray/popup needs an appropriate higher-resolution variant. Always choose resolution from the maximum display size and device pixel ratio. Resizing reduces detail; it must not be described as lossless compression.

Visually inspected a comparison sheet of detail brush, water glass, broad flat brush, and sponge at a small UI size. Quality-90 retains convincing edges and texture there. This is not approval of every asset at maximum zoom: inspect glass on light and dark surfaces, narrow bristles, small pencil tips and maximal widget sizes on real devices before production selection. Retain lossless for any failures.

**Recommendation:** preserve PNG masters, use quality-90 WebP for reviewed photo cutouts with responsive sizes, and retain a lossless option. WebP supports alpha in both lossless and lossy modes ([format documentation](https://developers.google.com/speed/webp/docs/riff_container)).

## Useful SVG findings and extracts

The three desktop SVGs are approximately 44 MB each; the two popup SVGs approximately 25 MB each. They contain base64 PNG photos, not only vector paths. The desktop default has 21 image elements and 20 filters; its 1024×1024 wood texture is repeated four times as embedded PNG. Shipping an entire exported artboard would duplicate images and effects and bake the interface into an inaccessible picture.

Extracted review files:

- `table-from-export.svg`: original tabletop placement and dark tint, referencing one deduplicated external WebP wood texture. The base wood texture is raster, not a vector background.
- `canvas-from-export.svg`: original `layer-anvas` vector geometry and exported filter definitions. Intended as a decorative treatment reference, not the actual drawing surface.
- `airbrush-silhouette-from-export.svg`: the original airbrush underlay path with export shadow removed for geometry inspection. It remains in artboard coordinates; normalize around the matching image before reusable widget use.
- `embedded-*.png` and corresponding `.webp`: original embedded wood pixels plus a quality-90 candidate.
- `visual-comparison.jpg`: original / quality-90 / resized-quality-90 sheet for four representative tools.
- `webp-measurements.json`: per-file bytes, dimensions and decoded checks.
- `review_assets.py`: repeatable conversion/extraction using Pillow; run with the bundled Python runtime (or any Python with Pillow WebP support).

Extraction XML is parseable and the image references resolve locally. The extracted filtered SVGs have not yet been browser-rendered against the source; do that before adopting their effects. Preserve original group transforms when separating shapes. Photo coordinates, rotations and underlay transforms must move together.

## Shadows and outlines

The browser can cast a shape-following shadow directly from a transparent cutout with CSS `filter: drop-shadow(...)`; unlike rectangular `box-shadow`, it follows alpha ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/filter-function/drop-shadow)). So the EXP image-shadow limitation does not require a second vector just for a web shadow.

Keep the cleaned silhouette as a deliberate, thick selection outline. Layer it behind the cutout, use a shared viewBox/transform, and keep shadow and selected stroke independently adjustable. Use a rounded SVG stroke or a reviewed mask expansion, not dozens of chained shadows. Avoid clipping filter regions or cropping the halo at widget bounds. Decorative image/SVG layers should not intercept pointer events; a named native button owns interaction and keyboard focus.

Some artwork is deliberately cut off at the desktop/popup edge; this differs from an incomplete silhouette. Reusable widget geometry must include the entire tool, even when a layout chooses to let it extend outside a view. Closed paths alone do not prove completeness: a closed path can still terminate at an artboard edge. Review the full source photograph against each underlay. Brush/knife groups contain several implements; separate hit regions or a named chooser are needed rather than one unlabeled image click.

## Promotion gate

Before any asset is committed into public web assets, record its source/license in `studio/ASSET-CREDITS.md` per AGENTS.md. The supplied files establish design intent, not underlying third-party rights. Keep this review local until provenance and corrected silhouettes are ready. No new image library or production dependency is needed for this comparison.

## Per-file byte receipts

| Source PNG | PNG | Lossless WebP | Q90 WebP | 768px Q90 |
| --- | ---: | ---: | ---: | ---: |
| acrylic-paint-organizer-12.png | 1,524,992 | 1,063,076 | 313,120 | 137,762 |
| acrylic-paint-organizer-24.png | 2,222,343 | 1,668,472 | 469,840 | 204,212 |
| airbrush.png | 859,222 | 504,310 | 158,734 | 72,506 |
| art-pencils-selection.png | 1,842,163 | 1,249,948 | 379,818 | 169,758 |
| brush-detail-round.png | 335,029 | 177,232 | 64,766 | 29,784 |
| brush-fan.png | 871,955 | 523,828 | 188,476 | 81,242 |
| brush-flat-shader-clean.png | 938,142 | 521,116 | 177,668 | 74,582 |
| brush-large-flat.png | 1,247,442 | 754,720 | 248,620 | 107,640 |
| brush-round-clean.png | 781,994 | 456,926 | 156,998 | 68,828 |
| brushes-round-selection.png | 1,136,336 | 728,062 | 283,280 | 129,814 |
| charcoal-set-tray.png | 2,276,271 | 1,405,678 | 323,068 | 139,488 |
| empty-paint-tray-12-well.png | 989,936 | 575,110 | 83,516 | 41,000 |
| empty-paint-tray-6-well.png | 1,315,740 | 763,402 | 105,714 | 49,204 |
| empty-paint-tray-oval.png | 1,375,589 | 763,616 | 98,864 | 47,408 |
| eraser-large.png | 1,321,010 | 785,644 | 143,186 | 63,424 |
| paint-knives-round-diamond.png | 1,465,128 | 975,630 | 351,490 | 154,348 |
| paint-mixing-tray.png | 1,596,383 | 1,012,990 | 155,808 | 68,378 |
| soft-pastels-tray.png | 2,387,954 | 1,622,490 | 417,338 | 174,738 |
| sponge-textured.png | 2,695,109 | 1,767,414 | 551,504 | 236,864 |
| sponges-fine-stick.png | 1,328,443 | 841,884 | 286,606 | 126,592 |
| water-cup-brushes.png | 1,439,766 | 1,001,366 | 293,590 | 139,826 |
| water-cup-clean.png | 1,370,433 | 874,488 | 236,012 | 108,182 |
| water-cup-dirty.png | 1,534,436 | 1,012,818 | 214,442 | 96,016 |
| watercolor-palette-12.png | 2,531,021 | 1,690,306 | 463,344 | 209,346 |
| watercolor-palette-24.png | 2,842,408 | 1,914,848 | 537,890 | 234,778 |
| watercolor-palette-36.png | 2,106,815 | 1,537,660 | 289,886 | 81,920 |
| wooden-paint-holder-empty-12.png | 1,246,011 | 834,432 | 186,162 | 98,584 |
| wooden-paint-holder-empty-24.png | 974,719 | 696,760 | 188,488 | 85,270 |
