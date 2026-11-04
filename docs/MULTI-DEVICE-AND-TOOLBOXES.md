# Toolboxes, pop-out panels and linked devices

Owner request, Nov 4, 2026. Plan agreed in chat; build in this order.

## Decisions (owner)

- Build **toolboxes first**. They sit on the shared table state that pop-outs and linked devices need.
- **Pairing:** QR code plus a short code. Both expire after a few minutes. The linked device only sees and paints in that one link session and never gets account access.
- **Pop-outs:** regular browser windows, which work in every desktop browser. An always-on-top window can come later.

## The foundation: one table state

Today the painting table keeps its state inside `PaintingTable.svelte`: the tool in hand, size, intensity, open palette, tray recipe, layout. Every panel and every pop-out must read and write the **same** state, so a tool shown in two toolboxes (or two windows, or two devices) can never disagree.

- `tableState` store: a Svelte 5 runes module holding selection, size, intensities, palette, tray and the layout.
- Panels become views of that store, never copies.
- Across windows on one computer, the store syncs over `BroadcastChannel`.
- Across devices, it syncs over the party server's WebSocket (see phase C).

## Phase A: toolboxes (custom "dashboards" of supplies) ✓ done Nov 4, 2026

- **Show or hide** any supply on its own (pencils, water, sponge…).
- **Named toolboxes**: a list of supplies plus where they sit.
  - Built in: "Everything", "Drawing" (charcoal, pencils, pastels, eraser), "Drawing +" (adds water and sponge).
  - Your own: make one, rename, duplicate, delete.
- **A supply can be in several toolboxes.** It is one tool with one state, shown in more than one place.
- **Saved views** grow into **workspaces**: toolboxes, their layout, the canvas window, dock and rotation. They stay saved to the account, as views are now.
- **Accessibility:** every show, hide and reorder can be done from the keyboard and is announced. Hidden tools stay reachable from the toolbox menu.

### What shipped in Phase A

- **Toolboxes:** `canvas/toolboxes.ts`.
  - Built in: Everything, Drawing, Drawing +, Painting.
  - Your own: up to 20, made from any toolbox; rename, tick supplies, duplicate, delete.
  - A picker in the header, and a Toolboxes panel (Menu → Toolboxes…).
- **Saving:** toolboxes live in the saved-views state (`toolboxes`), and each layout records its `toolbox`. Older views open as Everything.
- **Saved views panel:** a list with open, update, rename and delete (asks first), plus save new. The account copy buttons are tucked under "Account copies".
- **Server:** account views now accept toolboxes and the canvas window's x/y. Before this, account saves failed after the window had been resized.
- **Not yet:** the shared `tableState` store. Tool, paint and size still live in `PaintingTable`; that's fine while there's one window, and moving them out is the first step of Phase B.
- **Not yet:** supplies in a small toolbox keep their default spots. A "tidy up" that packs them around the canvas may be worth adding.

## Phase B: pop-out panels (several monitors on one computer)

- "Pop out" on a panel or toolbox opens it in its own window (`window.open`, same site), which you drag to any monitor.
- Every window shares the table state over `BroadcastChannel`. Choosing a brush in one window shows it chosen everywhere.
- Closing a pop-out docks the panel back. The workspace remembers which panels were popped out.

## Phase C: linked devices

- **Linking:**
  - Same account on both devices: the second device offers "Link with your other device".
  - Without signing in: QR code plus a short code (phase decisions above).
  - The link is a private relay channel on the party server, separate from parties.
- **Modes**, like connecting a second display:
  - **Mirror:** both devices show the same thing.
  - **Extend, canvas there:** the canvas goes full screen on the tablet, and the tools stay on the computer.
  - **Extend, canvas + mini tools:** the canvas plus a compact tool rail and color puck, fixed top-left over the canvas. Bigger, standard touch-size buttons, like the Concepts app.
  - **Tools there:** a phone becomes a palette and tool picker for the computer's canvas.
- **One canvas owner:** the canvas lives on one device, and the others send strokes and choices to it. In a party, all strokes still go out as the same member.
- **Later, in parties:** send your camera and room view to a phone while you paint on the computer or tablet, and swap displays.

## Phase D: the menu rethink

The owner is planning the menu organization once A–C are working.

## Done first (bugs, Nov 4)

- **Tablet lag:**
  - Layers no longer use `willReadFrequently`, which forced slow CPU drawing.
  - The canvas redraws once per screen frame instead of on every pencil event.
  - The navigator thumbnail updates at most four times a second.
  - The viewport is measured once per stroke.
  - The touch-and-pinch undo uses an image copy instead of reading pixels back.
  - Result: about half the work per pencil move, with the same pixels.
- **Saving on iPad:** a piece whose strokes can't be kept (too much detail, or a stroke the server can't check yet) now still saves as a picture and reopens as a picture to keep painting on. The server logs the reason.
- **Download on iPad:** iOS ignores download links for `data:` URLs. Downloads now use the share sheet on touch devices ("Save Image" puts it in Photos) and a Blob download elsewhere. The same fix covers practice pieces, painting data and calendar `.ics` files.
- **Pencil pressure:** about 40% stronger. Mouse painting is unchanged.
