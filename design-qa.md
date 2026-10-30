# Painting selection study QA — 2026-10-29

Scope: the owner's approved first local interaction slice, not production party
integration or a finished media simulation. No remaining P0/P1/P2 finding in
this scoped study after the fixes below. The owner's review of the provisional
controls and the physical-device/accessibility checks remain separate gates.

## Source and implementation evidence

- Source truth: `_design/mockups/01-default-blank-canvas@2x.png`,
  `02-Tool-settings-active@2x.png`, `03-Choose-color-and-medium@2x.png`.
- Source size: 2880×2048, normalized to 1440×1024 CSS pixels (2× → 1×).
- Implementation: `http://127.0.0.1:5192/?demo=painting`, in-app Chromium browser.
- Final desktop screenshots: `output/playwright/painting-default.png`,
  `painting-tool.png`, `painting-loaded.png`; each verified 1440×1024 at DPR 1.
- Full-view paired comparisons: `comparison-default.jpg`, `comparison-tool.jpg`,
  `comparison-loaded.jpg` in the same folder. Each places normalized source
  on the left and implementation on the right, 2880×1024 total.
- Focused comparison: `detail-loaded.jpg` and `detail-tool.jpg` compare the
  selected brush, contour, settings, typography and lower canvas edge. Crops
  use the same (1050,620)–(1440,1020) artboard region, enlarged equally for review.
- Phone evidence: `painting-mobile-loaded.png` at 360×800 and `painting-320.png`
  at 320×800. They show the selected tool settings after selection scroll/focus.
  No supplied mobile artboard exists; these validate the agreed reflow behavior.
- Additional interaction evidence: `painting-tray-even.png`,
  `painting-tray-multicolor.png`, `painting-keyboard-marks.png`,
  `painting-mouse-multicolor.png`. Earlier mouse evidence predates the final
  canvas-aspect correction; final three-state captures above show corrected layout.

All listed paths are relative to the repository. Browser-generated evidence
stays in the existing local `output/playwright/` folder.

## Comparison history and fixes

1. **P2 — Moiré across canvas:** a CSS weave produced visible bands instead of
   the source's subtle surface. Replaced it with the owner's exported vector
   surface/noise definitions. Final three-state comparisons show the correction.
2. **P2 — Settings clipped below desktop:** the original expanded panel could
   leave the viewport. Kept the main size/preview compact, moved exact size and
   rinse into native More settings, bounded the panel height, and positioned it
   inside the viewport. Final focused comparison includes the whole default panel.
3. **P1 — Transparent tool rectangles stole adjacent clicks:** selecting Eraser
   could select Sponge, and selecting Round could select Detail. Separate the
   decorative photo from a reviewed, non-overlapping native button target; keep
   the full photo visible and decorative layers pointer-transparent. Settings
   move away from other tool targets. Repeated browser selection asserted the
   visible selected-tool label for Eraser, Sponge, Round, Detail, Fan, Flat,
   Foam and Knife: all eight matched after the fix.
4. **P2 — Portrait desktop distorted canvas:** percentage height stretched the
   surface and letterboxed its texture. Preserve canvas aspect ratio and reflow
   supplies at widths up to 1000px. Phone captures show a proportional canvas,
   visible text labels and settings in normal flow; DOM widths show no overflow.
5. **P2 — Canvas depth counted inside front-face dimensions:** first comparison
   shortened the face by the bevel thickness. Aligned the overall box to the
   source's 983×537 bounds, with a 974×519 front face. Regenerated and inspected
   the paired full-view and focused comparisons after that correction.

A final input-only adjustment makes the exact-size field update the slider immediately while typing a valid size. Browser verification confirmed both read 40; the three default visual comparison states are unchanged.

## Required fidelity surfaces

