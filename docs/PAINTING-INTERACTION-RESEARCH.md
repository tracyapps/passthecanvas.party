# Painting interactions: precedents and a practical path

Research checked **29 October 2026** against the first-party sources linked below. This is a design and engineering research note, not an implementation or a claim that these capabilities already work in Pass the Canvas. Recommendations are identified explicitly; product examples describe the documented versions, not hands-on testing.

## The useful distinction: a mixture, a loaded brush, and a painted surface

The owner's idea is feasible, but three different things need their own controls and state:

1. **A mixture recipe:** several source colors and their amounts. This can produce one uniform color.
2. **A brush load:** a uniform mixture, several colors side by side, or a partly mixed patch picked up from a palette. This can produce streaks that change across a stroke and run out over its length.
3. **The surface:** existing marks, with material and wetness properties if the engine supports them. This determines whether the brush deposits, picks up, smudges, dilutes, or lifts paint.

**Recommendation:** make “Mix evenly” and “Keep streaks” two understandable outcomes of the same palette, with an honest preview stroke. A gradient changing across the brush is different from paint fading along a stroke; allow these independently rather than hiding both behind “gradient brush.”

## Relevant precedents

| Question | Verified precedent | What it suggests for this app |
| --- | --- | --- |
| Can a palette be a small painting surface? | Rebelle 8's Mixing Palette has paint, blend, erase, and color-pick operations. | A separate mixing surface is a familiar model; preserve the main canvas while experimenting. |
| Can palettes be reusable objects? | Rebelle documents a library, explicit saving, duplication, renaming, and import. Loading into a project makes a copy. | A tray should refer to a saved collection, with a distinct editable working copy. |
| Can a brush carry more than one color? | Fresco samples an area into a multicolor swatch and paints with it. | “Load this patch” is a credible digital extension to dipping a brush. |
| Can paint run out or stay dirty? | ArtRage's oil brush has Loading and Auto Clean controls. | Offer finite paint as an option with visible reload and rinse actions. |
| Can streaks remain separate? | Rebelle's bristle settings distinguish per-bristle smudging from an averaged color. | A brush load should retain a spatial arrangement when the artist wants streaks. |
| Can workspaces be named and recalled? | Krita saves docker grouping and placement as workspaces. | Save arrangements independently of the painting and its colors. |

