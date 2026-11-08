# Saved view selector and workspace manager

Research checked November 8, 2026. This is a proposal for the requested account manager, party drawer, thumbnail selector and responsive editor.

## Patterns worth adopting

| Source | Documented behavior | Application here |
| --- | --- | --- |
| Photoshop | A workspace switcher selects saved arrangements. Reset restores the named saved arrangement even after panels move. | Keep the selected saved view and current working arrangement separate. Show “Modified” beside a view when the arrangement differs. Provide Restore saved view. [Restore workspaces](https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/restore-workspaces.html) |
| Photoshop toolbar editor | Organizes visible and extra tools, saves/loads presets, restores defaults, and provides Done/Cancel. | Show an explicit list of included tools with a visual editor. Apply commits the draft. Cancel discards draft changes. Keep hidden tools available in the manager. [Customize toolbar](https://helpx.adobe.com/photoshop/desktop/get-started/set-up-toolbars-panels/customize-the-toolbar.html) |
| VS Code profiles | A new profile can copy another, show its contents, and be previewed before creation. Copies have independent settings. Machine-specific values are excluded from profile exports. | Duplicate a view into an independent draft. Show what it contains before applying. Keep portable layout intent distinct from device-specific window coordinates. [Profiles](https://code.visualstudio.com/docs/configure/profiles) |
| Blender | Named workspace tabs support switching, renaming, duplicating, deleting and reordering. A duplicate includes its editor layout. The last workspace cannot be deleted. | Give every view one predictable set of management actions and always preserve a usable default. [Workspaces](https://docs.blender.org/manual/en/latest/interface/window_system/workspaces.html) |

These are interaction precedents. The following preview and persistence design is a recommendation derived for this app.

## One manager, three entry points

The compact in-party selector should show the active view name and thumbnail, with access to saved views, Save changes, Save as new and Manage views. The party drawer and account settings should open the same manager and editor, using the same data. The drawer should stay within the party and preserve the canvas, turn and selected paint. Account settings can use the available page width to show more thumbnails.

Each saved-view card should include its name, thumbnail, tool count, tool display style and saved aspect ratio. Selecting a card opens its draft editor. A separate Apply action makes it the current party view. Rename, Duplicate, Delete and Restore saved view should use explicit labeled controls, with keyboard access. Preserve a default view and an obvious route back if the active custom view is deleted.

The editor needs tool visibility, position/order, cutout/grid style, canvas frame placement and size, docking, and rotation where already supported. Include selected toolbox and palette references if those belong to the saved setup. Recover a missing toolbox or deleted palette visibly so an imported or older view stays usable. Keep presentation changes out of canvas strokes and paint history.

## Draft, save and apply behavior

Opening the editor clones the saved definition into a draft. Preview controls change that draft. Apply uses it for the current session. Save updates the named saved definition, while Save as new and Duplicate create independent IDs. Cancel returns to the unchanged working arrangement. Closing or switching away from a dirty draft should expose Save, Discard and Keep editing choices only when there are real edits.

A dirty indicator should compare the actual layout values with the selected saved definition, rather than treating every pointer move as a permanent save. A storage failure must keep the draft available and report that saving failed. Account persistence needs verified server support before promising cross-device availability. The existing [workspace module](../apps/web/src/lib/canvas/workspaces.ts) stores browser-local current layout and saved views, so account placement alone does not establish synchronization.

## Faithful thumbnails and responsive preview

Render a small, noninteractive version of the actual layout from saved data. Use the same placement calculation, tool artwork, crop focus, display style, canvas frame and visibility rules as the party. Lay it out at the chosen virtual viewport dimensions, then scale the entire scene uniformly to fit the thumbnail. Give it a fixed aspect-ratio stage, visible bounds and a text equivalent. Keep preview controls outside the scaled scene.

A scaled 1440px-wide scene answers “How does this saved desktop arrangement look?” A 360px viewport simulation must instead run the real narrow-screen layout at 360 CSS pixels, then scale its result to the preview box. Changing only the thumbnail width would hide the mobile behavior. Offer current screen, desktop, tablet and phone preview sizes, with portrait/landscape where appropriate. Previewing another size should not overwrite saved positions.

Test that thumbnail, editor preview and applied view agree for the same viewport, including hidden tools and overlapping objects. Then test restored positions after resizing, zooming, rotating a device and changing aspect ratio. Keep automatic recovery reversible and preserve the saved definition so returning to its original screen restores its intended arrangement.