| Surface | Reviewed result |
| --- | --- |
| Fonts/typography | Uses existing Atkinson/Bricolage project typography. Uppercase tool status retains the source hierarchy; labels and native inputs remain readable. The rough source's exact typeface is not newly installed or assumed. |
| Spacing/layout | Desktop tool transforms are preserved from source SVG groups. Canvas dimensions align to the measured bounds. Source-like selected flat-brush panel remains nearby; additional tool panels avoid adjacent click targets. Mobile intentionally reflows. |
| Colors/tokens | Walnut source texture, cream type, yellow selection and muted tools follow the reference. Active paint shows the actual selected named swatch, so Sap green differs from the source's provisional olive. Focus gets a distinct white/cream indicator. |
| Image quality | Real source cutouts embedded as WebP; no substituted illustrations. Browser checks found zero unloaded/broken supply images. Active contour is derived from alpha and follows the photo, rather than the incomplete rough underlays. Source surface effects are reused. |
| Copy/content | Adds brief choose/load/ready guidance, explicit unloaded and no-paint-needed states, accessible color names and local-practice status. Unloaded preview says Tool shape rather than implying yellow pigment. Menu and More settings are intentional additions for a working slice. |

Accepted first-slice differences: the table texture is reused with CSS tiling
rather than replicating every exported tile offset; the bevel/contact shadow is
a lightweight CSS treatment around the exported surface; palette colors open
as named accessible choices rather than individual bottle hit maps; the source's
rough contour is replaced with complete alpha expansion; native slider/number
controls and Close/More settings add usable keyboard/touch affordances. These
are scoped implementation choices documented in the workspace brief, not a
claim of pixel-identical reproduction or final button-style approval.

## Runtime and interaction checks

- Default → flat brush unloaded → named acrylic color loaded, with both brush
  and paint source selected. Unloaded Space input gives choose/load guidance.
- Pure selection tests verify no-tool/unloaded readiness, compatible remembered
  paint, knife/watercolor refusal, standalone eraser/dry sponge, water-only brush,
  and preserving a multicolor load.
- Browser compatibility check: selecting knife after watercolor produces an
  unloaded knife and unavailable watercolor/water controls. Returning to a brush
  restores compatible remembered paint. Standalone selection requires no color.
- Three dabs in one mixing tray; switching Even/Separate retains the same three
  named ingredients; loading multicolor changes the current load and preview.
- Mouse drag paints visible blue/red/white parallel bands on the local surface.
  Keyboard Space and Shift+arrows paint visible marks; Tab leaves the canvas.
- Native dialog opens with named heading, Close/Escape path and focus restoration.
  Clear-practice confirmation initially focuses Keep painting; clear affects
  only the practice surface, retaining the selection.
- Mobile tool selection focuses the settings region; controls reflow above
  the supplies. At 360px the document width is 345px excluding scrollbar;
  at 320px it is 305px. No horizontal overflow in either check.
- Exact-size entry: typing 40 immediately updates the numeric field, size readout and slider to 40.
- Final browser console inspection: no warnings or errors.
- Reduced motion: existing global override applies to photo filter transitions;
  no layout animation, auto-pan or timer is introduced. OS preference switching
  itself was not exercised.

## Code verification and boundaries

- `npm test`: 31 tests pass in six files, including four new selection tests.
- `npm run build`: passes. Inspecting `dist/assets` confirms no PaintingStudy,
  study image assets, or study strings in the production bundle.
- `npm run check`: still fails on the four pre-existing missing `ArtRegion.role`
  properties in `ArtEditor.svelte`; no new errors or warnings in this slice.
- `git diff --check`: passes.
- Physical touch/stylus pressure, actual iOS/Safari, VoiceOver and real two-person
  party behavior are unverified. Browser reflow does not substitute for them.
- No cloud persistence, actual pigment simulation, shared undo, timer change,
  paired-device synchronization, publication, commit or deployment is included.

## Follow-up polish

- P3: replace alpha-expanded contours with the owner's corrected vector
  silhouettes where a smoother or more deliberate halo is desired.
- P3: tune panel spacing and final primary/secondary button styles with owner
  feedback; test selected state against individual palette wells/bottles.
- Next mixer slice: free dab placement, per-color amounts, named saved trays,
  and material/load rendering decisions. The first slice retains its nine-dab
  limit and explicit approximate RGB/parallel-band preview.

## Implementation checklist

- [x] Inspect source and browser capture together at matched desktop dimensions.
- [x] Fix interaction interception, clipped controls, texture and aspect issues.
- [x] Capture post-fix full views and relevant control details.
- [x] Exercise the primary selection/mixing flow, mouse and keyboard painting.
- [x] Check narrow reflow and browser console.
- [x] Record fresh test/build evidence and existing type-check blocker.

final result: passed