Sources: [Rebelle Mixing Palette](https://escapemotions.com/products/rebelle/manual/8/interface/panel-mixing-palette/), [Fresco colors and multicolor swatches](https://helpx.adobe.com/fresco/desktop/draw-paint-animate-and-share/colors.html), [ArtRage Oil Brush](https://www.artrage.com/manuals/natural-media-tools/oil-paint-settings/), [Rebelle bristle paint settings](https://escapemotions.com/products/rebelle/manual/8/interface/panel-brush-creator/bristle-brushes/paint/), [Krita Workspaces](https://docs.krita.org/en/reference_manual/resource_management/resource_workspace.html).

These are interaction precedents. Their existence does not establish that their renderers, files, code, or brand assets can be incorporated here.

## Mixing more than two colors

**Recommendation: start with a recipe beside the physical mixing well.** Add a color, change its amount, remove it, and preview the result. Present amounts as parts: “Ultramarine: 3 parts; crimson: 1; white: 2.” Display percentages as a calculated explanation, not another independent set of controls. Increasing white from 2 to 3 parts should not change the other artists' entered amounts behind their back. Prevent an all-zero mixture; restoring the previous valid amount is clearer than producing an undefined color.

Preserve the recipe, not just the final hex value. That makes “duplicate and make warmer” possible later, and avoids accumulating conversion errors when reopening and editing a mixture. Source colors need names and stable identities; “Ultramarine” is a friendly label, not evidence that an RGB swatch reproduces a particular physical pigment's spectral behavior.

### Color calculation is a separate choice

Mixbox provides pigment-like mixing with RGB inputs and outputs; its JavaScript documentation explicitly demonstrates a weighted three-color mixture by converting colors to a latent representation, combining their weighted components, and converting back. It therefore offers a concrete candidate for a multi-color recipe engine. It does not supply water flow, brush bristles, depletion, or the app's interface. [Mixbox project](https://github.com/scrtwpns/mixbox), [JavaScript multi-color example](https://github.com/scrtwpns/mixbox/blob/master/javascript/README.md#mixing-multiple-colors).

**Integration gate:** the published license is CC BY-NC 4.0 for noncommercial use, with commercial licensing available separately. No license has been obtained, no cost has been verified, and no dependency should be added on the strength of this note. Evaluate permission and attribution for the intended product before integration. [Mixbox license](https://github.com/scrtwpns/mixbox/blob/master/LICENSE), [vendor licensing FAQ](https://scrtwpns.com/mixbox/).

**Repo finding:** `apps/web/src/lib/canvas/paints.ts` currently combines two RGB colors and applies a fixed darkening factor. This is an approximation; it is not a physical pigment model. A recipe prototype can explore the controls with an explicitly approximate preview while the engine decision remains open. Do not present an ordinary RGB gradient or CSS blend mode as proof of realistic pigment mixing.

## Partly mixed paint and loading a brush

Fresco's multicolor swatch is a particularly direct answer to “more blue over here, more red over there”: sample a nearby multicolored area, then paint with the captured color arrangement. Support varies by brush family; Adobe documents live brushes and most pixel brushes, excluding vector brushes. That limitation is useful precedent for explaining which tools can carry a particular load. [Fresco multicolor swatches](https://helpx.adobe.com/fresco/desktop/draw-paint-animate-and-share/colors.html#create-a-multicolor-swatch).

**Recommendation: prototype three distinct loads.**

- **Even:** one mixed color from the recipe.
- **Streaked:** two to four zones across the brush, each holding a color or recipe. A “Blend amount” controls how soft the boundaries become; it does not change the recipe amounts.
- **From palette:** choose a patch of the mixing surface. This is the expressive destination, after the simpler loads work.

For the first streaked prototype, use a small cross-section of color samples across the brush width. Orient it with the stroke tangent, with a stable initial angle for a stationary stamp; do not imply support for pen barrel rotation on devices that do not report it. Preserve this load when painting starts so changing a control elsewhere cannot rewrite a stroke already in progress.

Rebelle's per-bristle smudging versus averaged color illustrates why sampling everything into one mean RGB value loses the intended streaks. Krita also distinguishes adding new color from smudging color under the brush; these are separate controls, not synonymous forms of opacity. [Rebelle bristle settings](https://escapemotions.com/products/rebelle/manual/8/interface/panel-brush-creator/bristle-brushes/paint/), [Krita Color Smudge Brush Engine](https://docs.krita.org/en/reference_manual/brushes/brush_engines/color_smudge_engine.html).

### Depletion and reload

ArtRage's oil-brush Loading determines how long paint lasts, and Auto Clean controls whether picked-up color remains between strokes. Its palette knife can also carry a paint load or work existing paint without one. These establish good precedents for visible “load” and “rinse” actions. [ArtRage Oil Brush](https://www.artrage.com/manuals/natural-media-tools/oil-paint-settings/), [ArtRage Palette Knife](https://www.artrage.com/manuals/natural-media-tools/palette-knife/).

**Recommendation:** default to continuously available paint for a low-stress party; offer finite loading as an expressive setting. Always show “Reload,” and provide automatic reload as an alternative. In finite mode, consume load by distance and deposited area/pressure rather than by elapsed time or pointer-event count. A faster tablet must not empty paint sooner because it emits more samples. Start with a controlled falloff in coverage and texture; do not claim a physical fluid simulation. Retain load between strokes only if the artist selected that behavior. Allow “Rinse” to clear picked-up color without destroying the saved recipe.

## Water, acrylic, and dry tools

Rebelle explicitly separates applied water, canvas wetness, diffusion, and drying, and provides controls to inspect wetness and pause diffusion. This is evidence that convincing wet painting needs persistent surface state, rather than a single opacity slider. [Rebelle Working with Water](https://www.escapemotions.com/products/rebelle/manual/8.2/starting-painting/water/).

**Recommendation:** separate water content, thickness/viscosity, and color load in the design model even if the first renderer approximates them. “Thinner / thicker” describes acrylic consistency; “wetter / drier” describes added water. Neither alone specifies drips, surface flow, or drying chemistry. Make reactivation rules an explicit artistic choice; don't silently promise chemically faithful behavior across all media.

The user's palette-knife/watercolor restriction is a proposed product rule, not a universal claim about studio practice. Encode compatibility as data, with a short available explanation such as “This knife works with acrylic.” Preserve the previous choice until the artist selects a compatible medium; never secretly substitute paint. The dry texture sponge should add no new color. Erasing, dry texturing, and water-only use must not require choosing a color first.

**Repo limitation:** `ToolId` currently mixes physical implements (`round`, `flat`, `knife`), media (`watercolor`, `acrylic`, `charcoal`), and actions (`water`, `eraser`). `Stroke` carries one color and optional viscosity. The current water tool smudges/dilutes flattened pixels; it does not know whether a pixel came from acrylic or pastel. Material-specific effects need an explicit engine/surface representation and shared-protocol design. That is a structural follow-up requiring approval under AGENTS.md, not a cosmetic toolbar change.

## Trays, collections, and recent colors

**Recommendation:** separate four things:

| Object | Contents | Expected behavior |
| --- | --- | --- |
| Saved collection | Named recipes/loads, order, stable IDs, format version | Save, duplicate, rename, export/import |
| Working collection | Editable copy with unsaved changes | Save changes, revert, save as a new collection |
| Tray instance | Collection reference plus local shape, size, position | Many views of the same colors; independently arranged |
| Recent colors | Colors or loads actually used to make accepted marks | Automatic history; copy/pin into a collection |

This follows Rebelle's useful distinction between a library original and a project copy, while extending it to the owner's multiple trays. Keep recents separate from saved collections so experimenting cannot overwrite a favorite palette. Deduplicate by recipe/load identity and put the latest use first; hovering, previewing, or moving a tray should not add a recent color.

Export a versioned data format that retains recipes and load structure; offer a simple swatch-only export later with an explicit warning that it loses mixture information. Import should validate size, count, types, and color values and show a preview before adding a new collection. Treat names as text, never executable markup. Palette sharing can begin with a downloaded file; it does not require a hosted public gallery or publishing private account data.

## Multiple windows and multiple devices are different jobs

| Capability | Browser reality checked today | Recommendation |
| --- | --- | --- |
| A panel inside the current page | Uses ordinary page layout | Make this the dependable baseline. |
| A separate desktop panel | `window.open()` requests a browsing context; blockers and user/browser preferences can prevent a popup | Use an explicit “Open panel” action and provide a normal link/in-page fallback. |
| Synchronizing sibling tabs/windows | BroadcastChannel communicates among same-origin contexts in the same storage partition | Use for same-browser local coordination; it is not device pairing or durable storage. |
| Automatically placing a window on a monitor | Window Management exposes connected screens with permission and limited browser support | Progressive enhancement only; manually moving the browser window must remain viable. |
| Phone/iPad companion | A separate device has a separate browser context | Pair through an authenticated server session; do not promise OS-style window movement to a phone. |

Sources: [MDN window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open), [MDN Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API), [MDN Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API), [W3C Window Management specification](https://www.w3.org/TR/window-management/). WebSocket provides browser-to-server communication, but the application must define identity, authorization, ordering, recovery, and persistence. [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API).

Do not promise browser-chrome-free, always-on-top palettes, automatic recovery of exact desktop coordinates, or restoration of many windows without further user interaction. Window requests are browser-managed; each requested popup may require its own user gesture. Opening a named, existing panel is preferable to creating another anonymous copy every time. [MDN window.open behavior](https://developer.mozilla.org/en-US/docs/Web/API/Window/open#description).

**Recommended ownership:** active tool, compatible medium, current load, and collection content belong to one artist session. Widget visibility, grouping filters, position, scale, and ordering belong to one display/panel. Party canvas, accepted strokes, painter identity, and pass timing remain server-owned. Hiding a brush in one panel must not hide it on an iPad or deselect it everywhere. Syncing an artist's tools must not change a different party member's preferences.

For companion devices, plan an explicit “Connect another device” flow, revoke/disconnect controls, short-lived pairing credentials, and a visible offline state. A companion must attach to the existing artist identity rather than join as a second independent painter. Decide whether simultaneous painting inputs are allowed; the simpler first proof gives one surface control at a time. A stale companion should resync before sending marks. These are recommendations, not existing server capabilities.

Save workspace names and per-panel arrangements, but reopen missing/oversized layouts inside the current viewport. “Send to another display” can mean opening the same panel on a paired device and optionally closing this instance; it cannot literally transfer a browser window across devices.

## Accessibility belongs in the first prototype

Tool shortcuts can wait for v2; ordinary keyboard operation cannot. Every photo tool needs a named button and an explicit selected state. The highlight silhouette can remain decorative. Disabled combinations need a readable reason; ensure it can be reached without hovering a disabled button.

Provide labeled numeric inputs alongside ratio and blend sliders. Offer move/resize controls and preset positions in addition to dragging; offer tap-based reorder as well as keyboard reorder. WCAG 2.2's dragging criterion requires a non-dragging single-pointer alternative independently of keyboard access. [W3C Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements).

Announce committed changes succinctly (“Flat brush, acrylic, Harbor blue, loaded”); don't announce every pointer sample or slider movement. Keep settings and recovery reachable if every optional widget is hidden. At small widths, allow compact lists/drawers without shrinking hit targets below the repository's 44px requirement. A palette-mixing surface needs named recipe/zone controls as its nonvisual path, not only an inaccessible painted thumbnail.

## Staged proof, without skipping the current roadmap gate

The roadmap is still in phase 1, awaiting the real two-person call/painting gate. Design research and a separately scoped throwaway prototype can run now; this document does not mark phase 2–4 capabilities done.

1. **Local interaction proof:** tool → compatible medium → color/load, standalone tools, 3+ recipe amounts, streaked preview, named tray copies, display-local show/hide/move/resize. Validate the owner's three visual states, pointer and keyboard paths at 360px and 1440px. Approximate mixing is labeled. No new protocol or service.
2. **Brush proof:** compare even and streaked marks, finite loading and reload, water-only operation, repeatable results at different input rates. Decide on a licensed mixing implementation separately. Keep a scratch surface so experiments cannot affect a party canvas.
3. **Shared-rendering design:** define material/load payloads and versioning before changing shared types. Verify batching, replay, undo, late join, reconnect, and snapshots; a flattened PNG alone cannot restore hidden wetness/material state. Preserve server-only painter authority. No claim of pixel-identical cross-browser GPU output without evidence.
4. **Desktop panel proof:** explicit opening, same-origin sync, panel closure/reopen, storage failure, popup blocking, denied screen permission, monitor disconnect, and independent panel layout. Treat browser support as a test matrix, not an assumption.
5. **Companion proof:** a real phone/tablet paired to the same artist, conflict handling, revocation, disconnect/reconnect, and shared tool-state changes. Plan profile albums and account persistence separately from device pairing.

An interaction prototype proves that the idea is understandable and enjoyable. It does not prove physical media simulation, robust synchronization, durable cloud saving, or device compatibility. Those need their own measured gates.
