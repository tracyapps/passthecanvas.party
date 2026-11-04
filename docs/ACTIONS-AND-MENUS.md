# Every action, for planning menus and icons

A full list of what people can do, grouped by where it naturally belongs, to
plan the menu structure and the icon set. Nov 4, 2026.

Each item is marked: **✓** exists · **◐** exists, needs a better home ·
**○** planned · **!** missing, and worth adding. The proposed groups are a
starting point, not decisions.

## Glaring gaps (the "!" items)

1. **Undo / redo on the painting table.** The avatar maker has it; the painting table doesn't. People will expect Cmd/Ctrl+Z on day one. In a party it can only undo your own strokes this turn.
2. **Keyboard shortcuts list.** The shortcuts exist (Space to pan, Cmd/Ctrl+S, Enter to stamp, arrows to draw, +/- to zoom, Escape to put a tool down), but nothing on screen lists them.
3. **Eyedropper / recent colors.** Picking a color back up from the canvas, plus a strip of the last few colors used.
4. **Clear my layer.** Wipe your own marks without starting a new canvas. Asks first.
5. **Rename and duplicate a practice piece from your studio.** Right now you rename by retitling on the table.
6. **Account deletion and "download my data".** Expected for privacy (it's on the roadmap; menus need a place for it).
7. **Report / block a person.** Needed before parties with people you don't know well.
8. **Help and feedback.** A "Something's wrong" or "Send feedback" entry, and the accessibility statement.
9. **Leave-party confirmation**, and **mute / camera off** buttons that are always visible in a party (not just in a panel).
10. **One "where is my work?" status.** Saved, auto-saved, unsaved and offline now show by Menu on the practice table. Parties need the same (strokes are synced, but say so).

## 1. Site (public pages)

- ✓ How it works · The gallery · On the workbench · Try the paints
- ✓ Create a free account (main action) · Log in to your studio
- ✓ Plan a party (main action once signed in) · Your studio (photo + name)
- ✓ Light/dark appearance
- ✓ Support the studio / donate · Contact · Privacy · Terms · Roadmap
- ! Accessibility statement · Help / FAQ

## 2. Your studio (account area)

**Home**
- ✓ Dashboard: happening now, waiting on you, coming up, recent art, friends
- ✓ Start a party now · Plan a party · Practice table

**You**
- ✓ View profile · Edit profile (name, bio, photo or initials and color, links)
- ✓ Avatars: make, edit, rename, duplicate, delete, set default
- ✓ Avatar work kept on this device until signed in, with a sign-up prompt
- ✓ Camera & mic check (choose devices, saved as defaults)

**People**
- ✓ Friends: requests in/out, accept, decline, remove, share profile link
- ! Block / report

**Parties**
- ✓ Calendar: month, week, list · add to Google/Outlook/Yahoo/.ics · subscribe feed
- ✓ Party: RSVP, cancel, edit, rotate invite link, invite friends
- ✓ History & art: past parties, saved galleries

**Your work**
- ✓ Practice pieces: keep painting, download, delete
- ✓ Auto-saves tab (newest 20)
- ! Rename, duplicate, "make this auto-save my piece" (promote)
- ○ Sort / search once there are lots

**Settings**
- ✓ Privacy: profile link sharing, allow friend requests
- ✓ Notifications: email invites, email reminders
- ✓ Painting & display: auto-save interval, interface size
- ✓ Sign-in & linked accounts (Clerk) · Sign out
- ! Delete account · Download my data
- ○ More display options: font size, reduced motion override, high-contrast panels, default canvas shape, default dock/toolbox

## 3. Painting table (practice and party)

**Always visible (top bar)**
- ✓ Paint / Arrange & view
- ✓ Tool in hand · Current color
- ✓ Messages (header note)
- ✓ Save status pill (tap to save) · Menu

**Canvas view (zoom bar)**
- ✓ Rotate · Navigator (when zoomed) · Zoom slider · Zoom level menu with Fit
- ✓ Pan: drag with no tool, hold Space, two fingers, right-drag
- ✓ Resize the canvas window by its edges
- ○ Flip horizontal (mirror check, a classic artist trick)
- ○ Full screen

**Tools and paint**
- ✓ Pick up a supply · Put tool down (Escape)
- ✓ Brush size / exact size · Intensity (airbrush, burnisher)
- ✓ Palettes per medium · Custom color · Color tray (mix, streaks or even, parts, save mix)
- ✓ Water cup (rinse) · Wet / wring out sponge
- ! Undo / redo · Eyedropper · Recent colors · Clear my layer

**This piece (practice table)**
- ✓ Title · Save (Cmd/Ctrl+S) · Download PNG · New canvas (shape chosen once)
- ✓ Export painting data
- ✓ Follows saves from your other devices

**Workspace / layout**
- ✓ Arrange supplies (drag, arrows) · Tool placement (around, columns) · Reset
- ✓ Saved views (browser and account)
- ○ Toolboxes: show/hide supplies, named sets ("Drawing", "Drawing +"), built-in and your own
- ○ Pop out a panel into its own window
- ○ Panel positions saved with the view

**Party only**
- ✓ Party setup (timing, passing order) · Start the game · Pass the canvas · Pass everyone on
- ✓ Invite people (link, friends) · Show guests · Go to the room · Open the gallery · Leave the party
- ✓ Radio · Notes · Switch camera / avatar
- ! Mute mic · Camera off: always one tap away
- ! Leave-party confirmation · Raise hand / reactions (optional, fun)

**Help**
- ! Keyboard shortcuts · "How do these tools work?" (tool tips with a tiny demo)

## 4. Room and gallery

- ✓ Pick a seat · Look from your seat or the middle
- ✓ See the finished pieces · Hang them in the gallery · Time-lapse
- ✓ Copy gallery link · Private delete link · Delete archive
- ○ Download all pieces (zip) · Share one piece

## 5. Linked devices (planned, phase C)

- ○ Link a device: QR code + short code, or same account
- ○ Modes: mirror · canvas there (tools here) · canvas + mini tools · tools there (phone as palette)
- ○ Swap displays · Unlink · Which device is "the canvas"
- ○ Party: send my camera/room view to a phone

## Suggested menu shape (for discussion)

- **Top bar:** the essentials you touch every few seconds (mode, tool, color, save status, undo/redo, Menu).
- **Menu, top to bottom:**
  1. This piece / This party
  2. View (zoom, rotate, flip, full screen)
  3. Workspace (toolboxes, arrange, saved views, pop out)
  4. Devices (link, modes)
  5. Help (shortcuts, how tools work, feedback)
  6. Separator, then Account (signed in as…, my studio, settings, sign out)
- **Settings page** holds anything you set once and forget (interface size, auto-save, defaults, privacy, notifications).