## Round two — owner feedback implemented, 2026-10-29

The first-round dialog/layout evidence above is historical. The current study
uses movable **non-modal** color/brush panels, owned contribution surfaces and
Paint / Arrange & view. Source brief: the owner's nine testing adjustments and
`Screenshot 2026-10-29 at 5.57.50 AM.png` (supplied screenshot).

### Fresh browser evidence

All paths below are under `output/playwright/round-2/`.

- `painting-palette.png`: 1800×1000 full workspace with the 19-color acrylic
  chooser, custom color, visible Rinse and settings below the canvas.
- `tablet.png`, `phone.png`: 1024×768 and 360×800 responsive captures. Tablet
  settings have two equal columns. At 360px, document width is 345px excluding
  scrollbar; color targets are at least 44px high and >54px wide. Both panels fit
  the document width. Phone tool selection focuses Size; paint-set selection
  focuses the chooser header and scrolls it into view without trapping focus.
- `short-desktop.png`: 1200×800, no offscreen supply boxes or horizontal overflow;
  canvas bottom ≈530px and manually nudged settings top ≈576px. 1440×700 uses
  the flowing layout; 1800×1000 has no clipped supply boxes. The 320px first-round
  capture remains historical; this round was rechecked at 360px.
- `navigator.png`: Arrange & view, 156% zoom, automatic navigator. Alt+Right
  changes the viewport offset; Fit restores 100%. Space/Shift+arrows cannot
  paint in Arrange. Physical pinch and trackpad gestures remain unverified.
- Acrylics moved into the artwork using Arrange controls: at point (688,232)
  within both the supply box and canvas, `elementFromPoint` returned CANVAS.
  A separate frame-edge point returned the canvas frame rather than a supply.
- Settings handle ArrowUp updated its fixed top by −16px. Supply tap controls
  updated position; Reset layout restored defaults. Actual pointer drag has an
  implementation path but was not separately exercised in this round.
- Escape from Exact size yielded None / Unloaded. A native click on bare wood
  at (1000,120) also yielded None / Unloaded, closing both panels.
- Photo selection opens a non-modal panel; selecting a color leaves it open.
  Paint-set changes show 36 watercolor colors and 40 pastels. Keyboard selection,
  loading and drawing work without a mouse. No console errors or warnings.

### Layer/modifier evidence

- `protected-before.png`, `protected-after-water.png`,
  `protected-after-sponge.png`, `protected-after-eraser.png`: paint a visible
  pink stroke as painter 1, switch to painter 2, work across the same coordinates
  with each modifier. Interior crop (660,285)–(1300,570) was pixel identical for
  each modifier. `protected-interior.png` confirms the comparison includes ink.
- After the alpha-safe renderer refinement, `final-protected-before.png` and
  `final-protected-after.png` repeat all three modifiers plus locked keyboard
  drawing. Screenshot comparison includes small rasterization differences
  (≤4/255 per channel); it is not an exact pixel-identity receipt. The ownership
  filter unit test independently checks earlier own contributions and excludes
  every foreign contribution.
- `final-own-water.png`: returning to painter 1 and rinsing/working across the
  same stroke visibly lightens its own pigment (changes up to 21/255 in the green
  channel). This verifies modifiers are active, rather than disabled globally.
- Wet-copy composition uses source-atop plus gentle alpha lifting; copying must
  not accidentally increase opacity. Watercolor/airbrush strength, tip softness,
  grain and deterministic spacing have focused renderer tests. Physical-media
  realism remains an owner tuning exercise.

### Fresh verification and release limits

- `npm test`: **46 tests pass in 10 files**.
- `npm run build`: passes; production assets exclude the dev study and its media.
  Existing bundle-size warning remains.
- `npm run check`: four existing missing `ArtRegion.role` errors in ArtEditor;
  no new errors or warnings from the study.
- `git diff --check`: passes for tracked changes; new study sources also checked
  for whitespace errors.
- This remains local practice. Real two-person server behavior, accepted strokes,
  replay/snapshots/undo and party ownership are not integrated by this slice.
  Physical iOS/Safari, stylus pressure, multi-touch, VoiceOver and reduced-motion
  preference switching still need real-device/accessibility evidence.
- No persistence, new dependency, publication, commit or deployment.

