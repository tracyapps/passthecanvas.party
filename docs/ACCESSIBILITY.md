# Accessibility and inclusion

Target: **WCAG 2.2 AA** at minimum. Rule of thumb: every feature that depends on looking or dragging gets a second way in that works with a keyboard, a screen reader, or a slow connection.

## Feature by feature

| Feature | Second way in |
| --- | --- |
| 360° room (drag to look) | Arrow keys pan; number keys jump to zones (1 table, 2 couch…); a "Jump to" list names every zone and who's sitting there. This list doubles as the screen-reader version of the room. |
| Picking a spot (click in the room) | The same spots as a list of buttons |
| Painting (mouse/pen) | Keyboard stamp mode: arrow keys move a cursor, Space lays paint, Shift+arrows draw a line, plus a few shape tools |
| Turn timer (visual dial) | Live region announces whose turn it is, 30 s left, 10 s left, and "pass the canvas". It doesn't announce every second. |
| Brush, color, size | Real buttons with names and `aria-pressed`; paint names spoken ("Ultramarine"), never only a swatch |
| Video chatter | Live captions (provider TBD; see DECISIONS) |
| Cats, snacks, props | Optional fun only. Never needed to play. Hold still under reduced motion until clicked. |
| Turn-taking | "Pass my turn" and "watch only" are normal, guilt-free options |

## Motion

When `prefers-reduced-motion: reduce` is on:

- No auto-rotate and no inertia in the room viewer; zone jumps cut instead of sliding
- Pass-the-canvas card fades instead of sliding
- Cat loops pause on their first frame until clicked
- Gyroscope control is always opt-in, whatever the motion setting

## Visual

- Text contrast is 4.5:1 or more, including small grey labels. Large text (24px+) is 3:1 or more.
- States never rely on color alone (selected = ring + `aria-pressed`, muted = icon slash + label).
- Color pairs that must be told apart differ in lightness. Prefer blue/orange over red/green.
- Focus is always visible: `outline: 3px solid` with an offset, using the focus token.
- Touch targets are at least 44×44px.

## Content

- Plain language. Short labels. No jargon in UI copy.
- Every icon-only button has an `aria-label`.
- Decorative SVG gets `aria-hidden="true"`.
- The shared canvas has `role="img"` and an `aria-label` that updates ("Shared canvas, round 3. Jordan is painting.").

## Connection and device

- Phones get smaller panoramas and fewer simultaneous video tiles.
- Video drops to audio + avatar automatically on weak connections.
- The canvas sends strokes, not video, so it stays crisp on bad wifi.

## Testing checklist (per feature)

- [ ] Keyboard only, start to finish
- [ ] VoiceOver on macOS Safari + iOS
- [ ] 200% zoom, no horizontal scroll at 320px
- [ ] Reduced motion on
- [ ] Automated check (axe) clean