Round-two result: ready for the owner's next local interaction test; the above
production and physical-device gates remain open.

## Round three — burnisher and tall-window layout

2026-10-29. Scope remains the local painting study. The owner's previous-round
approval is retained; only the new standalone effect and adaptive layout change.

- Reproduced at the actual 1309×1474 preview size: landscape positioning left
  unused space under the canvas and partially hid right-side supplies. After
  the fix, canvas and controls flow above a packed seven-column supply grid;
  all 17 supplies fit in three rows, with no canvas overlap. Evidence:
  `output/playwright/round-3/tall-layout.png` (first capture) and
  `tall-layout-final.png` (final source).
- Also checked 360×800 and 900×1200: no horizontal overflow. Phone supply targets
  exceed 44×44px; selecting the burnisher brings its Size input into view. At
  900px, color/brush panels sit side by side. At 1309px portrait, settings use
  relative flow below the canvas (rather than the old floating desktop dock).
- At 1800×1000, wide photo-object layout is preserved and no supply box extends
  beyond the viewport. `wide-burnisher.png` records its new pad and settings.
- Arrange/tap Left moves the burnisher ahead of the sponge in portrait order;
  Reset layout restores the original order. Escape deselects as before.
- `before-burnish.png` / `after-burnish.png`: keyboard-applied light watercolor,
  then work back over it with Burnishing pad. Interior (570,390)–(930,510) changes
  from RGB means (202.30,202.74,204.02) to (198.28,198.50,200.93), visibly richer
  pigment. `burnish-comparison.png` shows the paired crop.
- `foreign-burnish.png`: switch to painter 2 and repeat over the same pigment.
  Comparison to the owned after-image is pixel identical in that interior crop.
  Unit checks additionally require self-layer source-over copies, displacement,
  no added color fill/lifting, and standalone tool/remembered-color behavior.
- Final `npm test`: 61 tests in 13 files pass. `npm run check`: 0 errors and
  0 warnings (the prior ArtEditor blockers have been resolved elsewhere in the
  current checkout). `npm run build` passes with the existing bundle-size notice.
- No server/protocol or production painting changes. Physical touch/stylus,
  screen-reader and real-party integration gates from round two remain open.

## Round four — intensity and additional colors

2026-10-29. Local study only; existing party renderer/protocol unchanged.

- Airbrush and burnisher expose named native Intensity sliders with percent
  readouts and keyboard Home/End/arrow operation. Default is 50%. Set airbrush
  to 20%, switch to burnisher (still 50%), set it to 80%, then return: values
  remain independent at 20% and 80%.
- Keyboard-painted adjacent airbrush segments at 20% and 100% show visibly
  different deposition. `output/playwright/round-4/airbrush-intensity.png` records
  the control and result; `burnisher-intensity.png` records its independent 80%.
- Renderer checks cover zero/no-op, increased opacity at higher intensity,
  unchanged footprint, original default, bounds and unaffected round brush.
  Intensity is captured in the stroke object, not read live during marks.
- Select Violet from the expanded 36-color pencil chooser and Deep black from
  the 18-shade charcoal chooser; each loads the correct material. Keyboard
  painting was also exercised with Deep black charcoal.
  `pencil-colors.png` and `charcoal-phone.png` record the expanded sets.
- At 360×800, document width is 345px excluding scrollbar, no horizontal
  overflow; all 18 charcoal swatches have 44px height. The intensity input has
  44px height and preserves its 80% value in the phone layout. At 1440×1000,
  canvas bottom is ~640px and airbrush settings begin at 740px, with no overlap.
- Browser console: no warnings/errors. `npm test`: 63 tests pass in 13 files.
  `npm run check`: 0 errors/warnings. Production build passes with its existing
  bundle-size notice. `git diff --check` passes.
- Photo samples are retained separately from extras; valid colors, unique
  accessible names, totals and deep blacks are covered by palette tests.
  Physical device/screen-reader and real-party gates remain as documented above.

## Round five — protected working ends / handle overflow

2026-10-29. The owner's supplied 2.03.44 PM screenshot establishes the desired
bottom pad position and the working-end priority. Local study scope only.

- At 2048×1171 and 1800×1000, all 17 desktop targets are within the display and
  clear of the canvas/frame. Long tools deliberately overhang the right/bottom.
  The angled pad overlaps the sponge at its bottom-right. Final image:
  `output/playwright/round-5/working-ends-wide.png`.
- At 1200×800, all targets remained on-screen and outside the canvas; no horizontal
  overflow. Final wide geometry was rechecked after enlarging the flat-brush
  protected area to include both photographed brush heads.
- In Arrange mode at 1800×1000, repeated Down on Pencils leaves the protected
  target bottom at 976px while the full image extends to ~1122px. This is intended
  handle overflow, not a lost target. Reset restores the default overhang.
- Actual pointer drag: watercolor palette from (1400,965) toward (1780,990).
  Resulting full palette box stops at right=1792, bottom=976, retaining the 8px
  side and 24px bottom margins. The same bounds apply to keyboard/tap nudges.
- Unit geometry checks cover fully contained palettes, handle exceptions,
  canvas avoidance and recovery after moving beyond the top/left edges.
- At 360×800, document width 345px excluding scrollbar and all supply targets
  at least 44×44px. Full-image cards retained; `round-5/phone.png` records reflow.
- No browser warnings/errors. `npm test`: 67 tests pass in 14 files.
  `npm run check`: no errors/warnings. Production build passes, retaining its
  existing bundle-size notice. No changes to paint/media behavior.
- Physical touch and screen-reader checks, persisted/paired-display layouts,
  party protocol/replay/ownership integration remain outside this local slice.

## Round six — Arrange top bar

2026-10-29. Owner requested moving the bottom-left Arrange overlay into the header.

- At 1440×1000, Arrange controls are descendants of the top bar, entirely within
  its 88px height. No separate overlay or painting readouts remain. Movement and
  Reset layout work from the header. Brush settings hide while arranging.
- Switching back to Paint restores Round brush / Acrylic with the prior Turquoise
  load intact. The existing brush settings return. No tool selection is cleared.
- At 360×800, document width is 345px excluding scrollbar, no horizontal overflow.
  The header wraps to 190px and canvas begins at 214px. Directional/reset buttons
  remain 44px high; minimum button width is explicitly 44px. Picker, Left and
  Reset layout still work in the compact reordering layout.
- Evidence: `output/playwright/round-6/arrange-topbar.png` and `arrange-phone.png`.
- `npm test`: 67 tests pass in 14 files; `npm run check`: no errors/warnings;
  production build passes with its existing bundle-size notice. No renderer,
  protocol, placement or persistence changes.

## Round seven — saved views, window geometry, account boundary (2026-10-29)

- Browser verified a named Right-side study view restores after reload. Fixed
  Svelte proxy cloning in preset restore and frozen recording settings during
  this check; old console entries remain from before those fixes, no new errors
  appeared in subsequent navigation, rotation or resize checks.
- At 360px, the color tray moved from row 1/column 2 to row 2/column 2 with
  Down; Up returned it. Three-column grid, no horizontal document overflow.
  Header bottom 238px, toolbar top 254px: controls outside header/canvas.
- Tested portrait creation (850×1600), common zoom, quarter-turn rotation,
  Fit disabled when fitted, both-side columns, independent numeric window resize
  with Apply and keyboard resize. A 550×680 window and rotated/fitted paper
  demonstrate visible table margins. Toolbar height is measured and its
  navigator space reserved to avoid reflow changing Fit immediately after use.
- Art recording snapshots settings and actual emitted marks; keyboard painting
  worked after fixing proxy snapshot capture. Export action announces completion.
  Download bytes and pixel-for-pixel playback were not verified; no replay player
  or durable journal is included. Physical pen/touch and Safari remain untested.
- Account boundary has seven HTTP tests: verified subject ownership, invalid
  sessions/origins, malformed/oversize values and storage failure. Live local
  unconfigured endpoint returns 503, account UI explains configuration. No Clerk
  credentials, Discord flow or Railway Postgres session were available to verify.
- Fresh validation: 80 tests across 18 files pass; Svelte/TypeScript checks pass.
  Production build passes with existing large-chunk advisory; painting study and
  its Clerk browser SDK remain development-only. Vitest emits a config-loader
  migration advisory. No deployment/commit/provider provisioning performed.
- Screenshots: `output/playwright/round-7/portrait-both-sides.png` (rotated portrait
  inside independent window with side columns) and `mobile-arrange.png`.
